import { createHmac, randomBytes } from 'node:crypto';

import { AgentModel } from '@/database/models/agent';
import {
  AgentCredentialModel,
  type DecryptedAgentCredential,
} from '@/database/models/agentCredential';
import { type LobeChatDatabase } from '@/database/type';
import { appEnv } from '@/envs/app';
import { authEnv } from '@/envs/auth';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_PROVIDER = 'google';
const GOOGLE_OAUTH_MAX_AGE_MS = 10 * 60 * 1000;
const GOOGLE_REFRESH_LEEWAY_MS = 5 * 60 * 1000;

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

interface GoogleAgentOAuthState {
  agentId: string;
  issuedAt: number;
  nonce: string;
  provider: 'google';
  userId: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleUserInfo {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
}

const toBase64Url = (value: string) => Buffer.from(value).toString('base64url');

const fromBase64Url = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

const getOAuthStateSecret = () => {
  const secret = authEnv.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is required for agent OAuth');
  }

  return secret;
};

const getGoogleOAuthConfig = () => {
  if (!authEnv.AUTH_GOOGLE_ID || !authEnv.AUTH_GOOGLE_SECRET) {
    throw new Error('Google OAuth is not configured');
  }

  if (!appEnv.APP_URL) {
    throw new Error('APP_URL is required for agent OAuth');
  }

  return {
    callbackURL: `${appEnv.APP_URL}/api/agent/oauth/google/callback`,
    clientId: authEnv.AUTH_GOOGLE_ID,
    clientSecret: authEnv.AUTH_GOOGLE_SECRET,
  };
};

export const isGoogleAgentOAuthEnabled = () =>
  !!(authEnv.AUTH_GOOGLE_ID && authEnv.AUTH_GOOGLE_SECRET);

export class AgentCredentialService {
  private db: LobeChatDatabase;
  private userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  private async createCredentialModel() {
    const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
    return new AgentCredentialModel(this.db, this.userId, gateKeeper);
  }

  private async assertAgentOwnership(agentId: string) {
    const model = new AgentModel(this.db, this.userId);
    const agent = await model.getAgentConfigById(agentId);

    if (!agent) {
      throw new Error('Agent not found');
    }

    return agent;
  }

  createGoogleOAuthState(agentId: string) {
    const payload: GoogleAgentOAuthState = {
      agentId,
      issuedAt: Date.now(),
      nonce: randomBytes(12).toString('hex'),
      provider: GOOGLE_PROVIDER,
      userId: this.userId,
    };

    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = createHmac('sha256', getOAuthStateSecret())
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  }

  parseGoogleOAuthState(state: string): GoogleAgentOAuthState {
    const [encodedPayload, signature] = state.split('.');

    if (!encodedPayload || !signature) {
      throw new Error('Invalid OAuth state');
    }

    const expected = createHmac('sha256', getOAuthStateSecret())
      .update(encodedPayload)
      .digest('base64url');
    if (signature !== expected) {
      throw new Error('Invalid OAuth state signature');
    }

    const payload = JSON.parse(fromBase64Url(encodedPayload)) as GoogleAgentOAuthState;
    const isExpired = Date.now() - payload.issuedAt > GOOGLE_OAUTH_MAX_AGE_MS;

    if (isExpired) {
      throw new Error('OAuth state expired');
    }

    if (payload.provider !== GOOGLE_PROVIDER) {
      throw new Error('Invalid OAuth provider');
    }

    return payload;
  }

  async createGoogleAuthorizationUrl(agentId: string) {
    await this.assertAgentOwnership(agentId);

    const { callbackURL, clientId } = getGoogleOAuthConfig();
    const state = this.createGoogleOAuthState(agentId);
    const url = new URL(GOOGLE_AUTH_URL);

    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('redirect_uri', callbackURL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    url.searchParams.set('state', state);

    return url.toString();
  }

  private async exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
    const { callbackURL, clientId, clientSecret } = getGoogleOAuthConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackURL,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Google OAuth code');
    }

    return response.json();
  }

  private async refreshGoogleToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const { clientId, clientSecret } = getGoogleOAuthConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Google OAuth token');
    }

    return response.json();
  }

  private async fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    return response.json();
  }

  private buildStoredGoogleCredential(params: {
    existingRefreshToken?: string;
    token: GoogleTokenResponse;
    userInfo: GoogleUserInfo;
  }) {
    const { token, userInfo, existingRefreshToken } = params;

    return {
      accessToken: token.access_token,
      email: userInfo.email,
      idToken: token.id_token,
      name: userInfo.name,
      picture: userInfo.picture,
      refreshToken: token.refresh_token || existingRefreshToken,
      scope: token.scope,
      sub: userInfo.sub,
      tokenType: token.token_type,
    };
  }

  private getTokenExpiryDate(expiresIn?: number) {
    if (!expiresIn) return null;
    return new Date(Date.now() + expiresIn * 1000);
  }

  async upsertGoogleCredential(params: { agentId: string; code: string }) {
    await this.assertAgentOwnership(params.agentId);

    const model = await this.createCredentialModel();
    const existing = await model.findByAgentIdAndProvider(params.agentId, GOOGLE_PROVIDER);
    const token = await this.exchangeGoogleCode(params.code);
    const userInfo = await this.fetchGoogleUserInfo(token.access_token);

    const storedCredential = this.buildStoredGoogleCredential({
      existingRefreshToken:
        typeof existing?.credentials?.refreshToken === 'string'
          ? (existing.credentials.refreshToken as string)
          : undefined,
      token,
      userInfo,
    });

    const payload = {
      accountLabel: userInfo.email || userInfo.name || 'Google',
      authType: 'oauth' as const,
      credentials: storedCredential,
      enabled: true,
      externalAccountId: userInfo.sub || userInfo.email,
      provider: GOOGLE_PROVIDER,
      scopes: (token.scope || '').split(' ').filter(Boolean),
      tokenExpiresAt: this.getTokenExpiryDate(token.expires_in),
    };

    if (existing) {
      return model.update(existing.id, payload);
    }

    return model.create({
      agentId: params.agentId,
      ...payload,
    });
  }

  async getValidGoogleCredential(agentId: string): Promise<DecryptedAgentCredential | null> {
    const model = await this.createCredentialModel();
    const credential = await model.findByAgentIdAndProvider(agentId, GOOGLE_PROVIDER);

    if (!credential || credential.enabled === false) return null;

    const expiresAt = credential.tokenExpiresAt
      ? new Date(credential.tokenExpiresAt).getTime()
      : null;
    const refreshToken =
      typeof credential.credentials?.refreshToken === 'string'
        ? (credential.credentials.refreshToken as string)
        : undefined;

    if (!expiresAt || expiresAt - Date.now() > GOOGLE_REFRESH_LEEWAY_MS) {
      return credential;
    }

    if (!refreshToken) {
      return credential;
    }

    const refreshed = await this.refreshGoogleToken(refreshToken);
    const existingUserInfo = {
      email:
        typeof credential.credentials?.email === 'string'
          ? (credential.credentials.email as string)
          : undefined,
      name:
        typeof credential.credentials?.name === 'string'
          ? (credential.credentials.name as string)
          : undefined,
      picture:
        typeof credential.credentials?.picture === 'string'
          ? (credential.credentials.picture as string)
          : undefined,
      sub:
        typeof credential.credentials?.sub === 'string'
          ? (credential.credentials.sub as string)
          : undefined,
    };

    const nextCredential = await model.update(credential.id, {
      credentials: this.buildStoredGoogleCredential({
        existingRefreshToken: refreshToken,
        token: refreshed,
        userInfo: existingUserInfo,
      }),
      scopes: (refreshed.scope || credential.scopes.join(' ')).split(' ').filter(Boolean),
      tokenExpiresAt: this.getTokenExpiryDate(refreshed.expires_in),
    });

    return nextCredential;
  }

  async getUsableCredentialMap(agentId: string) {
    const google = await this.getValidGoogleCredential(agentId);

    return {
      google: google ?? undefined,
    };
  }
}

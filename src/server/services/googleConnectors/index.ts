import { type DecryptedAgentCredential } from '@/database/models/agentCredential';
import { googleConnectorsEnv } from '@/envs/google-connectors';
import { type HttpMCPClientParams } from '@/libs/mcp';

const CONNECTOR_MAP = {
  'virilize-calendar': {
    provider: 'google',
    urlEnvKey: 'GOOGLE_CONNECTOR_CALENDAR_URL',
  },
  'virilize-drive': {
    provider: 'google',
    urlEnvKey: 'GOOGLE_CONNECTOR_DRIVE_URL',
  },
  'virilize-gmail': {
    provider: 'google',
    urlEnvKey: 'GOOGLE_CONNECTOR_GMAIL_URL',
  },
  'virilize-youtube': {
    provider: 'google',
    urlEnvKey: 'GOOGLE_CONNECTOR_YOUTUBE_URL',
  },
} as const;

type GoogleConnectorIdentifier = keyof typeof CONNECTOR_MAP;

type AgentCredentialsMap = Record<string, DecryptedAgentCredential | undefined>;

const NO_GOOGLE_ACCOUNT_ERROR =
  'This agent has no Google account connected. Connect one in Agent Settings > Connected Accounts.';

export class GoogleConnectorService {
  isGoogleConnector(identifier: string): boolean {
    return identifier in CONNECTOR_MAP;
  }

  buildConnectorParams(
    identifier: string,
    agentCredentials: AgentCredentialsMap,
  ): HttpMCPClientParams {
    if (!this.isGoogleConnector(identifier)) {
      throw new Error(`Unsupported Google connector identifier: ${identifier}`);
    }

    const connectorConfig = CONNECTOR_MAP[identifier as GoogleConnectorIdentifier];
    const credential = agentCredentials[connectorConfig.provider];
    const accessToken = credential?.credentials.accessToken;

    if (!credential || typeof accessToken !== 'string' || !accessToken) {
      throw new Error(NO_GOOGLE_ACCOUNT_ERROR);
    }

    const baseUrl = googleConnectorsEnv[connectorConfig.urlEnvKey];
    if (!baseUrl) {
      throw new Error(`Missing connector URL for ${identifier}`);
    }

    return {
      headers: {
        'x-auth-data': Buffer.from(JSON.stringify({ access_token: accessToken })).toString(
          'base64',
        ),
      },
      name: identifier,
      type: 'http',
      url: `${baseUrl.replace(/\/$/, '')}/mcp`,
    };
  }
}

export { CONNECTOR_MAP };

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { AgentCredentialService } from './index';

vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_GOOGLE_ID: 'google-client-id',
    AUTH_GOOGLE_SECRET: 'google-client-secret',
    AUTH_SECRET: 'test-auth-secret',
  },
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'http://localhost:3010',
  },
}));

describe('AgentCredentialService OAuth state', () => {
  it('creates and parses signed Google OAuth state for an agent', () => {
    const service = new AgentCredentialService({} as any, 'user-123');

    const state = service.createGoogleOAuthState('agent-123');
    const parsed = service.parseGoogleOAuthState(state);

    expect(parsed.agentId).toBe('agent-123');
    expect(parsed.provider).toBe('google');
    expect(parsed.userId).toBe('user-123');
    expect(typeof parsed.nonce).toBe('string');
  });

  it('rejects tampered Google OAuth state', () => {
    const service = new AgentCredentialService({} as any, 'user-123');

    const state = service.createGoogleOAuthState('agent-123');
    const [payload, signature] = state.split('.');
    const tampered = `${payload}x.${signature}`;

    expect(() => service.parseGoogleOAuthState(tampered)).toThrow('Invalid OAuth state signature');
  });
});

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { agentCredentials, agents, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { AgentCredentialModel } from '../agentCredential';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'agent-credential-test-user-id';
const userId2 = 'agent-credential-test-user-id-2';
const agentId = 'agent-credential-test-agent-id';
const agentId2 = 'agent-credential-test-agent-id-2';

const mockGateKeeper = {
  decrypt: vi.fn(async (ciphertext: string) => ({ plaintext: ciphertext })),
  encrypt: vi.fn(async (plaintext: string) => plaintext),
};

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }, { id: userId2 }]);
  await serverDB.insert(agents).values([
    { id: agentId, userId },
    { id: agentId2, userId: userId2 },
  ]);
});

afterEach(async () => {
  await serverDB.delete(agentCredentials);
  await serverDB.delete(agents);
  await serverDB.delete(users);
  vi.clearAllMocks();
});

describe('AgentCredentialModel', () => {
  it('creates and returns an agent-scoped credential', async () => {
    const model = new AgentCredentialModel(serverDB, userId);

    const result = await model.create({
      accountLabel: 'Primary Workspace',
      agentId,
      authType: 'oauth',
      credentials: { accessToken: 'token-123' },
      provider: 'google',
      scopes: ['gmail.readonly', 'drive.readonly'],
    });

    expect(result.agentId).toBe(agentId);
    expect(result.userId).toBe(userId);
    expect(result.provider).toBe('google');
    expect(result.accountLabel).toBe('Primary Workspace');
    expect(result.credentials).toEqual({ accessToken: 'token-123' });
    expect(result.scopes).toEqual(['gmail.readonly', 'drive.readonly']);
    expect(result.enabled).toBe(true);
  });

  it('encrypts credentials when a gatekeeper is provided', async () => {
    const model = new AgentCredentialModel(serverDB, userId, mockGateKeeper);

    await model.create({
      agentId,
      authType: 'sandbox_session',
      credentials: { templateId: 'sandbox-template-1' },
      provider: 'tiktok',
    });

    expect(mockGateKeeper.encrypt).toHaveBeenCalledWith(
      JSON.stringify({ templateId: 'sandbox-template-1' }),
    );
  });

  it('returns only credentials owned by the current user', async () => {
    const model1 = new AgentCredentialModel(serverDB, userId);
    const model2 = new AgentCredentialModel(serverDB, userId2);

    await model1.create({
      agentId,
      authType: 'oauth',
      credentials: { accessToken: 'user-1-token' },
      provider: 'google',
    });
    await model2.create({
      agentId: agentId2,
      authType: 'oauth',
      credentials: { accessToken: 'user-2-token' },
      provider: 'linkedin',
    });

    const results = await model1.query();

    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe(userId);
    expect(results[0].provider).toBe('google');
  });

  it('updates encrypted credentials and non-credential fields', async () => {
    const model = new AgentCredentialModel(serverDB, userId, mockGateKeeper);
    const created = await model.create({
      accountLabel: 'Old Label',
      agentId,
      authType: 'oauth',
      credentials: { accessToken: 'old-token' },
      provider: 'youtube',
    });

    const updated = await model.update(created.id, {
      accountLabel: 'New Label',
      credentials: { accessToken: 'new-token', refreshToken: 'refresh-token' },
      scopes: ['youtube.readonly'],
    });

    expect(mockGateKeeper.encrypt).toHaveBeenLastCalledWith(
      JSON.stringify({ accessToken: 'new-token', refreshToken: 'refresh-token' }),
    );
    expect(updated?.accountLabel).toBe('New Label');
    expect(updated?.credentials).toEqual({
      accessToken: 'new-token',
      refreshToken: 'refresh-token',
    });
    expect(updated?.scopes).toEqual(['youtube.readonly']);
  });

  it('supports separate credentials for different agents owned by the same user', async () => {
    const sameUserAgentId = 'agent-credential-test-agent-id-3';
    await serverDB.insert(agents).values({ id: sameUserAgentId, userId });

    const model = new AgentCredentialModel(serverDB, userId);

    await model.create({
      accountLabel: 'Google Account A',
      agentId,
      authType: 'oauth',
      credentials: { email: 'account-a@example.com', refreshToken: 'refresh-a' },
      externalAccountId: 'google-sub-a',
      provider: 'google',
    });

    await model.create({
      accountLabel: 'Google Account B',
      agentId: sameUserAgentId,
      authType: 'oauth',
      credentials: { email: 'account-b@example.com', refreshToken: 'refresh-b' },
      externalAccountId: 'google-sub-b',
      provider: 'google',
    });

    const firstAgentCredential = await model.findByAgentIdAndProvider(agentId, 'google');
    const secondAgentCredential = await model.findByAgentIdAndProvider(sameUserAgentId, 'google');

    expect(firstAgentCredential?.externalAccountId).toBe('google-sub-a');
    expect(firstAgentCredential?.credentials).toMatchObject({ email: 'account-a@example.com' });
    expect(secondAgentCredential?.externalAccountId).toBe('google-sub-b');
    expect(secondAgentCredential?.credentials).toMatchObject({ email: 'account-b@example.com' });
  });
});

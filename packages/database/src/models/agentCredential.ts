import { and, desc, eq } from 'drizzle-orm';

import type { AgentCredentialItem, NewAgentCredential } from '../schemas';
import { agentCredentials } from '../schemas';
import type { LobeChatDatabase } from '../type';

interface GateKeeper {
  decrypt: (ciphertext: string) => Promise<{ plaintext: string }>;
  encrypt: (plaintext: string) => Promise<string>;
}

export interface DecryptedAgentCredential extends Omit<
  AgentCredentialItem,
  'credentials' | 'tokenExpiresAt'
> {
  credentials: Record<string, unknown>;
  tokenExpiresAt: Date | null;
}

export class AgentCredentialModel {
  private userId: string;
  private db: LobeChatDatabase;
  private gateKeeper?: GateKeeper;

  constructor(db: LobeChatDatabase, userId: string, gateKeeper?: GateKeeper) {
    this.userId = userId;
    this.db = db;
    this.gateKeeper = gateKeeper;
  }

  create = async (
    params: Omit<NewAgentCredential, 'credentials' | 'userId'> & {
      credentials?: Record<string, unknown>;
    },
  ) => {
    const credentials = await this.encrypt(params.credentials);

    const [result] = await this.db
      .insert(agentCredentials)
      .values({ ...params, credentials, userId: this.userId })
      .returning();

    return this.decryptRow(result);
  };

  delete = async (id: string) => {
    return this.db
      .delete(agentCredentials)
      .where(and(eq(agentCredentials.id, id), eq(agentCredentials.userId, this.userId)));
  };

  findByAgentId = async (agentId: string) => {
    const results = await this.db
      .select()
      .from(agentCredentials)
      .where(and(eq(agentCredentials.agentId, agentId), eq(agentCredentials.userId, this.userId)))
      .orderBy(desc(agentCredentials.updatedAt));

    return Promise.all(results.map((item) => this.decryptRow(item)));
  };

  findByAgentIdAndProvider = async (agentId: string, provider: string) => {
    const [result] = await this.db
      .select()
      .from(agentCredentials)
      .where(
        and(
          eq(agentCredentials.agentId, agentId),
          eq(agentCredentials.provider, provider),
          eq(agentCredentials.userId, this.userId),
        ),
      )
      .limit(1);

    if (!result) return null;

    return this.decryptRow(result);
  };

  findById = async (id: string) => {
    const [result] = await this.db
      .select()
      .from(agentCredentials)
      .where(and(eq(agentCredentials.id, id), eq(agentCredentials.userId, this.userId)))
      .limit(1);

    if (!result) return null;

    return this.decryptRow(result);
  };

  query = async (params?: { agentId?: string; provider?: string }) => {
    const conditions = [eq(agentCredentials.userId, this.userId)];

    if (params?.agentId) {
      conditions.push(eq(agentCredentials.agentId, params.agentId));
    }

    if (params?.provider) {
      conditions.push(eq(agentCredentials.provider, params.provider));
    }

    const results = await this.db
      .select()
      .from(agentCredentials)
      .where(and(...conditions))
      .orderBy(desc(agentCredentials.updatedAt));

    return Promise.all(results.map((item) => this.decryptRow(item)));
  };

  update = async (
    id: string,
    value: Partial<Omit<AgentCredentialItem, 'credentials'>> & {
      credentials?: Record<string, unknown>;
    },
  ) => {
    const { credentials, ...rest } = value;
    const updateValue: Partial<AgentCredentialItem> = { ...rest };

    if (credentials !== undefined) {
      updateValue.credentials = await this.encrypt(credentials);
    }

    await this.db
      .update(agentCredentials)
      .set({ ...updateValue, updatedAt: new Date() })
      .where(and(eq(agentCredentials.id, id), eq(agentCredentials.userId, this.userId)));

    return this.findById(id);
  };

  private encrypt = async (credentials?: Record<string, unknown>): Promise<string | null> => {
    if (!credentials) return null;

    const json = JSON.stringify(credentials);
    if (!this.gateKeeper) return json;

    return this.gateKeeper.encrypt(json);
  };

  private decryptRow = async (row: AgentCredentialItem): Promise<DecryptedAgentCredential> => {
    if (!row.credentials) return { ...row, credentials: {} };

    try {
      const credentials = this.gateKeeper
        ? JSON.parse((await this.gateKeeper.decrypt(row.credentials)).plaintext)
        : JSON.parse(row.credentials);

      return { ...row, credentials };
    } catch {
      return { ...row, credentials: {} };
    }
  };
}

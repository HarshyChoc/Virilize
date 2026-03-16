import { boolean, index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { timestamps, timestamptz } from './_helpers';
import { agents } from './agent';
import { users } from './user';

export const agentCredentialAuthTypes = ['oauth', 'sandbox_session'] as const;

export type AgentCredentialAuthType = (typeof agentCredentialAuthTypes)[number];

export const agentCredentials = pgTable(
  'agent_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    agentId: text('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    provider: varchar('provider', { length: 50 }).notNull(),
    accountLabel: varchar('account_label', { length: 255 }),
    authType: varchar('auth_type', { length: 50 }).$type<AgentCredentialAuthType>().notNull(),
    credentials: text('credentials'),
    externalAccountId: varchar('external_account_id', { length: 255 }),
    scopes: text('scopes').array().default([]).notNull(),
    tokenExpiresAt: timestamptz('token_expires_at'),
    enabled: boolean('enabled').default(true).notNull(),

    ...timestamps,
  },
  (t) => [
    index('agent_credentials_agent_id_idx').on(t.agentId),
    index('agent_credentials_user_id_idx').on(t.userId),
    index('agent_credentials_provider_idx').on(t.provider),
  ],
);

export const insertAgentCredentialSchema = createInsertSchema(agentCredentials);

export type NewAgentCredential = typeof agentCredentials.$inferInsert;
export type AgentCredentialItem = typeof agentCredentials.$inferSelect;

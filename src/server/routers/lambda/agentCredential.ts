import { z } from 'zod';

import { AgentCredentialModel } from '@/database/models/agentCredential';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

const authTypeSchema = z.enum(['oauth', 'sandbox_session']);

const credentialValueSchema = z.union([z.boolean(), z.null(), z.number(), z.string()]);

const agentCredentialProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();

  return opts.next({
    ctx: {
      agentCredentialModel: new AgentCredentialModel(ctx.serverDB, ctx.userId, gateKeeper),
    },
  });
});

export const agentCredentialRouter = router({
  create: agentCredentialProcedure
    .input(
      z.object({
        accountLabel: z.string().max(255).optional(),
        agentId: z.string(),
        authType: authTypeSchema,
        credentials: z.record(credentialValueSchema).optional(),
        enabled: z.boolean().optional(),
        externalAccountId: z.string().max(255).optional(),
        provider: z.string().max(50),
        scopes: z.array(z.string()).optional(),
        tokenExpiresAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.agentCredentialModel.create(input);
    }),

  delete: agentCredentialProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.agentCredentialModel.delete(input.id);
    }),

  getByAgentId: agentCredentialProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.agentCredentialModel.findByAgentId(input.agentId);
    }),

  list: agentCredentialProcedure
    .input(
      z
        .object({
          agentId: z.string().optional(),
          provider: z.string().max(50).optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      return ctx.agentCredentialModel.query(input);
    }),

  update: agentCredentialProcedure
    .input(
      z.object({
        accountLabel: z.string().max(255).optional(),
        authType: authTypeSchema.optional(),
        credentials: z.record(credentialValueSchema).optional(),
        enabled: z.boolean().optional(),
        externalAccountId: z.string().max(255).optional(),
        id: z.string().uuid(),
        provider: z.string().max(50).optional(),
        scopes: z.array(z.string()).optional(),
        tokenExpiresAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...value } = input;
      return ctx.agentCredentialModel.update(id, value);
    }),
});

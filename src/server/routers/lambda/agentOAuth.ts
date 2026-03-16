import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  AgentCredentialService,
  isGoogleAgentOAuthEnabled,
} from '@/server/services/agentCredential';

const agentOAuthProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      agentCredentialService: new AgentCredentialService(ctx.serverDB, ctx.userId),
    },
  });
});

export const agentOAuthRouter = router({
  getProviders: agentOAuthProcedure.query(() => ({
    google: isGoogleAgentOAuthEnabled(),
  })),

  initiateOAuth: agentOAuthProcedure
    .input(
      z.object({
        agentId: z.string(),
        provider: z.literal('google'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const authorizationUrl = await ctx.agentCredentialService.createGoogleAuthorizationUrl(
        input.agentId,
      );

      return { authorizationUrl };
    }),
});

import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { serverDB } from '@/database/server';
import { AgentCredentialService } from '@/server/services/agentCredential';

const buildErrorUrl = (req: NextRequest, reason: string) => {
  const url = new URL('/oauth/callback/error', req.url);
  url.searchParams.set('reason', reason);
  return url;
};

export const GET = async (req: NextRequest) => {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(buildErrorUrl(req, 'missingCallbackParams'));
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user?.id) {
    return NextResponse.redirect(buildErrorUrl(req, 'notAuthenticated'));
  }

  const service = new AgentCredentialService(serverDB, session.user.id);

  try {
    const parsed = service.parseGoogleOAuthState(state);

    if (parsed.userId !== session.user.id) {
      return NextResponse.redirect(buildErrorUrl(req, 'invalidState'));
    }

    await service.upsertGoogleCredential({
      agentId: parsed.agentId,
      code,
    });

    const successUrl = new URL('/oauth/callback/success', req.url);
    successUrl.searchParams.set('agentId', parsed.agentId);
    successUrl.searchParams.set('agent_oauth', '1');
    successUrl.searchParams.set('provider', 'google');

    return NextResponse.redirect(successUrl);
  } catch (error) {
    const errorUrl = buildErrorUrl(req, 'oauthCallbackFailed');
    errorUrl.searchParams.set('errorMessage', (error as Error).message);
    return NextResponse.redirect(errorUrl);
  }
};

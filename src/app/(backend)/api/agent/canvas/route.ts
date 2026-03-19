import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { AgentModel } from '@/database/models/agent';
import { serverDB } from '@/database/server';
import { DesktopSandboxService } from '@/server/services/sandbox/desktopSandbox';

export const GET = async (req: NextRequest) => {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get('agentId');
  const viewOnly = req.nextUrl.searchParams.get('viewOnly') !== '0';

  if (!agentId) {
    return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
  }

  const agentModel = new AgentModel(serverDB, session.user.id);
  const agent = await agentModel.getAgentConfigById(agentId);
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const desktopSandbox = new DesktopSandboxService({
      agentId,
      userId: session.user.id,
    });

    const result = await desktopSandbox.getStreamUrl(viewOnly);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to create canvas stream' },
      { status: 500 },
    );
  }
};

class AgentCanvasService {
  getStream = async (params: { agentId: string; viewOnly?: boolean }) => {
    const searchParams = new URLSearchParams({
      agentId: params.agentId,
      viewOnly: params.viewOnly === false ? '0' : '1',
    });

    const response = await fetch(`/api/agent/canvas?${searchParams.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to load agent canvas');
    }

    return response.json() as Promise<{
      sandboxId: string;
      streamUrl: string;
      viewOnly: boolean;
    }>;
  };
}

export const agentCanvasService = new AgentCanvasService();

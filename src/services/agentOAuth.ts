import { lambdaClient } from '@/libs/trpc/client';

class AgentOAuthService {
  getProviders = async () => {
    return lambdaClient.agentOAuth.getProviders.query();
  };

  initiateOAuth = async (params: { agentId: string; provider: 'google' }) => {
    return lambdaClient.agentOAuth.initiateOAuth.mutate(params);
  };
}

export const agentOAuthService = new AgentOAuthService();

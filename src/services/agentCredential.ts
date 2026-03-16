import { lambdaClient } from '@/libs/trpc/client';

class AgentCredentialService {
  getByAgentId = async (agentId: string) => {
    return lambdaClient.agentCredential.getByAgentId.query({ agentId });
  };

  create = async (params: {
    accountLabel?: string;
    agentId: string;
    authType: 'oauth' | 'sandbox_session';
    credentials?: Record<string, string | number | boolean | null>;
    enabled?: boolean;
    externalAccountId?: string;
    provider: string;
    scopes?: string[];
    tokenExpiresAt?: Date | null;
  }) => {
    return lambdaClient.agentCredential.create.mutate(params);
  };

  update = async (
    id: string,
    params: {
      accountLabel?: string;
      authType?: 'oauth' | 'sandbox_session';
      credentials?: Record<string, string | number | boolean | null>;
      enabled?: boolean;
      externalAccountId?: string;
      provider?: string;
      scopes?: string[];
      tokenExpiresAt?: Date | null;
    },
  ) => {
    return lambdaClient.agentCredential.update.mutate({ id, ...params });
  };

  delete = async (id: string) => {
    return lambdaClient.agentCredential.delete.mutate({ id });
  };
}

export const agentCredentialService = new AgentCredentialService();

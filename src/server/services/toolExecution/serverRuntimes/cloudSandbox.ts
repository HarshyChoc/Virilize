import {
  CloudSandboxExecutionRuntime,
  CloudSandboxIdentifier,
} from '@lobechat/builtin-tool-cloud-sandbox';

import { FileService } from '@/server/services/file';
import { PersistentSandboxService } from '@/server/services/sandbox/persistentSandbox';

import { type ServerRuntimeRegistration } from './types';

/**
 * CloudSandbox Server Runtime
 * Per-request runtime (needs topicId, userId)
 */
export const cloudSandboxRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.userId || !context.topicId || !context.agentId) {
      throw new Error('userId, agentId and topicId are required for Cloud Sandbox execution');
    }

    if (!context.serverDB) {
      throw new Error('serverDB is required for Cloud Sandbox execution');
    }

    const fileService = new FileService(context.serverDB, context.userId);
    const sandboxService = new PersistentSandboxService({
      agentId: context.agentId,
      fileService,
      topicId: context.topicId,
      userId: context.userId,
    });

    return new CloudSandboxExecutionRuntime(sandboxService);
  },
  identifier: CloudSandboxIdentifier,
};

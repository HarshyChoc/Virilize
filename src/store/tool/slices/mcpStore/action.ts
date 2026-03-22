import { isDesktop } from '@lobechat/const';
import { type LobeChatPluginManifest } from '@lobehub/chat-plugin-sdk';
import { type PluginListResponse } from '@lobehub/market-sdk';
import debug from 'debug';
import { uniqBy } from 'es-toolkit/compat';
import { produce } from 'immer';
import { type SWRResponse } from 'swr';
import useSWR from 'swr';

import { parseStdioErrorMessage } from '@/libs/mcp/types';
import { mcpService } from '@/services/mcp';
import { pluginService } from '@/services/plugin';
import { globalHelpers } from '@/store/global/helpers';
import { mcpStoreSelectors } from '@/store/tool/selectors';
import { type StoreSetter } from '@/store/types';
import { McpConnectionType } from '@/types/discover';
import {
  type McpConnectionParams,
  type MCPInstallProgress,
  type MCPPluginListParams,
} from '@/types/plugins';
import { setNamespace } from '@/utils/storeDebug';

import { type ToolStore } from '../../store';
import { type MCPStoreState } from './initialState';

const log = debug('lobe-mcp:store:action');

const n = setNamespace('mcpStore');

const doesConfigSchemaRequireInput = (configSchema?: any) => {
  if (!configSchema) return false;

  const hasRequiredArray =
    Array.isArray(configSchema.required) && configSchema.required.some(Boolean);

  const hasRequiredProperty =
    !!configSchema.properties &&
    Object.values(configSchema.properties).some(
      (property: any) => property && property.required === true,
    );

  return hasRequiredArray || hasRequiredProperty;
};

const toNonEmptyStringRecord = (input?: Record<string, any>) => {
  if (!input) return undefined;

  const entries = Object.entries(input).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  if (entries.length === 0) return undefined;

  return entries.reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = typeof value === 'string' ? value : String(value);

    return acc;
  }, {});
};

/**
 * Build manifest for cloud MCP connection from market data
 */
const buildCloudMcpManifest = (params: {
  data: any;
  plugin: { description?: string; icon?: string; identifier: string };
}): LobeChatPluginManifest => {
  const { data, plugin } = params;

  log('Using cloud connection, building manifest from market data');

  // Get tools (MCP format) or api (LobeChat format) from data
  const mcpTools = data.tools;
  const lobeChatApi = data.api;

  // If MCP format tools, need to convert to LobeChat api format
  // MCP: { name, description, inputSchema }
  // LobeChat: { name, description, parameters }
  let apiArray: any[] = [];

  if (lobeChatApi) {
    // Already in LobeChat format, use directly
    apiArray = lobeChatApi;
    log('[Cloud MCP] Using existing LobeChat API format');
  } else if (mcpTools && Array.isArray(mcpTools)) {
    // Convert MCP tools format to LobeChat api format
    apiArray = mcpTools.map((tool: any) => ({
      description: tool.description || '',
      name: tool.name,
      parameters: tool.inputSchema || {},
    }));
    log('[Cloud MCP] Converted %d MCP tools to LobeChat API format', apiArray.length);
  } else {
    console.warn('[Cloud MCP] No tools or api found in manifest data');
  }

  // Build complete manifest
  const manifest: LobeChatPluginManifest = {
    api: apiArray,
    author: data.author?.name || data.author || '',
    createAt: data.createdAt || new Date().toISOString(),
    homepage: data.homepage || '',
    identifier: plugin.identifier,
    manifest: data.manifestUrl || '',
    meta: {
      avatar: data.icon || plugin.icon,
      description: plugin.description || data.description,
      tags: data.tags || [],
      title: data.name || plugin.identifier,
    },
    name: data.name || plugin.identifier,
    type: 'mcp',
    version: data.version,
  } as unknown as LobeChatPluginManifest;

  log('[Cloud MCP] Final manifest built:', {
    apiCount: manifest.api?.length,
    identifier: manifest.identifier,
    version: manifest.version,
  });

  return manifest;
};

// Test connection result type
export interface TestMcpConnectionResult {
  error?: string;
  /** STDIO process output logs for debugging */
  errorLog?: string;
  manifest?: LobeChatPluginManifest;
  success: boolean;
}

type Setter = StoreSetter<ToolStore>;
export const createMCPPluginStoreSlice = (set: Setter, get: () => ToolStore, _api?: unknown) =>
  new PluginMCPStoreActionImpl(set, get, _api);

export class PluginMCPStoreActionImpl {
  readonly #get: () => ToolStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => ToolStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  cancelInstallMCPPlugin = async (identifier: string): Promise<void> => {
    // Get and cancel AbortController
    const abortController = this.#get().mcpInstallAbortControllers[identifier];
    if (abortController) {
      abortController.abort();

      // Clean up AbortController storage
      this.#set(
        produce((draft: MCPStoreState) => {
          delete draft.mcpInstallAbortControllers[identifier];
        }),
        false,
        n('cancelInstallMCPPlugin/clearController'),
      );
    }

    // Clean up installation progress and loading state
    this.#get().updateMCPInstallProgress(identifier, undefined);
    this.#get().updateInstallLoadingState(identifier, undefined);
  };

  cancelMcpConnectionTest = (identifier: string): void => {
    const abortController = this.#get().mcpTestAbortControllers[identifier];
    if (abortController) {
      abortController.abort();

      // Clean up state
      this.#set(
        produce((draft: MCPStoreState) => {
          draft.mcpTestLoading[identifier] = false;
          delete draft.mcpTestAbortControllers[identifier];
          delete draft.mcpTestErrors[identifier];
        }),
        false,
        n('cancelMcpConnectionTest'),
      );
    }
  };

  installMCPPlugin = async (
    identifier: string,
    options: { config?: Record<string, any>; resume?: boolean; skipDepsCheck?: boolean } = {},
  ): Promise<boolean | undefined> => {
    const { config } = options;
    const normalizedConfig = toNonEmptyStringRecord(config);
    const plugin = mcpStoreSelectors.getPluginById(identifier)(this.#get());

    void normalizedConfig;
    void plugin;

    const { updateInstallLoadingState, updateMCPInstallProgress } = this.#get();
    updateMCPInstallProgress(identifier, undefined);
    updateInstallLoadingState(identifier, undefined);

    return false;
  };

  loadMoreMCPPlugins = (): void => {
    const { mcpPluginItems, totalCount, currentPage } = this.#get();

    // Check if there's more data to load
    if (mcpPluginItems.length < (totalCount || 0)) {
      this.#set(
        produce((draft: MCPStoreState) => {
          draft.currentPage = currentPage + 1;
        }),
        false,
        n('loadMoreMCPPlugins'),
      );
    }
  };

  resetMCPPluginList = (keywords?: string): void => {
    this.#set(
      produce((draft: MCPStoreState) => {
        draft.mcpPluginItems = [];
        draft.currentPage = 1;
        draft.mcpSearchKeywords = keywords;
        draft.isMcpListInit = false;
      }),
      false,
      n('resetMCPPluginList'),
    );
  };

  testMcpConnection = async (params: McpConnectionParams): Promise<TestMcpConnectionResult> => {
    const { identifier, connection, metadata } = params;

    // Create AbortController for canceling test
    const abortController = new AbortController();

    // Store AbortController and set loading state
    this.#set(
      produce((draft: MCPStoreState) => {
        draft.mcpTestAbortControllers[identifier] = abortController;
        draft.mcpTestLoading[identifier] = true;
        draft.mcpTestErrors[identifier] = '';
      }),
      false,
      n('testMcpConnection/start'),
    );

    try {
      let manifest: LobeChatPluginManifest;

      if (connection.type === 'http') {
        if (!connection.url) {
          throw new Error('URL is required for HTTP connection');
        }

        manifest = await mcpService.getStreamableMcpServerManifest(
          {
            auth: connection.auth,
            headers: connection.headers,
            identifier,
            metadata,
            url: connection.url,
          },
          abortController.signal,
        );
      } else if (connection.type === 'stdio') {
        if (!connection.command) {
          throw new Error('Command is required for STDIO connection');
        }

        manifest = await mcpService.getStdioMcpServerManifest(
          {
            args: connection.args,
            command: connection.command,
            env: connection.env,
            name: identifier,
          },
          metadata,
          abortController.signal,
        );
      } else {
        throw new Error('Invalid MCP connection type');
      }

      // Check if already cancelled
      if (abortController.signal.aborted) {
        return { error: 'Test cancelled', success: false };
      }

      // Clean up state
      this.#set(
        produce((draft: MCPStoreState) => {
          draft.mcpTestLoading[identifier] = false;
          delete draft.mcpTestAbortControllers[identifier];
          delete draft.mcpTestErrors[identifier];
        }),
        false,
        n('testMcpConnection/success'),
      );

      return { manifest, success: true };
    } catch (error) {
      // Silently handle errors caused by cancellation
      if (abortController.signal.aborted) {
        return { error: 'Test cancelled', success: false };
      }

      const rawErrorMessage = error instanceof Error ? error.message : String(error);

      // Parse STDIO error message to extract process output logs
      const { originalMessage, errorLog } = parseStdioErrorMessage(rawErrorMessage);

      // Set error state
      this.#set(
        produce((draft: MCPStoreState) => {
          draft.mcpTestLoading[identifier] = false;
          draft.mcpTestErrors[identifier] = originalMessage;
          delete draft.mcpTestAbortControllers[identifier];
        }),
        false,
        n('testMcpConnection/error'),
      );

      return { error: originalMessage, errorLog, success: false };
    }
  };

  uninstallMCPPlugin = async (identifier: string): Promise<void> => {
    await pluginService.uninstallPlugin(identifier);
    await this.#get().refreshPlugins();
  };

  updateMCPInstallProgress = (
    identifier: string,
    progress: MCPInstallProgress | undefined,
  ): void => {
    this.#set(
      produce((draft: MCPStoreState) => {
        draft.mcpInstallProgress[identifier] = progress;
      }),
      false,
      n(`updateMCPInstallProgress/${progress?.step || 'clear'}`),
    );
  };

  useFetchMCPPluginList = (params: MCPPluginListParams): SWRResponse<PluginListResponse> => {
    const locale = globalHelpers.getCurrentLanguage();
    const requestParams = isDesktop
      ? params
      : { ...params, connectionType: McpConnectionType.http };
    const swrKeyParts = [
      'useFetchMCPPluginList',
      locale,
      requestParams.page,
      requestParams.pageSize,
      requestParams.q,
      requestParams.connectionType,
    ];
    const swrKey = swrKeyParts
      .filter((part) => part !== undefined && part !== null && part !== '')
      .join('-');
    const page = requestParams.page ?? 1;

    return useSWR<PluginListResponse>(
      swrKey,
      async () =>
        ({
          categories: [],
          currentPage: page,
          items: [],
          pageSize: requestParams.pageSize ?? 20,
          totalCount: 0,
          totalPages: 0,
        }) as PluginListResponse,
      {
        onSuccess: (data) => {
          this.#set(
            produce((draft: MCPStoreState) => {
              draft.searchLoading = false;

              // Set basic information
              if (!draft.isMcpListInit) {
                draft.activeMCPIdentifier = data.items?.[0]?.identifier;

                draft.isMcpListInit = true;
                draft.categories = data.categories;
                draft.totalCount = data.totalCount;
                draft.totalPages = data.totalPages;
              }

              // Accumulate data logic
              if (page === 1) {
                // First page, set directly
                draft.mcpPluginItems = uniqBy(data.items, 'identifier');
              } else {
                // Subsequent pages, accumulate data
                draft.mcpPluginItems = uniqBy(
                  [...draft.mcpPluginItems, ...data.items],
                  'identifier',
                );
              }
            }),
            false,
            n('useFetchMCPPluginList/onSuccess'),
          );
        },
        revalidateOnFocus: false,
      },
    );
  };
}

export type PluginMCPStoreAction = Pick<PluginMCPStoreActionImpl, keyof PluginMCPStoreActionImpl>;

import { type LobeTool } from '@lobechat/types';

import { type DecryptedAgentCredential } from '@/database/models/agentCredential';
import { googleConnectorsEnv } from '@/envs/google-connectors';
import { type MCPClientParams } from '@/libs/mcp';
import { mcpService } from '@/server/services/mcp';

type AgentCredentialsMap = Record<string, DecryptedAgentCredential | undefined>;
type GoogleConnectorEnvKey =
  | 'GOOGLE_CONNECTOR_CALENDAR_URL'
  | 'GOOGLE_CONNECTOR_DOCS_URL'
  | 'GOOGLE_CONNECTOR_DRIVE_URL'
  | 'GOOGLE_CONNECTOR_GMAIL_URL'
  | 'GOOGLE_CONNECTOR_SHEETS_URL'
  | 'GOOGLE_CONNECTOR_SLIDES_URL'
  | 'GOOGLE_CONNECTOR_YOUTUBE_URL';

interface GoogleConnectorDefinition {
  description: string;
  envKey: GoogleConnectorEnvKey;
  identifier: string;
  title: string;
}

const NO_GOOGLE_ACCOUNT_ERROR =
  'This agent has no Google account connected. Connect one in Agent Settings > Connected Accounts.';

const GOOGLE_CONNECTOR_DEFINITIONS: GoogleConnectorDefinition[] = [
  {
    description: 'Read, search, and manage Gmail through the self-hosted Google connector.',
    envKey: 'GOOGLE_CONNECTOR_GMAIL_URL',
    identifier: 'virilize-gmail',
    title: 'Google Gmail',
  },
  {
    description: 'Read and manage Google Drive files through the self-hosted Google connector.',
    envKey: 'GOOGLE_CONNECTOR_DRIVE_URL',
    identifier: 'virilize-drive',
    title: 'Google Drive',
  },
  {
    description: 'Read and manage Google Calendar through the self-hosted Google connector.',
    envKey: 'GOOGLE_CONNECTOR_CALENDAR_URL',
    identifier: 'virilize-calendar',
    title: 'Google Calendar',
  },
  {
    description: 'Read and manage Google Docs through the self-hosted Google connector.',
    envKey: 'GOOGLE_CONNECTOR_DOCS_URL',
    identifier: 'virilize-docs',
    title: 'Google Docs',
  },
  {
    description: 'Read and manage Google Sheets through the self-hosted Google connector.',
    envKey: 'GOOGLE_CONNECTOR_SHEETS_URL',
    identifier: 'virilize-sheets',
    title: 'Google Sheets',
  },
  {
    description: 'Read and manage Google Slides through the self-hosted Google connector.',
    envKey: 'GOOGLE_CONNECTOR_SLIDES_URL',
    identifier: 'virilize-slides',
    title: 'Google Slides',
  },
  {
    description: 'Read and manage YouTube data through the self-hosted Google connector.',
    envKey: 'GOOGLE_CONNECTOR_YOUTUBE_URL',
    identifier: 'virilize-youtube',
    title: 'YouTube',
  },
] as const;

const CONNECTOR_MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000;
const connectorManifestCache = new Map<string, { expiresAt: number; tool: LobeTool }>();

/**
 * Returns configured Google connector base URLs (without /mcp suffix).
 * Used for URL-based detection of Google connector MCP servers.
 */
function getConfiguredConnectorUrls(): string[] {
  return GOOGLE_CONNECTOR_DEFINITIONS.flatMap((definition) => {
    const url = googleConnectorsEnv[definition.envKey];
    return url ? [url.replace(/\/+$/, '')] : [];
  });
}

export class GoogleConnectorService {
  getConfiguredConnectorDefinitions() {
    return GOOGLE_CONNECTOR_DEFINITIONS.flatMap((definition) => {
      const url = googleConnectorsEnv[definition.envKey];

      if (!url) return [];

      return [{ ...definition, url: url.replace(/\/+$/, '') }];
    });
  }

  getConfiguredConnectorIds(): string[] {
    return this.getConfiguredConnectorDefinitions().map((item) => item.identifier);
  }

  async getConfiguredPluginTools(): Promise<LobeTool[]> {
    const configured = this.getConfiguredConnectorDefinitions();
    const now = Date.now();

    const results = await Promise.all(
      configured.map(async (connector) => {
        const cacheKey = `${connector.identifier}:${connector.url}`;
        const cached = connectorManifestCache.get(cacheKey);

        if (cached && cached.expiresAt > now) return cached.tool;

        try {
          const manifest = await mcpService.getStreamableMcpServerManifest(
            connector.identifier,
            `${connector.url}/mcp`,
            {
              avatar: 'https://www.google.com/favicon.ico',
              description: connector.description,
              name: connector.title,
            },
          );

          const tool: LobeTool = {
            customParams: {
              mcp: {
                type: 'http',
                url: `${connector.url}/mcp`,
              },
            },
            identifier: connector.identifier,
            manifest,
            runtimeType: 'mcp',
            source: 'plugin',
            type: 'plugin',
          };

          connectorManifestCache.set(cacheKey, {
            expiresAt: now + CONNECTOR_MANIFEST_CACHE_TTL_MS,
            tool,
          });

          return tool;
        } catch (error) {
          console.error(
            'Failed to load Google connector manifest for %s: %O',
            connector.url,
            error,
          );
          return undefined;
        }
      }),
    );

    return results.filter((item): item is LobeTool => !!item);
  }

  /**
   * Detect if MCP params point to a Google connector by URL match.
   * Works regardless of what identifier the user chose when adding the plugin.
   */
  isGoogleConnectorByUrl(mcpParams: MCPClientParams): boolean {
    if (mcpParams.type !== 'http') return false;
    const connectorUrls = getConfiguredConnectorUrls();
    const normalizedUrl = mcpParams.url.replace(/\/+$/, '').replace(/\/mcp\/?$/, '');
    return connectorUrls.includes(normalizedUrl);
  }

  /**
   * Inject x-auth-data header into existing MCP params for Google connector calls.
   * Returns new params object (does not mutate the original).
   */
  injectCredentials(
    mcpParams: MCPClientParams,
    agentCredentials: AgentCredentialsMap,
  ): MCPClientParams {
    if (mcpParams.type !== 'http') return mcpParams;

    const credential = agentCredentials['google'];
    const accessToken = credential?.credentials.accessToken;

    if (!credential || typeof accessToken !== 'string' || !accessToken) {
      throw new Error(NO_GOOGLE_ACCOUNT_ERROR);
    }

    const authData = Buffer.from(JSON.stringify({ access_token: accessToken })).toString('base64');

    return {
      ...mcpParams,
      headers: {
        ...mcpParams.headers,
        'x-auth-data': authData,
      },
    };
  }
}

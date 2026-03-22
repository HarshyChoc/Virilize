import { type DecryptedAgentCredential } from '@/database/models/agentCredential';
import { googleConnectorsEnv } from '@/envs/google-connectors';
import { type MCPClientParams } from '@/libs/mcp';

type AgentCredentialsMap = Record<string, DecryptedAgentCredential | undefined>;

const NO_GOOGLE_ACCOUNT_ERROR =
  'This agent has no Google account connected. Connect one in Agent Settings > Connected Accounts.';

/**
 * Returns configured Google connector base URLs (without /mcp suffix).
 * Used for URL-based detection of Google connector MCP servers.
 */
function getConfiguredConnectorUrls(): string[] {
  const urls: string[] = [];
  const envKeys = [
    'GOOGLE_CONNECTOR_GMAIL_URL',
    'GOOGLE_CONNECTOR_DRIVE_URL',
    'GOOGLE_CONNECTOR_CALENDAR_URL',
    'GOOGLE_CONNECTOR_YOUTUBE_URL',
  ] as const;

  for (const key of envKeys) {
    const url = googleConnectorsEnv[key];
    if (url) urls.push(url.replace(/\/+$/, ''));
  }
  return urls;
}

export class GoogleConnectorService {
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

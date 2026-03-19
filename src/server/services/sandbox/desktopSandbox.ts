import { Sandbox } from '@e2b/desktop';
import debug from 'debug';

import { e2bEnv } from '@/envs/e2b';

const log = debug('lobe-server:desktop-sandbox-service');

const desktopSandboxCache = new Map<string, Sandbox>();

interface DesktopSandboxServiceOptions {
  agentId: string;
  userId: string;
}

export class DesktopSandboxService {
  private agentId: string;
  private userId: string;

  constructor(options: DesktopSandboxServiceOptions) {
    this.agentId = options.agentId;
    this.userId = options.userId;
  }

  private get cacheKey() {
    return `${this.userId}:${this.agentId}:desktop`;
  }

  private ensureConfigured() {
    if (!e2bEnv.E2B_API_KEY) {
      throw new Error('E2B_API_KEY is not configured');
    }
  }

  private async getDesktop(): Promise<Sandbox> {
    this.ensureConfigured();

    const cached = desktopSandboxCache.get(this.cacheKey);
    if (cached) {
      try {
        if (await cached.isRunning()) {
          await cached.setTimeout(e2bEnv.E2B_TIMEOUT_MS);
          return cached;
        }
      } catch (error) {
        log('Cached desktop sandbox unusable for %s: %O', this.cacheKey, error);
      }
      desktopSandboxCache.delete(this.cacheKey);
    }

    const paginator = Sandbox.list({
      query: {
        metadata: {
          agentId: this.agentId,
          sandboxType: 'desktop',
          userId: this.userId,
        },
        state: ['running', 'paused'],
      },
    });
    const items = await paginator.nextItems();
    const existing = items[0];

    const desktop = existing
      ? await Sandbox.connect(existing.sandboxId, {
          timeoutMs: e2bEnv.E2B_TIMEOUT_MS,
        })
      : await Sandbox.create({
          lifecycle: {
            autoResume: true,
            onTimeout: 'pause',
          },
          metadata: {
            agentId: this.agentId,
            sandboxType: 'desktop',
            userId: this.userId,
          },
          resolution: [1280, 800],
          timeoutMs: e2bEnv.E2B_TIMEOUT_MS,
        });

    await desktop.setTimeout(e2bEnv.E2B_TIMEOUT_MS);
    desktopSandboxCache.set(this.cacheKey, desktop);
    return desktop;
  }

  async getStreamUrl(viewOnly: boolean) {
    const desktop = await this.getDesktop();

    try {
      await desktop.launch('google-chrome');
      await desktop.wait(3000);
    } catch (error) {
      log('Failed to launch browser in desktop sandbox: %O', error);
    }

    try {
      await desktop.stream.start({ requireAuth: true });
    } catch (error) {
      log('Failed to start desktop stream on first attempt: %O', error);
      await desktop.stream.stop().catch((stopError) => {
        log('Failed to stop stale desktop stream: %O', stopError);
      });
      await desktop.stream.start({ requireAuth: true });
    }

    const authKey = desktop.stream.getAuthKey();

    return {
      sandboxId: desktop.sandboxId,
      streamUrl: desktop.stream.getUrl({ authKey, viewOnly }),
      viewOnly,
    };
  }
}

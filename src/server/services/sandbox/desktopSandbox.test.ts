// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsRunning = vi.fn();
const mockSetTimeout = vi.fn();
const mockLaunch = vi.fn();
const mockWait = vi.fn();
const mockStreamStart = vi.fn();
const mockStreamStop = vi.fn();
const mockStreamGetAuthKey = vi.fn();
const mockStreamGetUrl = vi.fn();

const mockDesktop = {
  isRunning: mockIsRunning,
  launch: mockLaunch,
  sandboxId: 'desktop-sandbox-1',
  setTimeout: mockSetTimeout,
  stream: {
    getAuthKey: mockStreamGetAuthKey,
    getUrl: mockStreamGetUrl,
    start: mockStreamStart,
    stop: mockStreamStop,
  },
  wait: mockWait,
};

const mockSandboxListNextItems = vi.fn();
const mockSandboxList = vi.fn(() => ({
  nextItems: mockSandboxListNextItems,
}));
const mockSandboxCreate = vi.fn(async () => mockDesktop);
const mockSandboxConnect = vi.fn(async () => mockDesktop);

vi.mock('@e2b/desktop', () => ({
  Sandbox: {
    connect: mockSandboxConnect,
    create: mockSandboxCreate,
    list: mockSandboxList,
  },
}));

vi.mock('@/envs/e2b', () => ({
  e2bEnv: {
    E2B_API_KEY: 'e2b-test-key',
    E2B_TIMEOUT_MS: 60_000,
  },
}));

describe('DesktopSandboxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSandboxListNextItems.mockResolvedValue([]);
    mockIsRunning.mockResolvedValue(true);
    mockSetTimeout.mockResolvedValue(undefined);
    mockLaunch.mockResolvedValue(undefined);
    mockWait.mockResolvedValue(undefined);
    mockStreamStart.mockResolvedValue(undefined);
    mockStreamStop.mockResolvedValue(undefined);
    mockStreamGetAuthKey.mockReturnValue('desktop-auth-key');
    mockStreamGetUrl.mockReturnValue('https://stream.example.test');
  });

  it('creates a desktop sandbox and returns an auth-protected stream URL', async () => {
    const { DesktopSandboxService } = await import('./desktopSandbox');

    const service = new DesktopSandboxService({
      agentId: 'agent-1',
      userId: 'user-1',
    });

    const result = await service.getStreamUrl(false);

    expect(mockSandboxCreate).toHaveBeenCalled();
    expect(mockLaunch).toHaveBeenCalledWith('google-chrome');
    expect(mockStreamStart).toHaveBeenCalledWith({ requireAuth: true });
    expect(mockStreamGetUrl).toHaveBeenCalledWith({
      authKey: 'desktop-auth-key',
      viewOnly: false,
    });
    expect(result).toEqual({
      sandboxId: 'desktop-sandbox-1',
      streamUrl: 'https://stream.example.test',
      viewOnly: false,
    });
  });

  it('restarts the VNC stream if the first start attempt fails', async () => {
    const { DesktopSandboxService } = await import('./desktopSandbox');

    mockStreamStart
      .mockRejectedValueOnce(new Error('already running'))
      .mockResolvedValueOnce(undefined);

    const service = new DesktopSandboxService({
      agentId: 'agent-2',
      userId: 'user-1',
    });

    await service.getStreamUrl(true);

    expect(mockStreamStop).toHaveBeenCalledTimes(1);
    expect(mockStreamStart).toHaveBeenNthCalledWith(1, { requireAuth: true });
    expect(mockStreamStart).toHaveBeenNthCalledWith(2, { requireAuth: true });
    expect(mockStreamGetUrl).toHaveBeenCalledWith({
      authKey: 'desktop-auth-key',
      viewOnly: true,
    });
  });
});

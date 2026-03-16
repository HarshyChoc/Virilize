// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunCode = vi.fn();
const mockCommandRun = vi.fn();
const mockFileList = vi.fn();
const mockFileRead = vi.fn();
const mockFileWrite = vi.fn();
const mockFileMakeDir = vi.fn();
const mockFileRename = vi.fn();
const mockCommandList = vi.fn();
const mockCommandConnect = vi.fn();
const mockCommandKill = vi.fn();
const mockIsRunning = vi.fn();
const mockSetTimeout = vi.fn();

const mockSandbox = {
  commands: {
    connect: mockCommandConnect,
    kill: mockCommandKill,
    list: mockCommandList,
    run: mockCommandRun,
  },
  files: {
    list: mockFileList,
    makeDir: mockFileMakeDir,
    read: mockFileRead,
    rename: mockFileRename,
    write: mockFileWrite,
  },
  isRunning: mockIsRunning,
  runCode: mockRunCode,
  sandboxId: 'sbx-test',
  setTimeout: mockSetTimeout,
};

const mockSandboxListNextItems = vi.fn();
const mockSandboxList = vi.fn(() => ({
  nextItems: mockSandboxListNextItems,
}));
const mockSandboxCreate = vi.fn(async () => mockSandbox);
const mockSandboxConnect = vi.fn(async () => mockSandbox);

vi.mock('@e2b/code-interpreter', () => ({
  CommandExitError: class extends Error {
    exitCode = 1;
    stderr = 'stderr';
    stdout = 'stdout';
  },
  FileType: {
    DIR: 'dir',
  },
  Sandbox: {
    connect: mockSandboxConnect,
    create: mockSandboxCreate,
    list: mockSandboxList,
  },
}));

vi.mock('@/envs/e2b', () => ({
  e2bEnv: {
    E2B_API_KEY: 'e2b-test-key',
    E2B_TEMPLATE: 'base',
    E2B_TIMEOUT_MS: 60_000,
  },
}));

describe('PersistentSandboxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSandboxListNextItems.mockResolvedValue([]);
    mockIsRunning.mockResolvedValue(true);
    mockSetTimeout.mockResolvedValue(undefined);
  });

  it('creates a new sandbox and executes code', async () => {
    const { PersistentSandboxService } = await import('./persistentSandbox');

    mockRunCode.mockResolvedValue({
      error: undefined,
      text: 'hello',
    });

    const service = new PersistentSandboxService({
      agentId: 'agent-1',
      fileService: {} as any,
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const result = await service.callTool('executeCode', {
      code: 'print("hello")',
      language: 'python',
    });

    expect(mockSandboxCreate).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.result.stdout).toBe('hello');
  });

  it('lists local files using the sandbox filesystem API', async () => {
    const { PersistentSandboxService } = await import('./persistentSandbox');

    mockFileList.mockResolvedValue([
      {
        modifiedTime: new Date('2026-03-16T00:00:00Z'),
        name: 'demo.txt',
        path: '/workspace/demo.txt',
        size: 12,
        type: 'file',
      },
    ]);

    const service = new PersistentSandboxService({
      agentId: 'agent-1',
      fileService: {} as any,
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const result = await service.callTool('listLocalFiles', {
      directoryPath: '/workspace',
    });

    expect(result.success).toBe(true);
    expect(result.result.files).toEqual([
      {
        isDirectory: false,
        modifiedAt: '2026-03-16T00:00:00.000Z',
        name: 'demo.txt',
        path: '/workspace/demo.txt',
        size: 12,
      },
    ]);
  });
});

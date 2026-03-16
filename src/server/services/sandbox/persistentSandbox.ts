import path from 'node:path';

import {
  CommandExitError,
  type CommandHandle,
  type CommandResult,
  type EntryInfo,
  FileType,
  Sandbox,
} from '@e2b/code-interpreter';
import {
  type ISandboxService,
  type SandboxCallToolResult,
  type SandboxExportFileResult,
} from '@lobechat/builtin-tool-cloud-sandbox';
import debug from 'debug';
import { sha256 } from 'js-sha256';
import mime from 'mime';

import { e2bEnv } from '@/envs/e2b';
import { FileS3 } from '@/server/modules/S3';
import { type FileService } from '@/server/services/file';

const log = debug('lobe-server:persistent-sandbox-service');

const DEFAULT_SANDBOX_TEMPLATE = e2bEnv.E2B_TEMPLATE;

const backgroundCommands = new Map<
  string,
  {
    handle: CommandHandle;
    pid: number;
    sandboxId: string;
    stderrOffset: number;
    stdoutOffset: number;
  }
>();

const sandboxCache = new Map<string, Sandbox>();

interface PersistentSandboxServiceOptions {
  agentId: string;
  fileService: FileService;
  topicId: string;
  userId: string;
}

const quoteShell = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

const toEntry = (entry: EntryInfo) => ({
  isDirectory: entry.type === FileType.DIR,
  modifiedAt: entry.modifiedTime?.toISOString(),
  name: entry.name,
  path: entry.path,
  size: entry.size,
});

export class PersistentSandboxService implements ISandboxService {
  private agentId: string;
  private fileService: FileService;
  private topicId: string;
  private userId: string;

  constructor(options: PersistentSandboxServiceOptions) {
    this.agentId = options.agentId;
    this.fileService = options.fileService;
    this.topicId = options.topicId;
    this.userId = options.userId;
  }

  private get cacheKey() {
    return `${this.userId}:${this.agentId}`;
  }

  private ensureConfigured() {
    if (!e2bEnv.E2B_API_KEY) {
      throw new Error('E2B_API_KEY is not configured');
    }
  }

  private async getSandbox(): Promise<Sandbox> {
    this.ensureConfigured();

    const cached = sandboxCache.get(this.cacheKey);
    if (cached) {
      try {
        if (await cached.isRunning()) {
          await cached.setTimeout(e2bEnv.E2B_TIMEOUT_MS);
          return cached;
        }
      } catch (error) {
        log('Cached sandbox unusable for %s: %O', this.cacheKey, error);
      }

      sandboxCache.delete(this.cacheKey);
    }

    const paginator = Sandbox.list({
      query: {
        metadata: {
          agentId: this.agentId,
          userId: this.userId,
        },
        state: ['running', 'paused'],
      },
    });

    const items = await paginator.nextItems();
    const existing = items[0];

    const sandbox = existing
      ? await Sandbox.connect(existing.sandboxId, {
          timeoutMs: e2bEnv.E2B_TIMEOUT_MS,
        })
      : DEFAULT_SANDBOX_TEMPLATE
        ? await Sandbox.create(DEFAULT_SANDBOX_TEMPLATE, {
            lifecycle: {
              autoResume: true,
              onTimeout: 'pause',
            },
            metadata: {
              agentId: this.agentId,
              topicId: this.topicId,
              userId: this.userId,
            },
            timeoutMs: e2bEnv.E2B_TIMEOUT_MS,
          })
        : await Sandbox.create({
            lifecycle: {
              autoResume: true,
              onTimeout: 'pause',
            },
            metadata: {
              agentId: this.agentId,
              topicId: this.topicId,
              userId: this.userId,
            },
            timeoutMs: e2bEnv.E2B_TIMEOUT_MS,
          });

    await sandbox.setTimeout(e2bEnv.E2B_TIMEOUT_MS);
    sandboxCache.set(this.cacheKey, sandbox);
    return sandbox;
  }

  private async getSandboxById(sandboxId: string) {
    this.ensureConfigured();

    const cached = Array.from(sandboxCache.values()).find((item) => item.sandboxId === sandboxId);
    if (cached) return cached;

    return Sandbox.connect(sandboxId, { timeoutMs: e2bEnv.E2B_TIMEOUT_MS });
  }

  private parseCommandId(commandId: string) {
    const [sandboxId, pidString] = commandId.split(':');
    const pid = Number(pidString);

    if (!sandboxId || !Number.isFinite(pid)) {
      throw new Error('Invalid commandId');
    }

    return { pid, sandboxId };
  }

  private buildCommandId(sandboxId: string, pid: number) {
    return `${sandboxId}:${pid}`;
  }

  private async getCommandResult(handle: CommandHandle): Promise<CommandResult> {
    try {
      return await handle.wait();
    } catch (error) {
      if (error instanceof CommandExitError) {
        return {
          error: error.error,
          exitCode: error.exitCode,
          stderr: error.stderr,
          stdout: error.stdout,
        };
      }

      throw error;
    }
  }

  private async runShell(command: string) {
    const sandbox = await this.getSandbox();
    return sandbox.commands.run(command, { timeoutMs: 60_000 });
  }

  async callTool(toolName: string, params: Record<string, any>): Promise<SandboxCallToolResult> {
    try {
      const sandbox = await this.getSandbox();

      switch (toolName) {
        case 'executeCode': {
          const execution = await sandbox.runCode(params.code, {
            language: params.language || 'python',
          });
          const stdout = execution.text || execution.logs.stdout.join('\n');
          const stderr = execution.error?.traceback || execution.logs.stderr.join('\n');

          return {
            result: {
              exitCode: execution.error ? 1 : 0,
              output: stdout,
              stderr,
              stdout,
            },
            success: !execution.error,
          };
        }

        case 'listLocalFiles': {
          const files = await sandbox.files.list(params.directoryPath);
          return { result: { files: files.map(toEntry) }, success: true };
        }

        case 'readLocalFile': {
          const content = await sandbox.files.read(params.path);
          const lines = content.split('\n');
          const start = params.startLine ? Math.max(params.startLine - 1, 0) : 0;
          const end = params.endLine ? params.endLine : lines.length;
          const sliced = lines.slice(start, end).join('\n');

          return {
            result: {
              content: sliced,
              totalLines: lines.length,
            },
            success: true,
          };
        }

        case 'writeLocalFile': {
          await sandbox.files.write(params.path, params.content);
          return {
            result: {
              bytesWritten: Buffer.byteLength(params.content),
            },
            success: true,
          };
        }

        case 'editLocalFile': {
          const original = await sandbox.files.read(params.path);
          if (!original.includes(params.search)) {
            return {
              error: { message: 'Search text not found' },
              result: null,
              success: false,
            };
          }

          const next = params.all
            ? original.split(params.search).join(params.replace)
            : original.replace(params.search, params.replace);

          await sandbox.files.write(params.path, next);

          return {
            result: {
              linesAdded: Math.max(next.split('\n').length - original.split('\n').length, 0),
              linesDeleted: Math.max(original.split('\n').length - next.split('\n').length, 0),
              replacements: params.all ? original.split(params.search).length - 1 : 1,
            },
            success: true,
          };
        }

        case 'searchLocalFiles': {
          const findArgs = [quoteShell(params.directory || '.')];
          if (params.keyword) {
            findArgs.push(`-iname ${quoteShell(`*${params.keyword}*`)}`);
          }
          if (params.fileType) {
            const ext = params.fileType.startsWith('.') ? params.fileType : `.${params.fileType}`;
            findArgs.push(`-name ${quoteShell(`*${ext}`)}`);
          }
          if (params.modifiedAfter) {
            findArgs.push(`-newermt ${quoteShell(params.modifiedAfter)}`);
          }
          if (params.modifiedBefore) {
            findArgs.push(`! -newermt ${quoteShell(params.modifiedBefore)}`);
          }

          const result = await this.runShell(`find ${findArgs.join(' ')}`);
          const paths = result.stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

          const entries = paths.map((entryPath) => ({
            isDirectory: false,
            modifiedAt: undefined,
            name: path.basename(entryPath),
            path: entryPath,
            size: undefined,
          }));

          return {
            result: {
              results: entries,
              totalCount: entries.length,
            },
            success: true,
          };
        }

        case 'moveLocalFiles': {
          const results = [];
          for (const operation of params.operations || []) {
            try {
              await sandbox.files.makeDir(path.dirname(operation.destination));
              await sandbox.files.rename(operation.source, operation.destination);
              results.push({
                destination: operation.destination,
                source: operation.source,
                success: true,
              });
            } catch (error) {
              results.push({
                destination: operation.destination,
                error: (error as Error).message,
                source: operation.source,
                success: false,
              });
            }
          }

          return {
            result: {
              results,
              successCount: results.filter((item) => item.success).length,
              totalCount: results.length,
            },
            success: true,
          };
        }

        case 'renameLocalFile': {
          const newPath = path.join(path.dirname(params.oldPath), params.newName);
          await sandbox.files.rename(params.oldPath, newPath);
          return { result: { newPath, oldPath: params.oldPath, success: true }, success: true };
        }

        case 'globLocalFiles': {
          const directory = params.directory || '.';
          const command = `cd ${quoteShell(directory)} && find . -path ${quoteShell(params.pattern)} | sed 's#^./##'`;
          const result = await this.runShell(command);
          const files = result.stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          return {
            result: { files, pattern: params.pattern, totalCount: files.length },
            success: true,
          };
        }

        case 'runCommand': {
          const commandResult = await sandbox.commands.run(params.command, {
            background: !!params.background,
            timeoutMs: params.timeout || 120_000,
          } as any);

          if (params.background) {
            const handle = commandResult as CommandHandle;
            const commandId = this.buildCommandId(sandbox.sandboxId, handle.pid);
            backgroundCommands.set(commandId, {
              handle,
              pid: handle.pid,
              sandboxId: sandbox.sandboxId,
              stderrOffset: 0,
              stdoutOffset: 0,
            });

            return {
              result: {
                commandId,
                output: handle.stdout,
                running: true,
                stderr: handle.stderr,
              },
              success: true,
            };
          }

          const result = commandResult as CommandResult;
          return {
            result: {
              exitCode: result.exitCode,
              output: result.stdout,
              stderr: result.stderr,
              stdout: result.stdout,
            },
            success: result.exitCode === 0,
          };
        }

        case 'getCommandOutput': {
          const { pid, sandboxId } = this.parseCommandId(params.commandId);
          const sandboxForCommand = await this.getSandboxById(sandboxId);
          let tracked = backgroundCommands.get(params.commandId);
          if (!tracked) {
            const handle = await sandboxForCommand.commands.connect(pid);
            tracked = {
              handle,
              pid,
              sandboxId,
              stderrOffset: 0,
              stdoutOffset: 0,
            };
            backgroundCommands.set(params.commandId, tracked);
          }

          const processes = await sandboxForCommand.commands.list();
          const running = processes.some((process) => process.pid === pid);
          let exitCode: number | undefined;
          let error: string | undefined;

          if (!running) {
            const result = await this.getCommandResult(tracked.handle);
            exitCode = result.exitCode;
            error = result.error;
          }

          const newStdout = tracked.handle.stdout.slice(tracked.stdoutOffset);
          const newStderr = tracked.handle.stderr.slice(tracked.stderrOffset);
          tracked.stdoutOffset = tracked.handle.stdout.length;
          tracked.stderrOffset = tracked.handle.stderr.length;

          return {
            result: {
              exitCode,
              newOutput: [newStdout, newStderr].filter(Boolean).join('\n'),
              running,
              stderr: newStderr,
              stdout: newStdout,
            },
            success: !error,
          };
        }

        case 'killCommand': {
          const { pid, sandboxId } = this.parseCommandId(params.commandId);
          const sandboxForCommand = await this.getSandboxById(sandboxId);
          const success = await sandboxForCommand.commands.kill(pid);
          backgroundCommands.delete(params.commandId);
          return { result: { commandId: params.commandId, success }, success };
        }

        case 'grepContent': {
          const parts = [
            'grep',
            params.recursive === false ? '' : '-R',
            '-n',
            quoteShell(params.pattern),
            quoteShell(params.directory),
          ].filter(Boolean);

          const result = await this.runShell(parts.join(' '));
          const matches = result.stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [filePath, lineNumber, ...rest] = line.split(':');
              return {
                content: rest.join(':'),
                lineNumber: Number(lineNumber),
                path: filePath,
              };
            });

          return {
            result: {
              matches,
              pattern: params.pattern,
              totalMatches: matches.length,
            },
            success: true,
          };
        }

        default: {
          return {
            error: { message: `Unsupported sandbox tool: ${toolName}` },
            result: null,
            success: false,
          };
        }
      }
    } catch (error) {
      log('Persistent sandbox tool %s failed: %O', toolName, error);
      return {
        error: {
          message: (error as Error).message,
          name: (error as Error).name,
        },
        result: null,
        success: false,
      };
    }
  }

  async exportAndUploadFile(
    pathInSandbox: string,
    filename: string,
  ): Promise<SandboxExportFileResult> {
    try {
      const sandbox = await this.getSandbox();
      const bytes = await sandbox.files.read(pathInSandbox, { format: 'bytes' });
      const s3 = new FileS3();
      const today = new Date().toISOString().split('T')[0];
      const key = `code-interpreter-exports/${today}/${this.topicId}/${filename}`;
      const mimeType = mime.getType(filename) || 'application/octet-stream';

      await s3.uploadBuffer(key, Buffer.from(bytes), mimeType);

      const metadata = await s3.getFileMetadata(key);
      const fileHash = sha256(Buffer.from(bytes).toString('base64'));
      const { fileId, url } = await this.fileService.createFileRecord({
        fileHash,
        fileType: mimeType,
        name: filename,
        size: metadata.contentLength,
        url: key,
      });

      return {
        fileId,
        filename,
        mimeType,
        size: metadata.contentLength,
        success: true,
        url,
      };
    } catch (error) {
      log('Persistent sandbox export failed: %O', error);
      return {
        error: { message: (error as Error).message },
        filename,
        success: false,
      };
    }
  }
}

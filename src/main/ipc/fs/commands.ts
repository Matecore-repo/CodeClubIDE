import { app, ipcMain } from "electron";
import { exec, execFile } from "child_process";
import { getScanBinaryPath } from "../../indexer/scanner";
import { existsSync } from "fs";

const activeCommands = new Map<string, Set<ReturnType<typeof exec>>>();

export function registerCommandHandlers(): void {
  ipcMain.handle(
    "fs:execCommand",
    async (
      _event,
      command: string,
      cwd?: string,
      _useWsl?: boolean,
      _runId?: string,
      _timeoutMs: number = 30000,
    ) => {
      const root = cwd ?? app.getPath("home");
      const executable = getScanBinaryPath();
      if (!existsSync(executable)) {
        return new Promise((resolve) => {
          exec(command, { cwd: root, maxBuffer: 15 * 1024 * 1024 }, (error, stdout, stderr) => {
            resolve({ stdout, stderr, exitCode: error?.code ?? 0 });
          });
        });
      }
      const subagents = command.match(/^codeclub-engine subagents (\d+) "([^"]+)" (\S+)$/);
      if (subagents) {
        return new Promise((resolve) => {
          execFile(
            executable,
            ["subagents", subagents[1], subagents[2], subagents[3]],
            { cwd: root, maxBuffer: 15 * 1024 * 1024 },
            (error, stdout, stderr) => {
              resolve({
                stdout,
                stderr: stderr || error?.message || "",
                exitCode: error?.code ?? 0,
              });
            },
          );
        });
      }
      return new Promise((resolve) => {
        execFile(
          executable,
          ["exec", command, root],
          { maxBuffer: 15 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error) {
              resolve({ stdout: "", stderr: stderr || error.message, exitCode: error.code ?? 1 });
            } else {
              try {
                resolve(JSON.parse(stdout));
              } catch {
                resolve({ stdout, stderr, exitCode: 0 });
              }
            }
          },
        );
      });
    },
  );

  ipcMain.handle("fs:cancelRun", (_event, runId: string) => {
    const commands = activeCommands.get(runId);
    activeCommands.delete(runId);
    for (const child of commands ?? []) {
      if (process.platform === "win32" && child.pid) {
        execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
      } else child.kill("SIGTERM");
    }
  });
}

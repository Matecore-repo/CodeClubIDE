import { ipcMain, BrowserWindow } from "electron";
import { existsSync } from "fs";
import { spawn } from "node-pty";
import type { IPty } from "node-pty";

interface TerminalSession {
  pty: IPty;
  key: string;
  buffer: string;
  senderId: number;
}

const terminalMap = new Map<string, TerminalSession>();
const terminalByKey = new Map<string, string>();
const MAX_BUFFER = 200_000;

function detectShell(): string {
  if (process.platform === "win32") {
    const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
    if (existsSync(gitBash)) return gitBash;
    return "powershell.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

export function cleanupTerminals(): void {
  for (const session of terminalMap.values()) {
    try {
      if (process.platform === "win32") {
        session.pty.write("exit\r\n"); // Graceful exit avoids remove_pty_baton assertion
      } else {
        session.pty.kill();
      }
    } catch (e) {
      console.error("PTY cleanup error", e);
    }
  }
  terminalMap.clear();
  terminalByKey.clear();
}

export function registerTerminalHandlers(): void {
  ipcMain.handle("terminal:create", (event, cwd: string, useWsl?: boolean) => {
    const id = crypto.randomUUID();
    const key = `${id}`;
    let shellPath = detectShell();

    if (useWsl && process.platform === "win32") {
      shellPath = "wsl.exe";
    }

    const cols = 80;
    const rows = 24;
    const pty = spawn(shellPath, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>,
      useConpty: false,
    });

    const session: TerminalSession = { pty, key, buffer: "", senderId: event.sender.id };
    pty.onData((data) => {
      session.buffer = (session.buffer + data).slice(-MAX_BUFFER);
      const win = BrowserWindow.getAllWindows().find(
        (item) => item.webContents.id === session.senderId,
      );
      win?.webContents.send("terminal:data", id, data);
    });
    pty.onExit(() => {
      terminalMap.delete(id);
      terminalByKey.delete(key);
    });

    terminalMap.set(id, session);
    terminalByKey.set(key, id);
    return id;
  });

  ipcMain.handle("terminal:write", (_event, id: string, data: string) => {
    terminalMap.get(id)?.pty.write(data);
  });

  ipcMain.handle("terminal:kill", (_event, id: string) => {
    const session = terminalMap.get(id);
    if (session) {
      session.pty.kill();
      terminalMap.delete(id);
      terminalByKey.delete(session.key);
    }
  });

  ipcMain.handle("terminal:resize", (_event, id: string, cols: number, rows: number) => {
    terminalMap.get(id)?.pty.resize(cols, rows);
  });

  ipcMain.handle("terminal:attach", (event, id: string) => {
    const session = terminalMap.get(id);
    if (!session) return "";
    session.senderId = event.sender.id;
    return session.buffer;
  });
}

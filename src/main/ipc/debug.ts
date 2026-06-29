import { app, BrowserWindow, ipcMain } from "electron";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname, extname } from "path";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "child_process";
import { getScanBinaryPath } from "../indexer/scanner";

interface DebugConfig {
  workspacePath: string;
  program: string;
  adapter?: "python" | "rust";
  adapterCommand?: string[];
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  breakpoints?: Array<{ filePath: string; line: number; condition?: string }>;
}

interface Session {
  process: ChildProcessWithoutNullStreams;
  senderId: number;
  seq: number;
  pending: Map<number, (value: unknown) => void>;
  state: Record<string, unknown>;
  buffer: string;
}

const sessions = new Map<string, Session>();

function loadLaunchConfig(workspacePath: string): Partial<DebugConfig> {
  try {
    return JSON.parse(readFileSync(join(workspacePath, ".codeclub", "launch.json"), "utf-8"));
  } catch {
    return {};
  }
}

function detectAdapter(config: DebugConfig): {
  command?: string[];
  error?: string;
  adapter: "python" | "rust";
} {
  const adapter =
    config.adapter ?? (extname(config.program).toLowerCase() === ".py" ? "python" : "rust");
  if (config.adapterCommand?.length) return { adapter, command: config.adapterCommand };
  if (adapter === "python") {
    const venvPython =
      process.platform === "win32"
        ? join(config.workspacePath, ".venv", "Scripts", "python.exe")
        : join(config.workspacePath, ".venv", "bin", "python");
    const python = existsSync(venvPython)
      ? venvPython
      : process.platform === "win32"
        ? "python.exe"
        : "python3";
    const check = spawnSync(python, ["-c", "import debugpy"], { encoding: "utf-8" });
    return check.status === 0
      ? { adapter, command: [python, "-m", "debugpy.adapter"] }
      : { adapter, error: "debugpy no está instalado. Ejecutá: python -m pip install debugpy" };
  }
  const extensionRoot = join(app.getPath("home"), ".vscode", "extensions");
  const extensionBinary = (() => {
    try {
      const extension = readdirSync(extensionRoot)
        .filter((name) => name.startsWith("vadimcn.vscode-lldb-"))
        .sort()
        .at(-1);
      if (!extension) return null;
      const name = process.platform === "win32" ? "codelldb.exe" : "codelldb";
      const path = join(extensionRoot, extension, "adapter", name);
      return existsSync(path) ? path : null;
    } catch {
      return null;
    }
  })();
  if (extensionBinary) return { adapter, command: [extensionBinary] };
  const direct = process.platform === "win32" ? "codelldb.exe" : "codelldb";
  if (spawnSync(direct, ["--version"], { encoding: "utf-8" }).status === 0)
    return { adapter, command: [direct] };
  return {
    adapter,
    error:
      "CodeLLDB no está disponible. Instalá vadimcn.vscode-lldb o definí adapterCommand en .codeclub/launch.json.",
  };
}

function resolveRustProgram(config: DebugConfig): string {
  if (extname(config.program).toLowerCase() !== ".rs") return config.program;
  const manifest = join(config.workspacePath, "Cargo.toml");
  if (!existsSync(manifest)) return config.program;
  const build = spawnSync("cargo", ["build", "--manifest-path", manifest], {
    cwd: config.workspacePath,
    encoding: "utf-8",
  });
  if (build.status !== 0) throw new Error(build.stderr || "cargo build failed");
  const metadata = spawnSync(
    "cargo",
    ["metadata", "--format-version", "1", "--no-deps", "--manifest-path", manifest],
    { cwd: config.workspacePath, encoding: "utf-8" },
  );
  if (metadata.status !== 0) throw new Error(metadata.stderr || "cargo metadata failed");
  const parsed = JSON.parse(metadata.stdout);
  const packageName = parsed.packages?.[0]?.name?.replace(/-/g, "_");
  const extension = process.platform === "win32" ? ".exe" : "";
  return join(parsed.target_directory, "debug", `${packageName}${extension}`);
}

function request(
  session: Session,
  command: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const seq = ++session.seq;
  session.process.stdin.write(
    `${JSON.stringify({ seq, type: "request", command, arguments: args })}\n`,
  );
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      session.pending.delete(seq);
      resolve({ success: false, message: "DAP timeout" });
    }, 10000);
    session.pending.set(seq, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

async function initialize(
  session: Session,
  config: DebugConfig,
  adapter: "python" | "rust",
): Promise<void> {
  await request(session, "initialize", {
    clientID: "codeclub",
    adapterID: adapter,
    linesStartAt1: true,
    columnsStartAt1: true,
    pathFormat: "path",
  });

  if (adapter === "python") {
    await request(session, "launch", {
      program: config.program,
      args: config.args ?? [],
      cwd: config.cwd,
      env: config.env,
      console: "internalConsole",
      justMyCode: true,
    });
  } else {
    await request(session, "launch", {
      program: config.program,
      args: config.args ?? [],
      cwd: config.cwd,
      env: config.env,
      stopOnEntry: false,
    });
  }

  const grouped = new Map<string, Array<{ line: number; condition?: string }>>();
  for (const bp of config.breakpoints ?? [])
    grouped.set(bp.filePath, [
      ...(grouped.get(bp.filePath) ?? []),
      { line: bp.line, condition: bp.condition },
    ]);
  for (const [path, breakpoints] of grouped)
    await request(session, "setBreakpoints", { source: { path }, breakpoints });

  await request(session, "configurationDone");
}

export function registerDebugHandlers(): void {
  ipcMain.handle("debug:start", async (event, supplied: DebugConfig) => {
    const merged = {
      ...supplied,
      ...loadLaunchConfig(supplied.workspacePath),
      workspacePath: supplied.workspacePath,
    } as DebugConfig;
    merged.cwd ??= dirname(merged.program);
    try {
      const adapter =
        merged.adapter ?? (extname(merged.program).toLowerCase() === ".py" ? "python" : "rust");
      if (adapter === "rust") {
        merged.program = resolveRustProgram(merged);
      }
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
    const detected = detectAdapter(merged);
    if (!detected.command) return { ok: false, error: detected.error };
    const existing = sessions.get(merged.workspacePath);
    existing?.process.kill();
    const child = spawn(
      getScanBinaryPath(),
      ["dap-proxy", JSON.stringify(detected.command), merged.cwd],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const session: Session = {
      process: child,
      senderId: event.sender.id,
      seq: 0,
      pending: new Map(),
      state: { status: "starting", output: [] },
      buffer: "",
    };
    sessions.set(merged.workspacePath, session);
    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (data: string) => {
      session.buffer += data;
      let newline = session.buffer.indexOf("\n");
      while (newline >= 0) {
        const line = session.buffer.slice(0, newline).trim();
        session.buffer = session.buffer.slice(newline + 1);
        if (line) {
          try {
            const message = JSON.parse(line);
            if (message.type === "response") session.pending.get(message.request_seq)?.(message);
            if (message.type === "response") session.pending.delete(message.request_seq);
            if (message.type === "event") {
              const previousOutput = Array.isArray(session.state.output)
                ? (session.state.output as string[])
                : [];
              session.state = {
                ...session.state,
                status: message.event,
                lastEvent: message,
                output:
                  message.event === "output"
                    ? [...previousOutput.slice(-199), message.body?.output ?? ""]
                    : previousOutput,
              };
              const win = BrowserWindow.getAllWindows().find(
                (item) => item.webContents.id === session.senderId,
              );
              win?.webContents.send("debug:event", merged.workspacePath, message);
            }
          } catch {
            /* ignore malformed adapter output */
          }
        }
        newline = session.buffer.indexOf("\n");
      }
    });
    child.stderr.on("data", (data) => {
      const output = data.toString();
      session.state = { ...session.state, error: output };
      BrowserWindow.fromWebContents(event.sender)?.webContents.send(
        "debug:event",
        merged.workspacePath,
        { type: "event", event: "output", body: { category: "stderr", output } },
      );
    });
    child.on("exit", () => {
      sessions.delete(merged.workspacePath);
    });
    try {
      await initialize(session, merged, detected.adapter);
      return { ok: true, adapter: detected.adapter };
    } catch (error) {
      child.kill();
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    "debug:request",
    (_event, workspacePath: string, command: string, args?: Record<string, unknown>) => {
      const session = sessions.get(workspacePath);
      return session
        ? request(session, command, args)
        : { success: false, message: "No active debug session" };
    },
  );
  ipcMain.handle(
    "debug:state",
    (_event, workspacePath: string) => sessions.get(workspacePath)?.state ?? { status: "inactive" },
  );
  ipcMain.handle("debug:stop", async (_event, workspacePath: string) => {
    const session = sessions.get(workspacePath);
    if (!session) return;
    await request(session, "disconnect", { terminateDebuggee: true });
    session.process.kill();
    sessions.delete(workspacePath);
  });
}

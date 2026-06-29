import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const run = (cmd, args, env = {}) => {
  const p = spawn(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  return p;
};

console.log("Starting Vite+ Dev Server for renderer...");
const devServer = run("vp", ["dev"]);

console.log("Starting Vite+ Pack watch for main/preload...");
const packWatch = run("vp", ["pack", "--watch"]);

setTimeout(() => {
  console.log("Launching Electron...");

  // Create logs dir if not exists
  const logsDir = resolve(root, "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const logStream = fs.createWriteStream(resolve(logsDir, "electron.log"), { flags: "a" });

  const electronProc = spawn(resolve(root, "node_modules", ".bin", "electron.cmd"), ["."], {
    cwd: root,
    shell: true,
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: "http://localhost:5173",
      NODE_ENV: "development",
      ELECTRON_IS_DEV: "1",
    },
  });

  electronProc.stdout.pipe(logStream);
  electronProc.stderr.pipe(logStream);
  electronProc.stdout.pipe(process.stdout);
  electronProc.stderr.pipe(process.stderr);

  electronProc.on("exit", () => {
    process.exit();
  });
}, 3000);

process.on("exit", () => {
  devServer.kill();
  packWatch.kill();
});

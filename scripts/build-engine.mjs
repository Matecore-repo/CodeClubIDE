import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const engineDir = join(root, "rust-engine");
const binaryName = process.platform === "win32" ? "codeclub-engine.exe" : "codeclub-engine";
const release = process.argv.includes("--release");
const builtBinary = join(engineDir, "target", release ? "release" : "debug", binaryName);
const resourceDir = join(root, "resources", "bin");
const resourceBinary = join(resourceDir, binaryName);

const cargoBin = process.platform === "win32" ? "cargo.exe" : "cargo";
const result = spawnSync(cargoBin, release ? ["build", "--release"] : ["build"], {
  cwd: engineDir,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(builtBinary)) {
  console.error(`Missing built engine: ${builtBinary}`);
  process.exit(1);
}

mkdirSync(resourceDir, { recursive: true });
copyFileSync(builtBinary, resourceBinary);

for (const cachePath of [
  join(root, ".codeclub", "cache", "topographic.json"),
  join(root, ".codeclub", "index", "topographic.json"),
]) {
  if (existsSync(cachePath)) rmSync(cachePath, { force: true });
}

console.log(`Updated ${resourceBinary}`);

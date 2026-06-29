import { app, ipcMain } from "electron";
import { execFile } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, join, relative } from "path";
import { getScanBinaryPath } from "../../indexer/scanner";
import { minimatch } from "minimatch";

function binaryPath(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, "resources", "bin", name)
    : join(process.cwd(), "resources", "bin", name);
}

export function registerSearchHandlers(): void {
  ipcMain.handle("fs:grep", async (_event, pattern: string, searchPath?: string) => {
    const root = searchPath ?? app.getPath("home");
    const searchFile = (filePath: string) => {
      const regex = new RegExp(pattern, "gi");
      const name = basename(filePath);
      return readFileSync(filePath, "utf8")
        .split("\n")
        .flatMap((line, index) => {
          regex.lastIndex = 0;
          return regex.test(line) ? [`${name}:${index + 1}: ${line.trim().slice(0, 200)}`] : [];
        })
        .slice(0, 100);
    };
    if (existsSync(root) && statSync(root).isFile()) return searchFile(root);
    const executable = getScanBinaryPath();
    if (!existsSync(executable)) return fallback();
    return new Promise((resolve) =>
      execFile(
        executable,
        ["grep", root, pattern],
        { maxBuffer: 15 * 1024 * 1024 },
        (error, stdout) => {
          if (error && stdout.trim() === "") return resolve(fallback());
          resolve(stdout.split(/\r?\n/).filter(Boolean).slice(0, 100));
        },
      ),
    );
    function fallback() {
      const regex = new RegExp(pattern, "gi");
      const results: string[] = [];
      let total = 0;
      const walk = (dir: string) => {
        if (total >= 15000) return;
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            try {
              if (entry.isDirectory()) {
                if (!entry.name.startsWith(".") && entry.name !== "node_modules") walk(fullPath);
              } else {
                readFileSync(fullPath, "utf8")
                  .split("\n")
                  .forEach((line, index) => {
                    regex.lastIndex = 0;
                    if (results.length >= 100 || total >= 15000 || !regex.test(line)) return;
                    const match = `${relative(root, fullPath)}:${index + 1}: ${line.trim().slice(0, 200)}`;
                    results.push(match);
                    total += match.length;
                  });
              }
            } catch {
              /* unreadable */
            }
          }
        } catch {
          /* unreadable */
        }
      };
      walk(root);
      if (total >= 15000) results.push("\n...[TRUNCATED] Too many matches.");
      return results;
    }
  });

  ipcMain.handle("fs:glob", async (_event, pattern: string, basePath?: string) => {
    const root = basePath ?? app.getPath("home");
    const fallback = () => {
      const files: string[] = [];
      const walk = (dir: string) => {
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              if (!entry.name.startsWith(".") && entry.name !== "node_modules") walk(fullPath);
            } else {
              const rel = relative(root, fullPath);
              if (minimatch(rel, pattern, { dot: true, matchBase: false })) files.push(rel);
              if (files.length >= 100) return;
            }
          }
        } catch {
          /* unreadable */
        }
      };
      walk(root);
      return files;
    };
    const executable = binaryPath("glob.exe");
    if (!existsSync(executable)) return fallback();
    return new Promise((resolve) =>
      execFile(executable, [root], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        if (error) return resolve(fallback());
        resolve(
          stdout
            .split(/\r?\n/)
            .filter((line) => line && minimatch(line, pattern, { dot: true, matchBase: false }))
            .slice(0, 100),
        );
      }),
    );
  });

  ipcMain.handle("fs:topo", async (_event, basePath?: string, tracePath?: string) => {
    const root = basePath ?? app.getPath("home");
    const executable = binaryPath("topo.exe");
    if (!existsSync(executable)) return "Error: topo.exe binary not found.";
    const args = tracePath ? [root, "--trace", tracePath] : [root];
    return new Promise((resolve) =>
      execFile(executable, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) =>
        resolve(error ? `Error running topological analysis: ${error.message}` : stdout),
      ),
    );
  });
}

import "v8-compile-cache";
import { app, BrowserWindow, shell, nativeImage } from "electron";
import { join } from "path";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { registerIpcHandlers } from "./ipc";
import { cleanupTerminals } from "./ipc/terminal";

function getLogPath(): string {
  const logsDir = is.dev ? join(__dirname, "../../logs") : join(app.getPath("userData"), "logs");
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  return join(logsDir, "renderer.log");
}

function logToFile(level: string, message: string, source: string, line: number) {
  try {
    const ts = new Date().toISOString();
    appendFileSync(getLogPath(), `${ts} [${level}] ${message} (${source}:${line})\n`);
  } catch {}
}

app.on("before-quit", () => {
  cleanupTerminals();
});

function createWindow(): void {
  const iconPath = is.dev
    ? join(__dirname, "../../resources/icon.ico")
    : join(process.resourcesPath, "icon.ico");

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("FAIL LOAD:", code, desc);
  });

  mainWindow.webContents.on("console-message", (event: any) => {
    if (event.level < 2) return;
    const label = event.level === 2 ? "WARN" : "ERROR";
    logToFile(label, event.message, event.sourceId, event.line);
  });

  // mainWindow.webContents.on("before-input-event", (_e, input) => {
  //   if (input.type !== "keyDown") return;
  //   if (input.key === "F12") {
  //     mainWindow.webContents.toggleDevTools();
  //     return;
  //   }
  //   if (input.key === "I" && (input.control || input.meta) && input.shift) {
  //     mainWindow.webContents.toggleDevTools();
  //   }
  // });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED:", err);
});

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.codeclub");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

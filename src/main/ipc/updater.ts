import { ipcMain, BrowserWindow, app } from "electron";
import { autoUpdater } from "electron-updater";

export function registerUpdaterHandlers(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("update:available");
    });
  });

  autoUpdater.on("update-not-available", () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("update:not-available");
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("update:downloading", progressObj.percent);
    });
  });

  autoUpdater.on("update-downloaded", () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("update:downloaded");
    });
  });

  ipcMain.handle("update:check", (event) => {
    if (!app.isPackaged) {
      event.sender.send("update:not-available");
      return;
    }
    autoUpdater.checkForUpdatesAndNotify();
  });
}

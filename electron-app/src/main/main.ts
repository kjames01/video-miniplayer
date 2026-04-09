import { app, BrowserWindow } from 'electron';
import { WindowManager } from './windowManager';
import { setupIpcHandlers, getWindowService } from './ipcHandlers';
import { TrayManager } from './trayManager';

console.log('[Main] Starting app...');

let windowManager: WindowManager | null = null;
let trayManager: TrayManager | null = null;

// Skip single instance lock in test mode
const isTestMode = process.env.NODE_ENV === 'test';
const gotTheLock = isTestMode || app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Another instance is running, quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (windowManager) {
      const win = windowManager.getWindow();
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    }
  });

  app.whenReady().then(() => {
    console.log('[Main] App is ready, creating window...');
    windowManager = new WindowManager();
    windowManager.createWindow();
    console.log('[Main] Window created');

    setupIpcHandlers(windowManager);
    trayManager = new TrayManager(windowManager);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager?.createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    // Keep running in tray
  });

  app.on('before-quit', () => {
    getWindowService()?.unpinAll();
  });
}

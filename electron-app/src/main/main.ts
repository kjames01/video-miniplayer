import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { WindowManager } from './windowManager';
import { setupIpcHandlers, getYtdlpManager, getUrlCache } from './ipcHandlers';
import { TrayManager } from './trayManager';
import { LocalServer } from './localServer';

console.log('[Main] Starting app...');

let windowManager: WindowManager | null = null;
let trayManager: TrayManager | null = null;
let localServer: LocalServer | null = null;
let cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

// Skip single instance lock in test mode
const isTestMode = process.env.NODE_ENV === 'test';
console.log('[Main] isTestMode:', isTestMode);
const gotTheLock = isTestMode || app.requestSingleInstanceLock();
console.log('[Main] gotTheLock:', gotTheLock);

if (!gotTheLock) {
  console.log('[Main] Another instance is running, quitting...');
  app.quit();
} else {
  console.log('[Main] Got lock, setting up app...');
  app.on('second-instance', () => {
    // Focus window if someone tries to run a second instance
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
    // Create main window
    windowManager = new WindowManager();
    const mainWindow = windowManager.createWindow();
    console.log('[Main] Window created');

    // Setup IPC handlers
    setupIpcHandlers(windowManager);

    // Create system tray
    trayManager = new TrayManager(windowManager);

    // Start local HTTP server for extension communication
    localServer = new LocalServer(mainWindow);
    localServer.start();

    // Periodic cache cleanup every 60 minutes
    cacheCleanupInterval = setInterval(() => {
      getUrlCache()?.cleanup();
    }, 60 * 60 * 1000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager?.createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    // On Windows, keep the app running in tray
    // The tray manager will handle quit
  });

  app.on('before-quit', () => {
    localServer?.stop();
    getYtdlpManager()?.killAll();
    if (cacheCleanupInterval) {
      clearInterval(cacheCleanupInterval);
      cacheCleanupInterval = null;
    }
  });
}

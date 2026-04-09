import { ipcMain, app } from 'electron';
import { IPC_CHANNELS, AppSettings, WindowActionResult, WindowInfo } from '../shared/types';
import { MIN_RESIZE_WIDTH, MIN_RESIZE_HEIGHT, MAX_RESIZE_WIDTH, MAX_RESIZE_HEIGHT } from '../shared/constants';
import { WindowManager } from './windowManager';
import { WindowService } from './windowService';

let windowService: WindowService | null = null;
let settings: AppSettings = {
  alwaysOnTop: true,
};

export function getWindowService(): WindowService | null {
  return windowService;
}

export function setupIpcHandlers(windowManager: WindowManager): void {
  windowService = new WindowService();

  // Set own HWND so WindowService can exclude our window from enumeration
  const win = windowManager.getWindow();
  if (win) {
    windowService.setOwnHwnd(win.getNativeWindowHandle());
  }

  // Enumerate windows
  ipcMain.handle(IPC_CHANNELS.GET_WINDOWS, (): WindowInfo[] => {
    return windowService!.getWindows();
  });

  // Pin/unpin a window
  ipcMain.handle(IPC_CHANNELS.SET_TOPMOST, (_event, hwnd: number, topmost: boolean): WindowActionResult => {
    if (typeof hwnd !== 'number' || typeof topmost !== 'boolean') {
      return { success: false, error: 'Invalid parameters' };
    }
    const success = windowService!.setTopmost(hwnd, topmost);
    return success
      ? { success: true }
      : { success: false, error: 'Failed to modify window. It may be elevated or closed.' };
  });

  // Resize a window
  ipcMain.handle(IPC_CHANNELS.RESIZE_WINDOW, (_event, hwnd: number, width: number, height: number): WindowActionResult => {
    if (typeof hwnd !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
      return { success: false, error: 'Invalid parameters' };
    }
    if (width < MIN_RESIZE_WIDTH || height < MIN_RESIZE_HEIGHT || width > MAX_RESIZE_WIDTH || height > MAX_RESIZE_HEIGHT) {
      return { success: false, error: 'Dimensions out of range' };
    }
    const success = windowService!.resizeWindow(hwnd, width, height);
    return success
      ? { success: true }
      : { success: false, error: 'Failed to resize window.' };
  });

  // Focus a window
  ipcMain.handle(IPC_CHANNELS.FOCUS_WINDOW, (_event, hwnd: number): WindowActionResult => {
    if (typeof hwnd !== 'number') {
      return { success: false, error: 'Invalid hwnd' };
    }
    const success = windowService!.focusWindow(hwnd);
    return { success };
  });

  // Window controls (our own window)
  ipcMain.on(IPC_CHANNELS.MINIMIZE_WINDOW, () => {
    windowManager.minimize();
  });

  ipcMain.on(IPC_CHANNELS.CLOSE_WINDOW, () => {
    windowManager.destroy();
    app.quit();
  });

  ipcMain.on(IPC_CHANNELS.SET_ALWAYS_ON_TOP, (_event, value: boolean) => {
    if (typeof value !== 'boolean') return;
    windowManager.setAlwaysOnTop(value);
    settings.alwaysOnTop = value;
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, (): AppSettings => {
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, newSettings: Partial<AppSettings>) => {
    if (typeof newSettings === 'object' && newSettings !== null) {
      if (typeof newSettings.alwaysOnTop === 'boolean') {
        settings.alwaysOnTop = newSettings.alwaysOnTop;
      }
    }
  });
}

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, AppSettings, WindowActionResult, WindowInfo } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  getWindows: (): Promise<WindowInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_WINDOWS),

  setTopmost: (hwnd: number, topmost: boolean): Promise<WindowActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_TOPMOST, hwnd, topmost),

  resizeWindow: (hwnd: number, width: number, height: number): Promise<WindowActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESIZE_WINDOW, hwnd, width, height),

  focusWindow: (hwnd: number): Promise<WindowActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.FOCUS_WINDOW, hwnd),

  // Our window controls
  minimizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.MINIMIZE_WINDOW),
  closeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.CLOSE_WINDOW),
  setAlwaysOnTop: (value: boolean): void => ipcRenderer.send(IPC_CHANNELS.SET_ALWAYS_ON_TOP, value),

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  saveSettings: (settings: Partial<AppSettings>): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
});

// Type declarations for renderer
declare global {
  interface Window {
    electronAPI: {
      getWindows: () => Promise<WindowInfo[]>;
      setTopmost: (hwnd: number, topmost: boolean) => Promise<WindowActionResult>;
      resizeWindow: (hwnd: number, width: number, height: number) => Promise<WindowActionResult>;
      focusWindow: (hwnd: number) => Promise<WindowActionResult>;
      minimizeWindow: () => void;
      closeWindow: () => void;
      setAlwaysOnTop: (value: boolean) => void;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<void>;
    };
  }
}

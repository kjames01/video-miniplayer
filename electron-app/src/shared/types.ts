// Shared types for IPC communication between main and renderer

export interface WindowInfo {
  hwnd: number;
  title: string;
  className: string;
  processId: number;
  bounds: { x: number; y: number; width: number; height: number };
  isTopmost: boolean;
  isMinimized: boolean;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  alwaysOnTop: boolean;
}

export interface WindowActionResult {
  success: boolean;
  error?: string;
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Window management (Renderer -> Main, invoke)
  GET_WINDOWS: 'get-windows',
  SET_TOPMOST: 'set-topmost',
  RESIZE_WINDOW: 'resize-window',
  FOCUS_WINDOW: 'focus-window',

  // Our own window controls (Renderer -> Main, send)
  MINIMIZE_WINDOW: 'minimize-window',
  CLOSE_WINDOW: 'close-window',
  SET_ALWAYS_ON_TOP: 'set-always-on-top',

  // Settings (Renderer -> Main, invoke)
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
} as const;

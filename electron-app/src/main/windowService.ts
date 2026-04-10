import koffi from 'koffi';
import { WindowInfo } from '../shared/types';

// Win32 constants
const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_CAPTION = 0x00C00000;
const WS_THICKFRAME = 0x00040000;
const WS_EX_TOPMOST = 0x00000008;
const WS_EX_TOOLWINDOW = 0x00000080;
const SWP_NOMOVE = 0x0002;
const SWP_NOSIZE = 0x0001;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const MONITOR_DEFAULTTONEAREST = 0x00000002;

// HWND special values — passed as pointers via koffi
const HWND_TOPMOST = -1;
const HWND_NOTOPMOST = -2;

// System window class names to exclude
const EXCLUDED_CLASSES = new Set([
  'Progman',
  'WorkerW',
  'Shell_TrayWnd',
  'Shell_SecondaryTrayWnd',
  'Windows.UI.Core.CoreWindow',
  'DV2ControlHost',
  'MsgrIMEWindowClass',
  'SysShadow',
  'Button', // Start button
]);

// Define Win32 types and structs
const RECT = koffi.struct('RECT', {
  left: 'long',
  top: 'long',
  right: 'long',
  bottom: 'long',
});

const MONITORINFO = koffi.struct('MONITORINFO', {
  cbSize: 'uint32_t',
  rcMonitor: RECT,
  rcWork: RECT,
  dwFlags: 'uint32_t',
});

// Load user32.dll functions
const user32 = koffi.load('user32.dll');

const EnumWindows = user32.func('bool __stdcall EnumWindows(void *callback, intptr_t lParam)');
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(intptr_t hWnd, uint16_t *lpString, int nMaxCount)');
const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(intptr_t hWnd)');
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(intptr_t hWnd)');
const GetClassNameW = user32.func('int __stdcall GetClassNameW(intptr_t hWnd, uint16_t *lpClassName, int nMaxCount)');
const SetWindowPos = user32.func('bool __stdcall SetWindowPos(intptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)');
const GetWindowRect = user32.func('bool __stdcall GetWindowRect(intptr_t hWnd, RECT *lpRect)');
const IsIconic = user32.func('bool __stdcall IsIconic(intptr_t hWnd)');
const GetWindowLongW = user32.func('long __stdcall GetWindowLongW(intptr_t hWnd, int nIndex)');
const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(intptr_t hWnd, uint32_t *lpdwProcessId)');
const IsWindow = user32.func('bool __stdcall IsWindow(intptr_t hWnd)');
const SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(intptr_t hWnd)');
const ShowWindow = user32.func('bool __stdcall ShowWindow(intptr_t hWnd, int nCmdShow)');
const SetWindowLongW = user32.func('long __stdcall SetWindowLongW(intptr_t hWnd, int nIndex, long dwNewLong)');
const MonitorFromWindow = user32.func('intptr_t __stdcall MonitorFromWindow(intptr_t hWnd, uint32_t dwFlags)');
const GetMonitorInfoW = user32.func('bool __stdcall GetMonitorInfoW(intptr_t hMonitor, MONITORINFO *lpmi)');

// Callback type for EnumWindows
const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(intptr_t hWnd, intptr_t lParam)');

const SW_RESTORE = 9;

function getWindowText(hwnd: number): string {
  const len = GetWindowTextLengthW(hwnd);
  if (len === 0) return '';
  const buf = Buffer.alloc((len + 1) * 2);
  GetWindowTextW(hwnd, buf, len + 1);
  return buf.toString('utf16le').replace(/\0+$/, '');
}

function getClassName(hwnd: number): string {
  const buf = Buffer.alloc(512);
  const len = GetClassNameW(hwnd, buf, 256);
  if (len === 0) return '';
  return buf.slice(0, len * 2).toString('utf16le');
}

function getProcessId(hwnd: number): number {
  const pidBuf = Buffer.alloc(4);
  GetWindowThreadProcessId(hwnd, pidBuf);
  return pidBuf.readUInt32LE(0);
}

function getWindowBounds(hwnd: number): { x: number; y: number; width: number; height: number } {
  const rect = { left: 0, top: 0, right: 0, bottom: 0 };
  GetWindowRect(hwnd, rect);
  return {
    x: rect.left,
    y: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
  };
}

function getWindowStyle(hwnd: number): number {
  return GetWindowLongW(hwnd, GWL_STYLE);
}

function getMonitorBounds(hwnd: number): { x: number; y: number; width: number; height: number } | null {
  const hMonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
  if (!hMonitor) return null;

  const mi = {
    cbSize: 40, // sizeof(MONITORINFO)
    rcMonitor: { left: 0, top: 0, right: 0, bottom: 0 },
    rcWork: { left: 0, top: 0, right: 0, bottom: 0 },
    dwFlags: 0,
  };
  if (!GetMonitorInfoW(hMonitor, mi)) return null;

  return {
    x: mi.rcMonitor.left,
    y: mi.rcMonitor.top,
    width: mi.rcMonitor.right - mi.rcMonitor.left,
    height: mi.rcMonitor.bottom - mi.rcMonitor.top,
  };
}

function isTopmost(hwnd: number): boolean {
  const exStyle = GetWindowLongW(hwnd, GWL_EXSTYLE);
  return (exStyle & WS_EX_TOPMOST) !== 0;
}

function isToolWindow(hwnd: number): boolean {
  const exStyle = GetWindowLongW(hwnd, GWL_EXSTYLE);
  return (exStyle & WS_EX_TOOLWINDOW) !== 0;
}

interface SavedWindowState {
  bounds: { x: number; y: number; width: number; height: number };
  style: number;
}

export class WindowService {
  private ownHwnd: number = 0;
  private pinnedWindows = new Set<number>();
  private savedStates = new Map<number, SavedWindowState>();

  setOwnHwnd(nativeHandle: Buffer): void {
    // Electron's getNativeWindowHandle() returns a Buffer containing the HWND
    if (nativeHandle.length >= 4) {
      // Read as pointer-sized value (4 bytes on 32-bit, 8 bytes on 64-bit)
      this.ownHwnd = nativeHandle.length >= 8
        ? Number(nativeHandle.readBigUInt64LE(0))
        : nativeHandle.readUInt32LE(0);
    }
  }

  getWindows(): WindowInfo[] {
    const windows: WindowInfo[] = [];

    const callback = koffi.register((hwnd: number, _lParam: number): boolean => {
      // Filter: must be visible
      if (!IsWindowVisible(hwnd)) return true;

      // Filter: skip our own window
      if (hwnd === this.ownHwnd) return true;

      // Filter: skip tool windows
      if (isToolWindow(hwnd)) return true;

      // Filter: must have a title
      const title = getWindowText(hwnd);
      if (!title) return true;

      // Filter: skip excluded system classes
      const className = getClassName(hwnd);
      if (EXCLUDED_CLASSES.has(className)) return true;

      windows.push({
        hwnd,
        title,
        className,
        processId: getProcessId(hwnd),
        bounds: getWindowBounds(hwnd),
        isTopmost: isTopmost(hwnd),
        isMinimized: IsIconic(hwnd),
      });

      return true; // continue enumeration
    }, koffi.pointer(EnumWindowsProc));

    try {
      EnumWindows(callback, 0);
    } finally {
      koffi.unregister(callback);
    }

    return windows;
  }

  setTopmost(hwnd: number, topmost: boolean): boolean {
    if (!IsWindow(hwnd)) return false;

    if (topmost) {
      // Save current state before pinning
      this.savedStates.set(hwnd, {
        bounds: getWindowBounds(hwnd),
        style: getWindowStyle(hwnd),
      });
    }

    const insertAfter = topmost ? HWND_TOPMOST : HWND_NOTOPMOST;
    const result = SetWindowPos(hwnd, insertAfter, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);

    if (result) {
      if (topmost) {
        this.pinnedWindows.add(hwnd);
      } else {
        this.pinnedWindows.delete(hwnd);
        this.savedStates.delete(hwnd);
      }
    }

    return result;
  }

  resizeWindow(hwnd: number, width: number, height: number): boolean {
    if (!IsWindow(hwnd)) return false;

    // Get current position to preserve it
    const bounds = getWindowBounds(hwnd);
    return SetWindowPos(hwnd, 0, bounds.x, bounds.y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);
  }

  focusWindow(hwnd: number): boolean {
    if (!IsWindow(hwnd)) return false;

    // Restore if minimized
    if (IsIconic(hwnd)) {
      ShowWindow(hwnd, SW_RESTORE);
    }

    return SetForegroundWindow(hwnd);
  }

  getWindowInfo(hwnd: number): WindowInfo | null {
    if (!IsWindow(hwnd)) return null;

    return {
      hwnd,
      title: getWindowText(hwnd),
      className: getClassName(hwnd),
      processId: getProcessId(hwnd),
      bounds: getWindowBounds(hwnd),
      isTopmost: isTopmost(hwnd),
      isMinimized: IsIconic(hwnd),
    };
  }

  isValidWindow(hwnd: number): boolean {
    return IsWindow(hwnd);
  }

  unpinAll(): void {
    for (const hwnd of this.pinnedWindows) {
      if (IsWindow(hwnd)) {
        SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
      }
    }
    this.pinnedWindows.clear();
  }

  getPinnedCount(): number {
    // Clean up stale entries
    for (const hwnd of this.pinnedWindows) {
      if (!IsWindow(hwnd)) {
        this.pinnedWindows.delete(hwnd);
        this.savedStates.delete(hwnd);
      }
    }
    return this.pinnedWindows.size;
  }

  /**
   * Check all pinned windows for fullscreen and restore them if detected.
   * A window is considered fullscreen when it covers the entire monitor
   * and has lost its caption/border styles.
   */
  checkAndPreventFullscreen(): void {
    for (const hwnd of this.pinnedWindows) {
      if (!IsWindow(hwnd) || IsIconic(hwnd)) continue;

      const saved = this.savedStates.get(hwnd);
      if (!saved) continue;

      const currentStyle = getWindowStyle(hwnd);
      const currentBounds = getWindowBounds(hwnd);
      const monitor = getMonitorBounds(hwnd);
      if (!monitor) continue;

      // Detect fullscreen: window covers the monitor and lost its caption
      const hadCaption = (saved.style & WS_CAPTION) !== 0;
      const hasCaption = (currentStyle & WS_CAPTION) !== 0;
      const coversMonitor =
        currentBounds.x <= monitor.x &&
        currentBounds.y <= monitor.y &&
        currentBounds.width >= monitor.width &&
        currentBounds.height >= monitor.height;

      if (coversMonitor && hadCaption && !hasCaption) {
        // Restore window style (add back caption and thick frame)
        SetWindowLongW(hwnd, GWL_STYLE, saved.style);

        // Restore bounds and apply style change
        SetWindowPos(
          hwnd, HWND_TOPMOST,
          saved.bounds.x, saved.bounds.y,
          saved.bounds.width, saved.bounds.height,
          SWP_FRAMECHANGED | SWP_NOACTIVATE
        );
      }
    }
  }
}

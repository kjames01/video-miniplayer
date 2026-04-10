import { BrowserWindow } from 'electron';
import { WindowService } from './windowService';

const BORDER_WIDTH = 3;
const BORDER_COLOR = '#1db954';
const UPDATE_INTERVAL_MS = 100;

interface BorderWindows {
  top: BrowserWindow;
  bottom: BrowserWindow;
  left: BrowserWindow;
  right: BrowserWindow;
}

function createBar(): BrowserWindow {
  const bar = new BrowserWindow({
    width: 1,
    height: 1,
    x: -100,
    y: -100,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    backgroundColor: BORDER_COLOR,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  bar.setIgnoreMouseEvents(true);
  return bar;
}

function positionBars(bars: BorderWindows, bounds: { x: number; y: number; width: number; height: number }): void {
  const b = BORDER_WIDTH;
  // Top bar
  bars.top.setBounds({ x: bounds.x - b, y: bounds.y - b, width: bounds.width + b * 2, height: b });
  // Bottom bar
  bars.bottom.setBounds({ x: bounds.x - b, y: bounds.y + bounds.height, width: bounds.width + b * 2, height: b });
  // Left bar
  bars.left.setBounds({ x: bounds.x - b, y: bounds.y, width: b, height: bounds.height });
  // Right bar
  bars.right.setBounds({ x: bounds.x + bounds.width, y: bounds.y, width: b, height: bounds.height });
}

function showBars(bars: BorderWindows): void {
  bars.top.showInactive();
  bars.bottom.showInactive();
  bars.left.showInactive();
  bars.right.showInactive();
}

function hideBars(bars: BorderWindows): void {
  bars.top.hide();
  bars.bottom.hide();
  bars.left.hide();
  bars.right.hide();
}

function destroyBars(bars: BorderWindows): void {
  bars.top.destroy();
  bars.bottom.destroy();
  bars.left.destroy();
  bars.right.destroy();
}

function barsVisible(bars: BorderWindows): boolean {
  return bars.top.isVisible();
}

export class OverlayManager {
  private overlays = new Map<number, BorderWindows>();
  private windowService: WindowService;
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  constructor(windowService: WindowService) {
    this.windowService = windowService;
    this.startTracking();
  }

  addOverlay(hwnd: number): void {
    if (this.overlays.has(hwnd)) return;

    const info = this.windowService.getWindowInfo(hwnd);
    if (!info) return;

    const bars: BorderWindows = {
      top: createBar(),
      bottom: createBar(),
      left: createBar(),
      right: createBar(),
    };

    // Mark all bars as tool windows so they're excluded from window enumeration
    this.windowService.markAsToolWindow(bars.top.getNativeWindowHandle());
    this.windowService.markAsToolWindow(bars.bottom.getNativeWindowHandle());
    this.windowService.markAsToolWindow(bars.left.getNativeWindowHandle());
    this.windowService.markAsToolWindow(bars.right.getNativeWindowHandle());

    positionBars(bars, info.bounds);
    if (!info.isMinimized) {
      showBars(bars);
    }

    this.overlays.set(hwnd, bars);
  }

  removeOverlay(hwnd: number): void {
    const bars = this.overlays.get(hwnd);
    if (bars) {
      destroyBars(bars);
      this.overlays.delete(hwnd);
    }
  }

  removeAll(): void {
    for (const [, bars] of this.overlays) {
      destroyBars(bars);
    }
    this.overlays.clear();
  }

  private startTracking(): void {
    this.updateInterval = setInterval(() => {
      this.updatePositions();
    }, UPDATE_INTERVAL_MS);
  }

  private updatePositions(): void {
    // Prevent pinned windows from going fullscreen
    this.windowService.checkAndPreventFullscreen();

    for (const [hwnd, bars] of this.overlays) {
      if (!this.windowService.isValidWindow(hwnd)) {
        destroyBars(bars);
        this.overlays.delete(hwnd);
        continue;
      }

      const info = this.windowService.getWindowInfo(hwnd);
      if (!info) continue;

      if (info.isMinimized) {
        if (barsVisible(bars)) hideBars(bars);
        continue;
      }

      if (!barsVisible(bars)) showBars(bars);

      positionBars(bars, info.bounds);
    }
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.removeAll();
  }
}

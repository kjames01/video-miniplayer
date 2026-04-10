import { BrowserWindow } from 'electron';
import { WindowService } from './windowService';

const BORDER_WIDTH = 3;
const BORDER_COLOR = '#1db954';
const UPDATE_INTERVAL_MS = 100;

export class OverlayManager {
  private overlays = new Map<number, BrowserWindow>();
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

    const overlay = new BrowserWindow({
      x: info.bounds.x - BORDER_WIDTH,
      y: info.bounds.y - BORDER_WIDTH,
      width: info.bounds.width + BORDER_WIDTH * 2,
      height: info.bounds.height + BORDER_WIDTH * 2,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      hasShadow: false,
      show: !info.isMinimized,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    overlay.setIgnoreMouseEvents(true);

    const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; background: transparent; overflow: hidden; }
  .border { position: absolute; inset: 0; border: ${BORDER_WIDTH}px solid ${BORDER_COLOR}; border-radius: 4px; }
</style></head><body><div class="border"></div></body></html>`;

    overlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Prevent overlay from appearing in window list
    overlay.removeAllListeners('close');

    this.overlays.set(hwnd, overlay);
  }

  removeOverlay(hwnd: number): void {
    const overlay = this.overlays.get(hwnd);
    if (overlay) {
      overlay.destroy();
      this.overlays.delete(hwnd);
    }
  }

  removeAll(): void {
    for (const [hwnd, overlay] of this.overlays) {
      overlay.destroy();
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

    for (const [hwnd, overlay] of this.overlays) {
      if (!this.windowService.isValidWindow(hwnd)) {
        overlay.destroy();
        this.overlays.delete(hwnd);
        continue;
      }

      const info = this.windowService.getWindowInfo(hwnd);
      if (!info) continue;

      if (info.isMinimized) {
        if (overlay.isVisible()) overlay.hide();
        continue;
      }

      if (!overlay.isVisible()) overlay.show();

      const targetBounds = {
        x: info.bounds.x - BORDER_WIDTH,
        y: info.bounds.y - BORDER_WIDTH,
        width: info.bounds.width + BORDER_WIDTH * 2,
        height: info.bounds.height + BORDER_WIDTH * 2,
      };

      const current = overlay.getBounds();
      if (
        current.x !== targetBounds.x ||
        current.y !== targetBounds.y ||
        current.width !== targetBounds.width ||
        current.height !== targetBounds.height
      ) {
        overlay.setBounds(targetBounds);
      }
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

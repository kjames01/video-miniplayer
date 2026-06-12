import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { WindowBounds } from '../shared/types';
import { SettingsStore } from './settingsStore';

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 280;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 200;
const BOUNDS_SAVE_DEBOUNCE_MS = 500;

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private isAlwaysOnTop: boolean = true;
  private settingsStore: SettingsStore | null = null;
  private boundsSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(settingsStore?: SettingsStore) {
    this.settingsStore = settingsStore ?? null;
    if (this.settingsStore) {
      this.isAlwaysOnTop = this.settingsStore.get().alwaysOnTop;
    }
  }

  /**
   * Returns true if the saved bounds overlap a connected display, so we don't
   * restore a window onto a monitor that has since been disconnected.
   */
  private boundsAreVisible(bounds: WindowBounds): boolean {
    return screen.getAllDisplays().some((display) => {
      const wa = display.workArea;
      return (
        bounds.x < wa.x + wa.width &&
        bounds.x + bounds.width > wa.x &&
        bounds.y < wa.y + wa.height &&
        bounds.y + bounds.height > wa.y
      );
    });
  }

  private getInitialBounds(): WindowBounds {
    const saved = this.settingsStore?.get().lastBounds;
    if (saved && saved.width >= MIN_WIDTH && saved.height >= MIN_HEIGHT && this.boundsAreVisible(saved)) {
      return saved;
    }

    // Default: bottom-right of the primary display
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    return {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      x: screenWidth - DEFAULT_WIDTH - 20,
      y: screenHeight - DEFAULT_HEIGHT - 20,
    };
  }

  private persistBounds(): void {
    if (!this.settingsStore || !this.mainWindow) return;
    if (this.boundsSaveTimer) clearTimeout(this.boundsSaveTimer);
    this.boundsSaveTimer = setTimeout(() => {
      this.boundsSaveTimer = null;
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.settingsStore?.update({ lastBounds: this.mainWindow.getBounds() });
      }
    }, BOUNDS_SAVE_DEBOUNCE_MS);
  }

  createWindow(): BrowserWindow {
    const bounds = this.getInitialBounds();

    this.mainWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      frame: false,
      transparent: false,
      alwaysOnTop: this.isAlwaysOnTop,
      skipTaskbar: false,
      resizable: true,
      hasShadow: true,
      backgroundColor: '#1a1a1a',
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    // Load the renderer HTML
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Persist position/size so the window reopens where the user left it
    this.mainWindow.on('moved', () => this.persistBounds());
    this.mainWindow.on('resized', () => this.persistBounds());

    // Handle window close - hide to tray instead
    this.mainWindow.on('close', (event) => {
      event.preventDefault();
      this.persistBounds();
      this.mainWindow?.hide();
    });

    return this.mainWindow;
  }

  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  minimize(): void {
    this.mainWindow?.minimize();
  }

  close(): void {
    this.mainWindow?.hide();
  }

  show(): void {
    this.mainWindow?.show();
    this.mainWindow?.focus();
  }

  setAlwaysOnTop(value: boolean): void {
    this.isAlwaysOnTop = value;
    this.mainWindow?.setAlwaysOnTop(value);
  }

  isOnTop(): boolean {
    return this.isAlwaysOnTop;
  }

  destroy(): void {
    if (this.boundsSaveTimer) {
      clearTimeout(this.boundsSaveTimer);
      this.boundsSaveTimer = null;
    }
    if (this.mainWindow) {
      this.mainWindow.removeAllListeners('close');
      this.mainWindow.close();
      this.mainWindow = null;
    }
  }
}

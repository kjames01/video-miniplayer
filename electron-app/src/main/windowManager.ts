import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private isAlwaysOnTop: boolean = true;

  createWindow(): BrowserWindow {
    // Get primary display for positioning
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Default window size
    const windowWidth = 400;
    const windowHeight = 280;

    // Position in bottom-right corner
    const x = screenWidth - windowWidth - 20;
    const y = screenHeight - windowHeight - 20;

    this.mainWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x,
      y,
      minWidth: 320,
      minHeight: 200,
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
        sandbox: false,
      },
    });

    // Load the renderer HTML
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Uncomment to open DevTools in development for debugging
    // if (!app.isPackaged) {
    //   this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    // }

    // Handle window close - hide to tray instead
    this.mainWindow.on('close', (event) => {
      event.preventDefault();
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
    if (this.mainWindow) {
      this.mainWindow.removeAllListeners('close');
      this.mainWindow.close();
      this.mainWindow = null;
    }
  }
}

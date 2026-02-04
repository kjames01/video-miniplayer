import { Tray, Menu, app, nativeImage } from 'electron';
import * as path from 'path';
import { WindowManager } from './windowManager';

export class TrayManager {
  private tray: Tray | null = null;
  private windowManager: WindowManager;

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
    this.createTray();
  }

  private createTray(): void {
    // Create a simple tray icon
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icons', 'icon.png')
      : path.join(__dirname, '../../resources/icons/icon.svg');

    // Create a simple 16x16 icon for the tray
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAnklEQVR4nO2SwQqDMBBEX+3/f2au0ouHgogg1kMPnuuhFMR8QA+JNkFaGgsCDiSzM7vJhq+TAHFAM5IrSZIkyRe0kgWQIklPsgQO4A0MSabRPtBKLgHnIY/Aa+D6aVBJ+vAHgDPwAvyM1PgjcqABjsCV+w0/beCO5CbvM3CL9XYEgSpAU/b95IZ/BYL8EGgkG5JV+cX0IjuApJ4E+kcTdwE93DP+2eJD5gAAAABJRU5ErkJggg=='
    );

    this.tray = new Tray(icon);
    this.tray.setToolTip('Video Miniplayer');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Player',
        click: () => {
          this.windowManager.show();
        },
      },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: this.windowManager.isOnTop(),
        click: (menuItem) => {
          this.windowManager.setAlwaysOnTop(menuItem.checked);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.windowManager.destroy();
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);

    // Double-click to show window
    this.tray.on('double-click', () => {
      this.windowManager.show();
    });
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}

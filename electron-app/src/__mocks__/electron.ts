// Mock Electron APIs for testing
import { EventEmitter } from 'events';

export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeHandler: jest.fn()
};

export const ipcRenderer = {
  invoke: jest.fn(),
  send: jest.fn(),
  on: jest.fn()
};

export const app = {
  getPath: jest.fn().mockReturnValue('/mock/path'),
  isPackaged: false,
  quit: jest.fn(),
  requestSingleInstanceLock: jest.fn().mockReturnValue(true),
  on: jest.fn(),
  whenReady: jest.fn().mockResolvedValue(undefined)
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadFile: jest.fn(),
  on: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  focus: jest.fn(),
  close: jest.fn(),
  minimize: jest.fn(),
  restore: jest.fn(),
  isMinimized: jest.fn().mockReturnValue(false),
  isVisible: jest.fn().mockReturnValue(true),
  isDestroyed: jest.fn().mockReturnValue(false),
  removeAllListeners: jest.fn(),
  setAlwaysOnTop: jest.fn(),
  getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 400, height: 300 }),
  setBounds: jest.fn(),
  webContents: {
    send: jest.fn(),
    on: jest.fn()
  }
}));

const fullScreenDisplay = {
  workAreaSize: { width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1080 },
};

export const screen = {
  getPrimaryDisplay: jest.fn().mockReturnValue(fullScreenDisplay),
  getAllDisplays: jest.fn().mockReturnValue([fullScreenDisplay]),
};

export const Tray = jest.fn().mockImplementation(() => ({
  setToolTip: jest.fn(),
  setContextMenu: jest.fn(),
  on: jest.fn()
}));

export const Menu = {
  buildFromTemplate: jest.fn().mockReturnValue({})
};

export const nativeImage = {
  createFromPath: jest.fn().mockReturnValue({})
};

export const contextBridge = {
  exposeInMainWorld: jest.fn()
};

export const safeStorage = {
  isEncryptionAvailable: jest.fn().mockReturnValue(true),
  encryptString: jest.fn((value: string) => Buffer.from(value)),
  decryptString: jest.fn((buffer: Buffer) => buffer.toString())
};

export const shell = {
  openExternal: jest.fn().mockResolvedValue(undefined)
};

// Minimal mock of Electron's net module. By default `request()` returns a
// successful response carrying a small VTT body once `.end()` is called.
// Tests can override with net.request.mockImplementationOnce(...).
export const net = {
  request: jest.fn(() => {
    const req: any = new EventEmitter();
    req.abort = jest.fn();
    req.end = jest.fn(() => {
      setImmediate(() => {
        const res: any = new EventEmitter();
        res.statusCode = 200;
        req.emit('response', res);
        setImmediate(() => {
          res.emit('data', Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello world\n'));
          res.emit('end');
        });
      });
    });
    return req;
  })
};

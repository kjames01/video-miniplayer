// Mock Electron APIs for testing
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
  setAlwaysOnTop: jest.fn(),
  getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 400, height: 300 }),
  setBounds: jest.fn(),
  webContents: {
    send: jest.fn(),
    on: jest.fn()
  }
}));

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

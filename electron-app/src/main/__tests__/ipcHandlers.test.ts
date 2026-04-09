import { ipcMain, app } from 'electron';
import { setupIpcHandlers, getWindowService } from '../ipcHandlers';
import { WindowManager } from '../windowManager';
import { IPC_CHANNELS } from '../../shared/types';

// Mock WindowService since it depends on koffi/Win32 APIs
jest.mock('../windowService', () => {
  return {
    WindowService: jest.fn().mockImplementation(() => ({
      setOwnHwnd: jest.fn(),
      getWindows: jest.fn().mockReturnValue([
        {
          hwnd: 12345,
          title: 'Test Window',
          className: 'TestClass',
          processId: 100,
          bounds: { x: 0, y: 0, width: 800, height: 600 },
          isTopmost: false,
          isMinimized: false,
        },
      ]),
      setTopmost: jest.fn().mockReturnValue(true),
      resizeWindow: jest.fn().mockReturnValue(true),
      focusWindow: jest.fn().mockReturnValue(true),
      unpinAll: jest.fn(),
      getPinnedCount: jest.fn().mockReturnValue(0),
    })),
  };
});

describe('IPC Handlers', () => {
  let mockWindowManager: WindowManager;
  let handleCallbacks: Map<string, Function>;
  let onCallbacks: Map<string, Function>;

  beforeEach(() => {
    handleCallbacks = new Map();
    onCallbacks = new Map();

    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      handleCallbacks.set(channel, handler);
    });
    (ipcMain.on as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      onCallbacks.set(channel, handler);
    });

    mockWindowManager = new WindowManager();
    // Mock getWindow to return something with getNativeWindowHandle
    (mockWindowManager.getWindow as jest.Mock) = jest.fn().mockReturnValue({
      getNativeWindowHandle: jest.fn().mockReturnValue(Buffer.alloc(8)),
    });
    mockWindowManager.minimize = jest.fn();
    mockWindowManager.destroy = jest.fn();
    mockWindowManager.setAlwaysOnTop = jest.fn();

    setupIpcHandlers(mockWindowManager);
  });

  test('registers all expected IPC channels', () => {
    const expectedHandles = [
      IPC_CHANNELS.GET_WINDOWS,
      IPC_CHANNELS.SET_TOPMOST,
      IPC_CHANNELS.RESIZE_WINDOW,
      IPC_CHANNELS.FOCUS_WINDOW,
      IPC_CHANNELS.GET_SETTINGS,
      IPC_CHANNELS.SAVE_SETTINGS,
    ];

    for (const channel of expectedHandles) {
      expect(handleCallbacks.has(channel)).toBe(true);
    }

    const expectedOns = [
      IPC_CHANNELS.MINIMIZE_WINDOW,
      IPC_CHANNELS.CLOSE_WINDOW,
      IPC_CHANNELS.SET_ALWAYS_ON_TOP,
    ];

    for (const channel of expectedOns) {
      expect(onCallbacks.has(channel)).toBe(true);
    }
  });

  test('getWindowService returns the service after setup', () => {
    expect(getWindowService()).not.toBeNull();
  });

  test('GET_WINDOWS returns window list', () => {
    const handler = handleCallbacks.get(IPC_CHANNELS.GET_WINDOWS)!;
    const result = handler({});
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Window');
  });

  test('SET_TOPMOST validates parameters', () => {
    const handler = handleCallbacks.get(IPC_CHANNELS.SET_TOPMOST)!;

    // Invalid params
    const badResult = handler({}, 'not-a-number', true);
    expect(badResult.success).toBe(false);
    expect(badResult.error).toBe('Invalid parameters');

    // Valid params
    const goodResult = handler({}, 12345, true);
    expect(goodResult.success).toBe(true);
  });

  test('RESIZE_WINDOW validates dimensions', () => {
    const handler = handleCallbacks.get(IPC_CHANNELS.RESIZE_WINDOW)!;

    // Too small
    const tooSmall = handler({}, 12345, 50, 30);
    expect(tooSmall.success).toBe(false);
    expect(tooSmall.error).toBe('Dimensions out of range');

    // Too large
    const tooLarge = handler({}, 12345, 10000, 5000);
    expect(tooLarge.success).toBe(false);

    // Valid
    const valid = handler({}, 12345, 800, 600);
    expect(valid.success).toBe(true);
  });

  test('FOCUS_WINDOW validates hwnd', () => {
    const handler = handleCallbacks.get(IPC_CHANNELS.FOCUS_WINDOW)!;

    const bad = handler({}, 'not-a-number');
    expect(bad.success).toBe(false);

    const good = handler({}, 12345);
    expect(good.success).toBe(true);
  });

  test('MINIMIZE_WINDOW calls windowManager.minimize', () => {
    const handler = onCallbacks.get(IPC_CHANNELS.MINIMIZE_WINDOW)!;
    handler();
    expect(mockWindowManager.minimize).toHaveBeenCalled();
  });

  test('CLOSE_WINDOW destroys window and quits', () => {
    const handler = onCallbacks.get(IPC_CHANNELS.CLOSE_WINDOW)!;
    handler();
    expect(mockWindowManager.destroy).toHaveBeenCalled();
    expect(app.quit).toHaveBeenCalled();
  });

  test('SET_ALWAYS_ON_TOP validates boolean input', () => {
    const handler = onCallbacks.get(IPC_CHANNELS.SET_ALWAYS_ON_TOP)!;

    // Invalid - should not call setAlwaysOnTop
    handler({}, 'not-a-boolean');
    expect(mockWindowManager.setAlwaysOnTop).not.toHaveBeenCalled();

    // Valid
    handler({}, false);
    expect(mockWindowManager.setAlwaysOnTop).toHaveBeenCalledWith(false);
  });

  test('GET_SETTINGS and SAVE_SETTINGS work correctly', () => {
    const getHandler = handleCallbacks.get(IPC_CHANNELS.GET_SETTINGS)!;
    const saveHandler = handleCallbacks.get(IPC_CHANNELS.SAVE_SETTINGS)!;

    // Check initial state reflects current module state
    const initial = getHandler({});
    expect(typeof initial.alwaysOnTop).toBe('boolean');

    // Save and verify
    saveHandler({}, { alwaysOnTop: false });
    expect(getHandler({}).alwaysOnTop).toBe(false);

    saveHandler({}, { alwaysOnTop: true });
    expect(getHandler({}).alwaysOnTop).toBe(true);

    // Invalid input ignored
    saveHandler({}, null);
    expect(getHandler({}).alwaysOnTop).toBe(true);
  });
});

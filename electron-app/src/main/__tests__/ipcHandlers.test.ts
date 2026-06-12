import { ipcMain, shell } from 'electron';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { setupIpcHandlers } from '../ipcHandlers';
import { WindowManager } from '../windowManager';
import { SettingsStore } from '../settingsStore';
import { IPC_CHANNELS } from '../../shared/types';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

jest.mock('child_process');
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Gemini SDK mock that yields a single chat chunk
jest.mock('@google/generative-ai', () => {
  async function* fakeStream() {
    yield { text: () => 'Answer' };
  }
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({
        startChat: jest.fn(() => ({
          sendMessageStream: jest.fn(async () => ({ stream: fakeStream() })),
        })),
      })),
    })),
  };
});

class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn();
}
let lastProc: FakeProc;

const handleMock = ipcMain.handle as jest.Mock;
const onMock = ipcMain.on as jest.Mock;
const openExternalMock = shell.openExternal as jest.Mock;

const getHandle = (channel: string) =>
  handleMock.mock.calls.find((c) => c[0] === channel)?.[1];
const getOn = (channel: string) =>
  onMock.mock.calls.find((c) => c[0] === channel)?.[1];

let windowManager: jest.Mocked<Pick<WindowManager, 'close' | 'minimize' | 'setAlwaysOnTop' | 'destroy'>>;
let store: jest.Mocked<Pick<SettingsStore, 'get' | 'update'>>;

beforeEach(() => {
  mockedFs.existsSync.mockReturnValue(false);
  mockedFs.writeFileSync.mockImplementation(() => undefined);
  mockedSpawn.mockImplementation(() => {
    lastProc = new FakeProc();
    return lastProc as unknown as ReturnType<typeof spawn>;
  });

  windowManager = {
    close: jest.fn(),
    minimize: jest.fn(),
    setAlwaysOnTop: jest.fn(),
    destroy: jest.fn(),
  };
  store = {
    get: jest.fn().mockReturnValue({ alwaysOnTop: true, volume: 1 }),
    update: jest.fn(),
  };

  setupIpcHandlers(
    windowManager as unknown as WindowManager,
    store as unknown as SettingsStore
  );
});

describe('window control handlers', () => {
  it('close hides to tray instead of quitting', () => {
    getOn(IPC_CHANNELS.CLOSE_WINDOW)();
    expect(windowManager.close).toHaveBeenCalled();
    expect(windowManager.destroy).not.toHaveBeenCalled();
  });

  it('minimize delegates to the window manager', () => {
    getOn(IPC_CHANNELS.MINIMIZE_WINDOW)();
    expect(windowManager.minimize).toHaveBeenCalled();
  });

  it('set-always-on-top applies and persists a boolean', () => {
    getOn(IPC_CHANNELS.SET_ALWAYS_ON_TOP)({}, false);
    expect(windowManager.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(store.update).toHaveBeenCalledWith({ alwaysOnTop: false });
  });

  it('set-always-on-top ignores non-boolean input', () => {
    getOn(IPC_CHANNELS.SET_ALWAYS_ON_TOP)({}, 'yes');
    expect(windowManager.setAlwaysOnTop).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
  });
});

describe('settings handlers', () => {
  it('get-settings returns the store snapshot', () => {
    const result = getHandle(IPC_CHANNELS.GET_SETTINGS)();
    expect(result).toEqual({ alwaysOnTop: true, volume: 1 });
  });

  it('save-settings forwards to the store', () => {
    getHandle(IPC_CHANNELS.SAVE_SETTINGS)({}, { volume: 0.4 });
    expect(store.update).toHaveBeenCalledWith({ volume: 0.4 });
  });
});

describe('open-external handler', () => {
  it('opens valid http(s) URLs in the default browser', async () => {
    await getHandle(IPC_CHANNELS.OPEN_EXTERNAL)({}, 'https://aistudio.google.com/app/apikey');
    expect(openExternalMock).toHaveBeenCalledWith('https://aistudio.google.com/app/apikey');
  });

  it('refuses non-http(s) URLs', async () => {
    await getHandle(IPC_CHANNELS.OPEN_EXTERNAL)({}, 'javascript:alert(1)');
    expect(openExternalMock).not.toHaveBeenCalled();
  });
});

describe('extract-video handler', () => {
  it('rejects an invalid URL', async () => {
    const result = await getHandle(IPC_CHANNELS.EXTRACT_VIDEO)({}, 'not a url');
    expect(result.success).toBe(false);
  });

  it('rejects an empty URL', async () => {
    const result = await getHandle(IPC_CHANNELS.EXTRACT_VIDEO)({}, '');
    expect(result.success).toBe(false);
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('rejects an over-length URL', async () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2100);
    const result = await getHandle(IPC_CHANNELS.EXTRACT_VIDEO)({}, longUrl);
    expect(result.success).toBe(false);
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('returns a direct media URL without invoking yt-dlp', async () => {
    const result = await getHandle(IPC_CHANNELS.EXTRACT_VIDEO)({}, 'https://cdn.example.com/clip.mp4');
    expect(result).toEqual({
      success: true,
      videoUrl: 'https://cdn.example.com/clip.mp4',
      title: 'Direct Video',
    });
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('extracts via yt-dlp and serves the second request from cache', async () => {
    const handler = getHandle(IPC_CHANNELS.EXTRACT_VIDEO);
    const url = 'https://site.example/watch?v=abc';

    const first = handler({}, url);
    lastProc.stdout.emit('data', Buffer.from(JSON.stringify({ url: 'https://m/v.mp4', title: 'Vid' })));
    lastProc.emit('close', 0);

    await expect(first).resolves.toEqual({ success: true, videoUrl: 'https://m/v.mp4', title: 'Vid' });
    expect(mockedSpawn).toHaveBeenCalledTimes(1);

    // Second identical request is cached -> no new yt-dlp process
    const second = await handler({}, url);
    expect(second.success).toBe(true);
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  it('propagates a yt-dlp failure', async () => {
    const handler = getHandle(IPC_CHANNELS.EXTRACT_VIDEO);
    const first = handler({}, 'https://site.example/watch?v=fail');
    lastProc.stderr.emit('data', Buffer.from('nope'));
    lastProc.emit('close', 1);

    await expect(first).resolves.toEqual({ success: false, error: 'nope' });
  });
});

describe('transcript and chat handlers', () => {
  it('reports no transcript when no subtitles were captured', async () => {
    const result = await getHandle(IPC_CHANNELS.EXTRACT_TRANSCRIPT)();
    expect(result.success).toBe(false);
    expect(result.error).toBe('No transcript available for this video');
  });

  it('falls back to the default Gemini model name when reporting settings', () => {
    const settings = getHandle(IPC_CHANNELS.GET_GEMINI_SETTINGS)();
    expect(settings.model).toBe('gemini-2.0-flash');
  });

  it('save-gemini-settings accepts a model update', () => {
    getHandle(IPC_CHANNELS.SAVE_GEMINI_SETTINGS)({}, { model: 'gemini-1.5-pro' });
    expect(getHandle(IPC_CHANNELS.GET_GEMINI_SETTINGS)().model).toBe('gemini-1.5-pro');
  });

  it('save-gemini-settings ignores non-object input', () => {
    expect(() => getHandle(IPC_CHANNELS.SAVE_GEMINI_SETTINGS)({}, null)).not.toThrow();
  });

  it('rejects an empty chat message', async () => {
    const send = jest.fn();
    getHandle(IPC_CHANNELS.SAVE_GEMINI_SETTINGS)({}, { apiKey: 'k', model: 'gemini-2.0-flash' });
    await getHandle(IPC_CHANNELS.CHAT_SEND_MESSAGE)({ sender: { send } }, '   ', []);
    // Either "not configured", "no transcript", or "empty" — but never streams
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.CHAT_ERROR, expect.any(String));
  });

  it('emits a chat error when Gemini is not configured', async () => {
    const send = jest.fn();
    await getHandle(IPC_CHANNELS.CHAT_SEND_MESSAGE)({ sender: { send } }, 'hello', []);
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.CHAT_ERROR, expect.stringContaining('API key'));
  });

  it('captures a transcript and streams a chat reply end to end', async () => {
    // Configure Gemini
    getHandle(IPC_CHANNELS.SAVE_GEMINI_SETTINGS)({}, { apiKey: 'k', model: 'gemini-2.0-flash' });

    // Extract a video that exposes English subtitles (drives the yt-dlp mock)
    const extract = getHandle(IPC_CHANNELS.EXTRACT_VIDEO)({}, 'https://site.example/v');
    lastProc.stdout.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          url: 'https://m/v.mp4',
          title: 'V',
          subtitles: { en: [{ url: 'https://s/en.vtt', ext: 'vtt' }] },
        })
      )
    );
    lastProc.emit('close', 0);
    await extract;

    // Fetch the transcript (Electron net mock returns VTT)
    const transcript = await getHandle(IPC_CHANNELS.EXTRACT_TRANSCRIPT)();
    expect(transcript.success).toBe(true);
    expect(transcript.fullText).toContain('Hello world');

    // Now a chat message should stream a reply and complete
    const send = jest.fn();
    await getHandle(IPC_CHANNELS.CHAT_SEND_MESSAGE)({ sender: { send } }, 'question', []);

    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.CHAT_RESPONSE_CHUNK, 'Answer');
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.CHAT_RESPONSE_COMPLETE);

    // With a transcript loaded, an empty message is rejected explicitly...
    const send2 = jest.fn();
    await getHandle(IPC_CHANNELS.CHAT_SEND_MESSAGE)({ sender: { send: send2 } }, '   ', []);
    expect(send2).toHaveBeenCalledWith(IPC_CHANNELS.CHAT_ERROR, 'Message cannot be empty');

    // ...and a non-array history is tolerated (coerced to []) and still streams
    const send3 = jest.fn();
    await getHandle(IPC_CHANNELS.CHAT_SEND_MESSAGE)(
      { sender: { send: send3 } },
      'question',
      'not-an-array' as never
    );
    expect(send3).toHaveBeenCalledWith(IPC_CHANNELS.CHAT_RESPONSE_COMPLETE);
  });
});

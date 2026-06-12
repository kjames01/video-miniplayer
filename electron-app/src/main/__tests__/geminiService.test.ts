import * as fs from 'fs';
import { GeminiService, DEFAULT_GEMINI_MODEL } from '../geminiService';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Self-contained SDK mock (no out-of-scope references for hoisting safety)
jest.mock('@google/generative-ai', () => {
  async function* fakeStream() {
    yield { text: () => 'Hello' };
    yield { text: () => ' world' };
    yield { text: () => '' }; // empty chunk should be skipped
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

describe('GeminiService', () => {
  beforeEach(() => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockReturnValue('{}');
    mockedFs.writeFileSync.mockImplementation(() => undefined);
  });

  it('starts unconfigured with the default model', () => {
    const service = new GeminiService();

    expect(service.isConfigured()).toBe(false);
    expect(service.getSettings()).toEqual({ model: DEFAULT_GEMINI_MODEL, apiKey: undefined });
  });

  it('persists a model change without configuring a client', () => {
    const service = new GeminiService();

    service.updateSettings({ model: 'gemini-1.5-pro' });

    expect(mockedFs.writeFileSync).toHaveBeenCalled();
    expect(service.getSettings().model).toBe('gemini-1.5-pro');
    expect(service.isConfigured()).toBe(false);
  });

  it('configures a client and masks the API key when one is set', () => {
    const service = new GeminiService();

    service.updateSettings({ apiKey: 'abcd1234efgh' });

    expect(service.isConfigured()).toBe(true);
    expect(service.getSettings().apiKey).toBe('***efgh');
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  it('clears the client when the API key is set to empty', () => {
    const service = new GeminiService();
    service.updateSettings({ apiKey: 'abcd1234efgh' });
    expect(service.isConfigured()).toBe(true);

    service.updateSettings({ apiKey: '' });

    expect(service.isConfigured()).toBe(false);
    expect(service.getSettings().apiKey).toBeUndefined();
  });

  it('throws from streamChat when no API key is configured', async () => {
    const service = new GeminiService();

    const stream = service.streamChat('hi', 'transcript', []);
    await expect(stream.next()).rejects.toThrow('Gemini API not configured');
  });

  it('streams chat chunks and skips empty ones once configured', async () => {
    const service = new GeminiService();
    service.updateSettings({ apiKey: 'abcd1234efgh' });

    const chunks: string[] = [];
    for await (const chunk of service.streamChat('question', 'the transcript', [])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('loads and decrypts a persisted, encrypted API key on construction', () => {
    const encrypted = Buffer.from('mysecret1234').toString('base64');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ model: 'gemini-2.0-flash', encryptedApiKey: encrypted })
    );

    const service = new GeminiService();

    expect(service.isConfigured()).toBe(true);
    expect(service.getSettings()).toEqual({ model: 'gemini-2.0-flash', apiKey: '***1234' });
  });
});

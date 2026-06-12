import * as fs from 'fs';
import { SettingsStore, validateSettings } from '../settingsStore';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('validateSettings', () => {
  it('returns an empty object for non-object input', () => {
    expect(validateSettings(null)).toEqual({});
    expect(validateSettings('nope')).toEqual({});
    expect(validateSettings(42)).toEqual({});
  });

  it('keeps alwaysOnTop only when it is a boolean', () => {
    expect(validateSettings({ alwaysOnTop: true })).toEqual({ alwaysOnTop: true });
    expect(validateSettings({ alwaysOnTop: 'yes' })).toEqual({});
  });

  it('keeps volume only when it is a number within [0, 1]', () => {
    expect(validateSettings({ volume: 0.5 })).toEqual({ volume: 0.5 });
    expect(validateSettings({ volume: 0 })).toEqual({ volume: 0 });
    expect(validateSettings({ volume: 1 })).toEqual({ volume: 1 });
    expect(validateSettings({ volume: 1.5 })).toEqual({});
    expect(validateSettings({ volume: -1 })).toEqual({});
    expect(validateSettings({ volume: 'loud' })).toEqual({});
  });

  it('keeps lastBounds only when all numeric fields are valid', () => {
    expect(
      validateSettings({ lastBounds: { x: 10, y: 20, width: 400, height: 300 } })
    ).toEqual({ lastBounds: { x: 10, y: 20, width: 400, height: 300 } });

    // zero/negative dimensions are rejected
    expect(validateSettings({ lastBounds: { x: 0, y: 0, width: 0, height: 300 } })).toEqual({});
    // missing field
    expect(validateSettings({ lastBounds: { x: 0, y: 0, width: 400 } })).toEqual({});
  });
});

describe('SettingsStore', () => {
  beforeEach(() => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockReturnValue('{}');
    mockedFs.writeFileSync.mockImplementation(() => undefined);
  });

  it('returns defaults when no settings file exists', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const store = new SettingsStore();

    expect(store.get()).toEqual({ alwaysOnTop: true, volume: 1 });
  });

  it('merges valid persisted settings over defaults', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ alwaysOnTop: false, volume: 0.3, junk: 'ignored' })
    );

    const store = new SettingsStore();

    expect(store.get()).toEqual({ alwaysOnTop: false, volume: 0.3 });
  });

  it('falls back to defaults when the file is corrupt', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('not json');

    const store = new SettingsStore();

    expect(store.get()).toEqual({ alwaysOnTop: true, volume: 1 });
  });

  it('persists validated updates and reflects them in get()', () => {
    const store = new SettingsStore();

    store.update({ volume: 0.8 });

    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
    const written = JSON.parse((mockedFs.writeFileSync as jest.Mock).mock.calls[0][1]);
    expect(written.volume).toBe(0.8);
    expect(store.get().volume).toBe(0.8);
  });

  it('ignores updates with no valid fields and does not write', () => {
    const store = new SettingsStore();

    store.update({ volume: 99, alwaysOnTop: 'nope' } as never);

    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('returns a copy from get() so callers cannot mutate internal state', () => {
    const store = new SettingsStore();

    const snapshot = store.get();
    snapshot.volume = 0;

    expect(store.get().volume).toBe(1);
  });
});

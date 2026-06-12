import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppSettings } from '../shared/types';

const SETTINGS_FILE = 'app-settings.json';

const DEFAULT_SETTINGS: AppSettings = {
  alwaysOnTop: true,
  volume: 1,
};

/**
 * Validates and sanitizes an untrusted settings object, returning only the
 * fields that are well-formed. Used both for IPC input and for data loaded
 * from disk (which may be stale or hand-edited).
 */
export function validateSettings(input: unknown): Partial<AppSettings> {
  const validated: Partial<AppSettings> = {};

  if (typeof input !== 'object' || input === null) {
    return validated;
  }

  const raw = input as Record<string, unknown>;

  if (typeof raw.alwaysOnTop === 'boolean') {
    validated.alwaysOnTop = raw.alwaysOnTop;
  }

  if (typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1) {
    validated.volume = raw.volume;
  }

  if (raw.lastBounds && typeof raw.lastBounds === 'object') {
    const bounds = raw.lastBounds as Record<string, unknown>;
    if (
      typeof bounds.x === 'number' &&
      typeof bounds.y === 'number' &&
      typeof bounds.width === 'number' &&
      typeof bounds.height === 'number' &&
      bounds.width > 0 &&
      bounds.height > 0
    ) {
      validated.lastBounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    }
  }

  return validated;
}

/**
 * Persists app settings to a JSON file in the user-data directory.
 */
export class SettingsStore {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private settingsPath: string;

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE);
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return;
      }
      const data = fs.readFileSync(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.settings = { ...DEFAULT_SETTINGS, ...validateSettings(parsed) };
    } catch (error) {
      console.error('[SettingsStore] Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('[SettingsStore] Failed to save settings:', error);
    }
  }

  get(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Merges validated fields from `partial` and persists to disk.
   */
  update(partial: Partial<AppSettings>): void {
    const validated = validateSettings(partial);
    if (Object.keys(validated).length === 0) {
      return;
    }
    this.settings = { ...this.settings, ...validated };
    this.save();
  }
}

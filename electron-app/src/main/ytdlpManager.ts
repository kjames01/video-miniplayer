import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import { ExtractResult } from '../shared/types';
import { YtdlpSubtitle, SubtitleInfo, selectBestSubtitles } from './subtitleSelector';

// Re-exported so existing importers (e.g. transcriptManager) keep working.
export type { SubtitleInfo };

// yt-dlp JSON output structure (subset of fields we use)
interface YtdlpFormat {
  url?: string;
  vcodec?: string;
  acodec?: string;
  ext?: string;
  format_id?: string;
}

interface YtdlpOutput {
  url?: string;
  title?: string;
  formats?: YtdlpFormat[];
  requested_formats?: YtdlpFormat[];
  subtitles?: Record<string, YtdlpSubtitle[]>;
  automatic_captions?: Record<string, YtdlpSubtitle[]>;
}

// Get the path to bundled yt-dlp
function getYtdlpPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'yt-dlp.exe');
  }
  // In dev mode, __dirname is dist/main, so go up to electron-app root
  return path.join(__dirname, '../../resources/bin/win/yt-dlp.exe');
}

// Allowed URL protocols for security
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const MAX_URL_LENGTH = 2048;

// Control characters never belong in a URL. We deliberately do NOT reject
// shell metacharacters like ()[]$'": yt-dlp is launched via spawn() without a
// shell, so the URL is passed as a single argv entry and cannot be interpreted
// as a command. Rejecting those characters only broke legitimate URLs.
const CONTROL_CHARS_PATTERN = /[\x00-\x1F\x7F]/;

function validateUrl(url: string): { valid: boolean; error?: string } {
  // Check type and length
  if (typeof url !== 'string' || url.length === 0) {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: 'URL exceeds maximum length' };
  }

  // Reject embedded control characters (newlines, tabs, null, etc.)
  if (CONTROL_CHARS_PATTERN.test(url)) {
    return { valid: false, error: 'URL contains invalid characters' };
  }

  // Validate URL format and protocol
  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      return { valid: false, error: `Protocol not allowed: ${parsedUrl.protocol}. Only HTTP/HTTPS supported.` };
    }
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  return { valid: true };
}

export class YtdlpManager {
  private ytdlpPath: string;
  private lastSubtitles: SubtitleInfo[] = [];
  private activeProcesses: Set<ChildProcess> = new Set();

  constructor() {
    this.ytdlpPath = getYtdlpPath();
  }

  killAll(): void {
    for (const proc of this.activeProcesses) {
      try {
        proc.kill();
      } catch {
        // Process may already be dead
      }
    }
    this.activeProcesses.clear();
  }

  getLastSubtitles(): SubtitleInfo[] {
    return this.lastSubtitles;
  }

  /**
   * Clear cached subtitles. Called when a new video request starts so a later
   * transcript fetch can never return the previous video's captions.
   */
  clearLastSubtitles(): void {
    this.lastSubtitles = [];
  }

  async extract(url: string): Promise<ExtractResult> {
    // Validate URL before processing
    const validation = validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    return new Promise((resolve) => {
      const args = [
        url,
        '--dump-single-json',
        '--no-warnings',
        '--prefer-free-formats',
        '--format', 'best[ext=mp4]/best'
      ];

      const proc = spawn(this.ytdlpPath, args, {
        windowsHide: true
      });

      this.activeProcesses.add(proc);

      const timeoutId = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // Process may already be dead
        }
      }, 30000);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(proc);
        console.error('[YtdlpManager] Spawn error:', err.message);
        resolve({ success: false, error: `Failed to run yt-dlp: ${err.message}` });
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(proc);
        if (code !== 0) {
          console.error('[YtdlpManager] yt-dlp exited with code:', code);
          console.error('[YtdlpManager] stderr:', stderr);
          resolve({ success: false, error: stderr || `yt-dlp exited with code ${code}` });
          return;
        }

        try {
          const output: YtdlpOutput = JSON.parse(stdout);
          const title = output.title || 'Unknown';
          let videoUrl = output.url;

          // Extract subtitle information
          this.lastSubtitles = selectBestSubtitles(output.subtitles, output.automatic_captions);

          // If no direct URL, check requested_formats (for sites like YouTube)
          if (!videoUrl && output.requested_formats?.length) {
            const videoFormat = output.requested_formats.find(f => f.vcodec && f.vcodec !== 'none');
            videoUrl = videoFormat?.url || output.requested_formats[0]?.url;
          }

          // If still no URL, try formats array
          if (!videoUrl && output.formats?.length) {
            const mp4Format = output.formats.find(f =>
              f.ext === 'mp4' && f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none'
            );
            const anyVideoFormat = output.formats.find(f => f.vcodec && f.vcodec !== 'none');
            videoUrl = mp4Format?.url || anyVideoFormat?.url || output.formats[output.formats.length - 1]?.url;
          }

          if (!videoUrl) {
            resolve({ success: false, error: 'No playable URL found' });
            return;
          }

          resolve({ success: true, videoUrl, title });
        } catch (parseError) {
          console.error('[YtdlpManager] JSON parse error:', parseError);
          resolve({ success: false, error: 'Failed to parse yt-dlp output' });
        }
      });
    });
  }
}

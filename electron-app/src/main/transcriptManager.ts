import { net } from 'electron';
import { TranscriptResult } from '../shared/types';
import { SubtitleInfo } from './ytdlpManager';
import { CACHE_DURATION_MS } from '../shared/constants';
import { parseVTT } from './vttParser';

const TRANSCRIPT_REQUEST_TIMEOUT_MS = 10000;

interface CachedTranscript {
  result: TranscriptResult;
  timestamp: number;
}

export class TranscriptManager {
  private cache: Map<string, CachedTranscript> = new Map();

  /**
   * Fetch and parse transcript from subtitle URL
   */
  async fetchTranscript(subtitleInfo: SubtitleInfo): Promise<TranscriptResult> {
    // Check cache first
    const cached = this.cache.get(subtitleInfo.url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached.result;
    }

    try {
      const vttContent = await this.fetchUrl(subtitleInfo.url);
      const segments = parseVTT(vttContent);

      if (segments.length === 0) {
        return { success: false, error: 'No transcript segments found' };
      }

      const fullText = segments.map(s => s.text).join(' ');

      const result: TranscriptResult = {
        success: true,
        segments,
        fullText,
        language: subtitleInfo.language
      };

      // Cache the result
      this.cache.set(subtitleInfo.url, {
        result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TranscriptManager] Failed to fetch transcript:', errorMessage);
      return { success: false, error: `Failed to fetch transcript: ${errorMessage}` };
    }
  }

  /**
   * Fetch URL content using Electron's net module
   */
  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const request = net.request(url);
      let data = '';

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          request.abort();
          reject(new Error('Transcript request timed out'));
        }
      }, TRANSCRIPT_REQUEST_TIMEOUT_MS);

      request.on('response', (response) => {
        clearTimeout(timeout);

        if (response.statusCode !== 200) {
          if (!settled) {
            settled = true;
            reject(new Error(`HTTP ${response.statusCode}`));
          }
          return;
        }

        response.on('data', (chunk) => {
          data += chunk.toString();
        });

        response.on('end', () => {
          if (!settled) {
            settled = true;
            resolve(data);
          }
        });

        response.on('error', (error: Error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        });
      });

      request.on('error', (error) => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });

      request.end();
    });
  }

  /**
   * Clear the transcript cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_DURATION_MS) {
        this.cache.delete(key);
      }
    }
  }
}

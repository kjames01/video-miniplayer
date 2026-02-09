import { net } from 'electron';
import { TranscriptSegment, TranscriptResult } from '../shared/types';
import { SubtitleInfo } from './ytdlpManager';
import { CACHE_DURATION_MS } from '../shared/constants';

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
      const segments = this.parseVTT(vttContent);

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
   * Parse VTT subtitle format into segments
   */
  private parseVTT(vttContent: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const lines = vttContent.split('\n');

    let currentSegment: Partial<TranscriptSegment> | null = null;
    let textLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip WEBVTT header and empty lines at the start
      if (trimmedLine === 'WEBVTT' || trimmedLine.startsWith('NOTE')) {
        continue;
      }

      // Check for timestamp line (e.g., "00:00:01.000 --> 00:00:04.000")
      const timestampMatch = trimmedLine.match(
        /^(\d{2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[.,](\d{3})/
      );

      if (timestampMatch) {
        // Save previous segment if exists
        if (currentSegment && textLines.length > 0) {
          currentSegment.text = this.cleanText(textLines.join(' '));
          if (currentSegment.text) {
            segments.push(currentSegment as TranscriptSegment);
          }
        }

        // Parse start time
        const startHours = timestampMatch[1] ? parseInt(timestampMatch[1]) : 0;
        const startMins = parseInt(timestampMatch[2]!);
        const startSecs = parseInt(timestampMatch[3]!);
        const startMs = parseInt(timestampMatch[4]!);
        const start = startHours * 3600 + startMins * 60 + startSecs + startMs / 1000;

        // Parse end time
        const endHours = timestampMatch[5] ? parseInt(timestampMatch[5]) : 0;
        const endMins = parseInt(timestampMatch[6]!);
        const endSecs = parseInt(timestampMatch[7]!);
        const endMs = parseInt(timestampMatch[8]!);
        const end = endHours * 3600 + endMins * 60 + endSecs + endMs / 1000;

        currentSegment = { start, end };
        textLines = [];
      } else if (trimmedLine && currentSegment) {
        // Skip cue identifiers (numeric lines before timestamps)
        if (!/^\d+$/.test(trimmedLine)) {
          textLines.push(trimmedLine);
        }
      } else if (!trimmedLine && currentSegment && textLines.length > 0) {
        // Empty line ends the current cue
        currentSegment.text = this.cleanText(textLines.join(' '));
        if (currentSegment.text) {
          segments.push(currentSegment as TranscriptSegment);
        }
        currentSegment = null;
        textLines = [];
      }
    }

    // Don't forget the last segment
    if (currentSegment && textLines.length > 0) {
      currentSegment.text = this.cleanText(textLines.join(' '));
      if (currentSegment.text) {
        segments.push(currentSegment as TranscriptSegment);
      }
    }

    // Deduplicate consecutive segments with same text (common in auto-generated captions)
    return this.deduplicateSegments(segments);
  }

  /**
   * Clean text by removing VTT formatting tags
   */
  private cleanText(text: string): string {
    return text
      // Remove VTT tags like <c>, </c>, <00:00:01.000>, etc.
      .replace(/<[^>]+>/g, '')
      // Remove positioning info like align:start position:0%
      .replace(/\b(align|position|line|size):[^\s]+/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Remove duplicate consecutive segments
   */
  private deduplicateSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
    const deduplicated: TranscriptSegment[] = [];

    for (const segment of segments) {
      const last = deduplicated[deduplicated.length - 1];
      if (!last || last.text !== segment.text) {
        deduplicated.push(segment);
      } else {
        // Extend the previous segment's end time
        last.end = segment.end;
      }
    }

    return deduplicated;
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

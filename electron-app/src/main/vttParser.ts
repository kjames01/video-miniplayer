import { TranscriptSegment } from '../shared/types';

/**
 * Clean cue text by removing VTT formatting tags and positioning metadata.
 */
export function cleanText(text: string): string {
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
 * Remove duplicate consecutive segments (common in auto-generated captions
 * where each cue repeats the previous line as it scrolls). Extends the kept
 * segment's end time to cover the merged range.
 */
export function deduplicateSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
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

const TIMESTAMP_PATTERN =
  /^(\d{2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[.,](\d{3})/;

/**
 * Parse WEBVTT subtitle content into timed transcript segments.
 *
 * Handles optional hour fields, both "." and "," millisecond separators,
 * cue identifiers (numeric lines before a timestamp), NOTE blocks, inline
 * formatting tags, and de-duplicates consecutive repeated cues.
 */
export function parseVTT(vttContent: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vttContent.split('\n');

  let currentSegment: Partial<TranscriptSegment> | null = null;
  let textLines: string[] = [];

  const flush = () => {
    if (currentSegment && textLines.length > 0) {
      currentSegment.text = cleanText(textLines.join(' '));
      if (currentSegment.text) {
        segments.push(currentSegment as TranscriptSegment);
      }
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip WEBVTT header and NOTE blocks
    if (trimmedLine === 'WEBVTT' || trimmedLine.startsWith('NOTE')) {
      continue;
    }

    const timestampMatch = trimmedLine.match(TIMESTAMP_PATTERN);

    if (timestampMatch) {
      // Save previous segment before starting a new one
      flush();

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
      flush();
      currentSegment = null;
      textLines = [];
    }
  }

  // Don't forget the last segment
  flush();

  return deduplicateSegments(segments);
}

import { parseVTT, cleanText, deduplicateSegments } from '../vttParser';
import { TranscriptSegment } from '../../shared/types';

describe('vttParser', () => {
  describe('parseVTT', () => {
    it('parses a basic two-cue VTT file', () => {
      const vtt = [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:04.000',
        'Hello world',
        '',
        '00:00:04.000 --> 00:00:06.500',
        'Second line',
        '',
      ].join('\n');

      const segments = parseVTT(vtt);

      expect(segments).toEqual<TranscriptSegment[]>([
        { start: 1, end: 4, text: 'Hello world' },
        { start: 4, end: 6.5, text: 'Second line' },
      ]);
    });

    it('parses timestamps without an hours field (MM:SS.mmm)', () => {
      const vtt = ['WEBVTT', '', '00:05.000 --> 00:08.000', 'No hours here', ''].join('\n');

      const segments = parseVTT(vtt);

      expect(segments).toEqual([{ start: 5, end: 8, text: 'No hours here' }]);
    });

    it('parses an explicit hours field', () => {
      const vtt = ['WEBVTT', '', '01:02:03.500 --> 01:02:05.000', 'With hours', ''].join('\n');

      const segments = parseVTT(vtt);

      // 1h + 2m + 3.5s = 3723.5
      expect(segments[0]!.start).toBeCloseTo(3723.5, 3);
      expect(segments[0]!.end).toBeCloseTo(3725, 3);
    });

    it('accepts a comma as the millisecond separator', () => {
      const vtt = ['WEBVTT', '', '00:00:01,250 --> 00:00:02,750', 'Comma ms', ''].join('\n');

      const segments = parseVTT(vtt);

      expect(segments).toEqual([{ start: 1.25, end: 2.75, text: 'Comma ms' }]);
    });

    it('ignores numeric cue identifiers before a timestamp', () => {
      const vtt = [
        'WEBVTT',
        '',
        '1',
        '00:00:01.000 --> 00:00:02.000',
        'Cue text',
        '',
      ].join('\n');

      const segments = parseVTT(vtt);

      expect(segments).toEqual([{ start: 1, end: 2, text: 'Cue text' }]);
    });

    it('skips NOTE blocks', () => {
      const vtt = [
        'WEBVTT',
        '',
        'NOTE This is a comment',
        '',
        '00:00:01.000 --> 00:00:02.000',
        'Real text',
        '',
      ].join('\n');

      const segments = parseVTT(vtt);

      expect(segments).toEqual([{ start: 1, end: 2, text: 'Real text' }]);
    });

    it('strips inline VTT formatting tags', () => {
      const vtt = [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:03.000',
        '<c.colorE5E5E5>Hello</c> <00:00:02.000><c> there</c>',
        '',
      ].join('\n');

      const segments = parseVTT(vtt);

      expect(segments[0]!.text).toBe('Hello there');
    });

    it('joins multi-line cue text with a space', () => {
      const vtt = [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:05.000',
        'Line one',
        'Line two',
        '',
      ].join('\n');

      const segments = parseVTT(vtt);

      expect(segments[0]!.text).toBe('Line one Line two');
    });

    it('captures the final cue when the file has no trailing blank line', () => {
      const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', 'Last cue'].join('\n');

      const segments = parseVTT(vtt);

      expect(segments).toEqual([{ start: 1, end: 2, text: 'Last cue' }]);
    });

    it('drops cues whose text is empty after cleaning', () => {
      const vtt = [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:02.000',
        '<c></c>',
        '',
        '00:00:02.000 --> 00:00:03.000',
        'Kept',
        '',
      ].join('\n');

      const segments = parseVTT(vtt);

      expect(segments).toEqual([{ start: 2, end: 3, text: 'Kept' }]);
    });

    it('deduplicates consecutive repeated cues and extends the end time', () => {
      const vtt = [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:02.000',
        'Repeated',
        '',
        '00:00:02.000 --> 00:00:03.000',
        'Repeated',
        '',
        '00:00:03.000 --> 00:00:04.000',
        'Different',
        '',
      ].join('\n');

      const segments = parseVTT(vtt);

      expect(segments).toEqual([
        { start: 1, end: 3, text: 'Repeated' },
        { start: 3, end: 4, text: 'Different' },
      ]);
    });

    it('returns an empty array for empty or header-only input', () => {
      expect(parseVTT('')).toEqual([]);
      expect(parseVTT('WEBVTT\n')).toEqual([]);
    });

    it('handles \\r\\n line endings', () => {
      const vtt = 'WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nCRLF text\r\n';

      const segments = parseVTT(vtt);

      expect(segments).toEqual([{ start: 1, end: 2, text: 'CRLF text' }]);
    });
  });

  describe('cleanText', () => {
    it('removes tags, positioning metadata, and normalizes whitespace', () => {
      expect(cleanText('<c>Hello</c>   world')).toBe('Hello world');
      expect(cleanText('Text align:start position:50%')).toBe('Text');
      expect(cleanText('  spaced   out  ')).toBe('spaced out');
    });
  });

  describe('deduplicateSegments', () => {
    it('keeps non-consecutive duplicates', () => {
      const input: TranscriptSegment[] = [
        { start: 0, end: 1, text: 'A' },
        { start: 1, end: 2, text: 'B' },
        { start: 2, end: 3, text: 'A' },
      ];

      expect(deduplicateSegments(input)).toEqual(input);
    });

    it('merges consecutive duplicates, extending the end time', () => {
      const input: TranscriptSegment[] = [
        { start: 0, end: 1, text: 'A' },
        { start: 1, end: 2, text: 'A' },
      ];

      expect(deduplicateSegments(input)).toEqual([{ start: 0, end: 2, text: 'A' }]);
    });
  });
});

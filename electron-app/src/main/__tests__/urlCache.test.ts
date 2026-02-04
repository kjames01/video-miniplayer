import { UrlCache } from '../urlCache';

describe('UrlCache', () => {
  let cache: UrlCache;

  beforeEach(() => {
    cache = new UrlCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve a URL entry', () => {
      const url = 'https://example.com/video';
      const data = { videoUrl: 'https://cdn.example.com/video.mp4', title: 'Test Video' };

      cache.set(url, data);
      const result = cache.get(url);

      expect(result).not.toBeNull();
      expect(result?.videoUrl).toBe(data.videoUrl);
      expect(result?.title).toBe(data.title);
    });

    it('should return null for non-existent entries', () => {
      const result = cache.get('https://nonexistent.com');
      expect(result).toBeNull();
    });

    it('should overwrite existing entries with same URL', () => {
      const url = 'https://example.com/video';
      cache.set(url, { videoUrl: 'old.mp4', title: 'Old' });
      cache.set(url, { videoUrl: 'new.mp4', title: 'New' });

      const result = cache.get(url);
      expect(result?.videoUrl).toBe('new.mp4');
      expect(result?.title).toBe('New');
    });
  });

  describe('expiration', () => {
    it('should return null for expired entries (after 30 minutes)', () => {
      const url = 'https://example.com/video';
      cache.set(url, { videoUrl: 'video.mp4', title: 'Test' });

      // Advance time by 31 minutes
      jest.advanceTimersByTime(31 * 60 * 1000);

      const result = cache.get(url);
      expect(result).toBeNull();
    });

    it('should return entry before expiration', () => {
      const url = 'https://example.com/video';
      cache.set(url, { videoUrl: 'video.mp4', title: 'Test' });

      // Advance time by 29 minutes (still valid)
      jest.advanceTimersByTime(29 * 60 * 1000);

      const result = cache.get(url);
      expect(result).not.toBeNull();
    });

    it('should delete expired entry when accessed', () => {
      const url = 'https://example.com/video';
      cache.set(url, { videoUrl: 'video.mp4', title: 'Test' });

      jest.advanceTimersByTime(31 * 60 * 1000);

      // First access should return null and delete
      cache.get(url);

      // Second access should also return null
      expect(cache.get(url)).toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('url1', { videoUrl: 'v1.mp4', title: 'Video 1' });
      cache.set('url2', { videoUrl: 'v2.mp4', title: 'Video 2' });

      cache.clear();

      expect(cache.get('url1')).toBeNull();
      expect(cache.get('url2')).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should remove only expired entries', () => {
      cache.set('old', { videoUrl: 'old.mp4', title: 'Old' });

      // Advance 31 minutes
      jest.advanceTimersByTime(31 * 60 * 1000);

      // Add new entry
      cache.set('new', { videoUrl: 'new.mp4', title: 'New' });

      // Run cleanup
      cache.cleanup();

      expect(cache.get('old')).toBeNull();
      expect(cache.get('new')).not.toBeNull();
    });

    it('should not remove valid entries', () => {
      cache.set('valid1', { videoUrl: 'v1.mp4', title: 'V1' });
      cache.set('valid2', { videoUrl: 'v2.mp4', title: 'V2' });

      cache.cleanup();

      expect(cache.get('valid1')).not.toBeNull();
      expect(cache.get('valid2')).not.toBeNull();
    });
  });
});

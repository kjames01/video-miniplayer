interface CacheEntry {
  videoUrl: string;
  title: string;
  timestamp: number;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export class UrlCache {
  private cache: Map<string, CacheEntry> = new Map();

  get(url: string): CacheEntry | null {
    const entry = this.cache.get(url);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(url);
      return null;
    }

    return entry;
  }

  set(url: string, data: { videoUrl: string; title: string }): void {
    this.cache.set(url, {
      ...data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }
}

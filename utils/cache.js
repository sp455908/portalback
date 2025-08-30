// Simple in-memory cache for performance optimization
class SimpleCache {
  constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  // Set a value in cache
  set(key, value, customTtl = null) {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const ttl = customTtl || this.ttl;
    const expiry = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expiry
    });
  }

  // Get a value from cache
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  // Check if key exists and is not expired
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Delete a key
  delete(key) {
    return this.cache.delete(key);
  }

  // Clear all cache
  clear() {
    this.cache.clear();
  }

  // Get cache size
  size() {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Create cache instances for different purposes
const userCache = new SimpleCache(50, 2 * 60 * 1000); // 2 minutes TTL for user data
const loginAttemptCache = new SimpleCache(100, 1 * 60 * 1000); // 1 minute TTL for login attempts
const adminCountCache = new SimpleCache(10, 5 * 60 * 1000); // 5 minutes TTL for admin count

// Cleanup expired entries every minute
setInterval(() => {
  userCache.cleanup();
  loginAttemptCache.cleanup();
  adminCountCache.cleanup();
}, 60 * 1000);

module.exports = {
  SimpleCache,
  userCache,
  loginAttemptCache,
  adminCountCache
}; 
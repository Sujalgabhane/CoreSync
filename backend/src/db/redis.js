require('dotenv').config();

let redisClient;

const REST_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_URL  = process.env.REDIS_URL;

// ── Strategy 1: Upstash HTTP REST (works through any firewall) ─────────────
if (REST_URL && REST_TOKEN) {
  const { Redis } = require('@upstash/redis');

  const upstash = new Redis({ url: REST_URL, token: REST_TOKEN });

  // Test connection
  upstash.ping()
    .then(() => console.log('✅ Upstash Redis connected (HTTP REST)'))
    .catch(err => console.warn('⚠️  Upstash REST ping failed:', err.message));

  redisClient = {
    async get(key) {
      try { return await upstash.get(key); }
      catch { return null; }
    },
    async set(key, value, exMode, ttl) {
      try {
        if (exMode === 'EX' && ttl) return await upstash.set(key, value, { ex: ttl });
        return await upstash.set(key, value);
      } catch { return 'OK'; }
    },
    async del(key) {
      try { return await upstash.del(key); }
      catch { return 0; }
    },
    async exists(key) {
      try { return await upstash.exists(key); }
      catch { return 0; }
    },
    isReady() { return true; },
    raw: () => upstash,
  };

// ── Strategy 2: ioredis TCP (if REST not configured) ──────────────────────
} else if (REDIS_URL) {
  const Redis = require('ioredis');

  const ioredis = new Redis(REDIS_URL, {
    lazyConnect: true,
    tls: REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 500, 2000);
    },
    enableOfflineQueue: false,
  });

  ioredis.on('connect', () => console.log('✅ Redis connected (ioredis TCP)'));
  ioredis.on('error', (err) => {
    console.warn('⚠️  Redis TCP unavailable:', err.message);
    console.warn('→ Set UPSTASH_REDIS_REST_URL + TOKEN in .env to use HTTP instead');
  });

  ioredis.connect().catch(() => {});

  const memStore = new Map();

  redisClient = {
    async get(key) {
      if (ioredis.status === 'ready') return ioredis.get(key);
      return memStore.get(key) ?? null;
    },
    async set(key, value, exMode, ttl) {
      if (ioredis.status === 'ready') {
        if (exMode === 'EX' && ttl) return ioredis.set(key, value, exMode, ttl);
        return ioredis.set(key, value);
      }
      memStore.set(key, value);
      return 'OK';
    },
    async del(key) {
      if (ioredis.status === 'ready') return ioredis.del(key);
      memStore.delete(key);
      return 1;
    },
    async exists(key) {
      if (ioredis.status === 'ready') return ioredis.exists(key);
      return memStore.has(key) ? 1 : 0;
    },
    isReady() { return ioredis.status === 'ready'; },
    raw: () => ioredis,
  };

// ── Strategy 3: In-memory fallback (no Redis at all) ──────────────────────
} else {
  console.warn('⚠️  No Redis configured — using in-memory fallback (not suitable for production)');

  const memStore = new Map();

  redisClient = {
    async get(key)             { return memStore.get(key) ?? null; },
    async set(key, value)      { memStore.set(key, value); return 'OK'; },
    async del(key)             { memStore.delete(key); return 1; },
    async exists(key)          { return memStore.has(key) ? 1 : 0; },
    isReady()                  { return false; },
    raw: ()                    => null,
  };
}

module.exports = redisClient;

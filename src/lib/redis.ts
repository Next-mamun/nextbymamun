import { Redis } from '@upstash/redis';

// Note: Ensure VITE_UPSTASH_REDIS_REST_URL and VITE_UPSTASH_REDIS_REST_TOKEN are set in your environment
const url = import.meta.env.VITE_UPSTASH_REDIS_REST_URL || 'https://relative-oyster-81682.upstash.io';
const token = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAT8SAAIgcDFkZTBkNjg1ZmE2NzE0NjFkYjUzOGU3MTRkYWM2YzgwZQ';

export const redis = new Redis({
  url: url,
  token: token,
});

export const invalidatePostsCache = async () => {
  try {
    const keys = await redis.keys('posts_cache_*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (e) {
    console.error('Redis invalidation error:', e);
  }
};


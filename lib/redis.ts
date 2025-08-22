let redis: any;

function getRedisClient() {
  if (!redis && typeof window === 'undefined') {
    const Redis = require('ioredis').default || require('ioredis');
    redis = new Redis(process.env.KV_URL!);
  }
  return redis;
}

// Pipeline class to match @vercel/kv pipeline interface
class Pipeline {
  private pipeline: any;

  constructor() {
    const redisClient = getRedisClient();
    this.pipeline = redisClient.pipeline();
  }

  set(key: string, value: any): Pipeline {
    this.pipeline.set(key, JSON.stringify(value));
    return this;
  }

  get(key: string): Pipeline {
    this.pipeline.get(key);
    return this;
  }

  del(key: string): Pipeline {
    this.pipeline.del(key);
    return this;
  }

  lrem(key: string, count: number, value: string): Pipeline {
    this.pipeline.lrem(key, count, value);
    return this;
  }

  lpush(key: string, value: any): Pipeline {
    this.pipeline.lpush(key, typeof value === 'string' ? value : JSON.stringify(value));
    return this;
  }

  ltrim(key: string, start: number, stop: number): Pipeline {
    this.pipeline.ltrim(key, start, stop);
    return this;
  }

  incrby(key: string, value: number): Pipeline {
    this.pipeline.incrby(key, value);
    return this;
  }

  async exec<T = any>(): Promise<T[]> {
    const results = await this.pipeline.exec();
    if (!results) return [];
    
    return results.map(([err, result]: [Error | null, any]) => {
      if (err) throw err;
      
      // Try to parse JSON if it's a string (for GET operations)
      if (typeof result === 'string') {
        try {
          return JSON.parse(result);
        } catch {
          return result;
        }
      }
      return result;
    }) as T[];
  }
}

// KV-compatible interface
export const kv = {
  async get<T = any>(key: string): Promise<T | null> {
    const redisClient = getRedisClient();
    const result = await redisClient.get(key);
    if (!result) return null;
    
    try {
      return JSON.parse(result);
    } catch {
      return result as T;
    }
  },

  async set(key: string, value: any): Promise<'OK'> {
    const redisClient = getRedisClient();
    await redisClient.set(key, JSON.stringify(value));
    return 'OK';
  },

  async del(key: string): Promise<number> {
    const redisClient = getRedisClient();
    return await redisClient.del(key);
  },

  async lrange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    const redisClient = getRedisClient();
    const results = await redisClient.lrange(key, start, stop);
    return results.map((result: string) => {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }) as T[];
  },

  async lpush(key: string, value: any): Promise<number> {
    const redisClient = getRedisClient();
    return await redisClient.lpush(key, typeof value === 'string' ? value : JSON.stringify(value));
  },

  async lrem(key: string, count: number, value: string): Promise<number> {
    const redisClient = getRedisClient();
    return await redisClient.lrem(key, count, value);
  },

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    const redisClient = getRedisClient();
    await redisClient.ltrim(key, start, stop);
    return 'OK';
  },

  async incrby(key: string, value: number): Promise<number> {
    const redisClient = getRedisClient();
    return await redisClient.incrby(key, value);
  },

  pipeline(): Pipeline {
    return new Pipeline();
  }
};

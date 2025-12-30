import { Redis } from "@upstash/redis";

// Redis initialization may vary based on provider or other considerations
// See, for instance Redis.fromEnv() on the upstash client
// which defaults to `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
export const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

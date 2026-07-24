import { createClient, RedisClientType } from "redis";
import logger from "./logger";
let redisClient: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }
  redisClient = createClient({
    url: process.env.REDIS_URL!,
  });
  await redisClient.connect();
  redisClient.on('error', (err) => logger.error('Redis error', err))
  logger.info("Redis connected");
  return redisClient;
}
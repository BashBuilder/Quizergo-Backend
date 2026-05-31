import { createClient, RedisClientType } from "redis";
import { redisConfig } from "../config/redis.js";
import Logger from "../../core/Logger.js";

const redisUrl = `redis://default:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}`;

const redisClient: RedisClientType = createClient({ url: redisUrl });

redisClient.on("connect", () => console.log("Redis client connected"));
redisClient.on("error", (err) => console.error("Redis client error", err));

export async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (error) {
    Logger.error("Error connecting to Redis", error);
    setTimeout(connectRedis, 5000);
  }
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}

export default redisClient;

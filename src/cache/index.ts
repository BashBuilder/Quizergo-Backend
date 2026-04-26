import { createClient, RedisClientType } from "redis";
import { redisConfig } from "../config/redis.js";
import Logger from "../../core/Logger.js";

const redisUrl = `redis://default:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}`;

const redisClient: RedisClientType = createClient({ url: redisUrl });

redisClient.on("connect", () => console.log("Redis client connected"));
redisClient.on("ready", () => console.log("Redis client ready"));
redisClient.on("error", (err) => console.error("Redis client error", err));
redisClient.on("end", () => console.log("Redis client disconnected"));
redisClient.on("reconnecting", () => console.log("Redis client reconnecting"));

export async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (error) {
    Logger.error("Error connecting to Redis", error);
    setTimeout(connectRedis, 5000);
  }
}

process.on("SIGINT", async () => {
  await redisClient.quit();
  console.log("Redis client disconnected");
  process.exit(0);
});

export default redisClient;

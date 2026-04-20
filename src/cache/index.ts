import { createClient } from "redis";
import { redisConfig } from "../config/redis.js";

const redisUrl = `redis://default:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}`;

const redisClient = createClient({ url: redisUrl });

redisClient.on("connect", () => console.log("Redis client connected"));
redisClient.on("ready", () => console.log("Redis client ready"));
redisClient.on("error", (err) => console.error("Redis client error", err));
redisClient.on("end", () => console.log("Redis client disconnected"));
redisClient.on("reconnecting", () => console.log("Redis client reconnecting"));

async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error("Error connecting to Redis:", error);
    setTimeout(connectRedis, 5000); // Retry after 5 seconds
  }
}

connectRedis();

process.on("SIGINT", async () => {
  try {
    await redisClient.quit();
    console.log("Redis client disconnected");
    process.exit(0);
  } catch (error) {
    console.error("Error disconnecting from Redis:", error);
    process.exit(1);
  }
});

export default redisClient;

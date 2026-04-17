import { configDotenv } from "dotenv";

configDotenv();

export const redisConfig = {
  host: process.env.REDIS_HOST || "",
  password: process.env.REDIS_PASSWORD || "",
  port: process.env.REDIS_PORT || 0,
};

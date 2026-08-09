import express, { Express } from "express";
import "dotenv/config.js";
import "./cache/index.js";
import "./services/event.service.js";
import "./services/event.service.js";
import { errorHandler } from "./lib/middleware.js";
import { prisma } from "./config/prisma.js";
import { connectRedis, disconnectRedis } from "./cache/index.js";
import Logger from "./core/Logger.js";
import { registerRoutes } from "./routes/index.js";
import registerMiddleware from "./middleware/index.js";

const app: Express = express();

registerMiddleware(app);
registerRoutes(app);

app.use(errorHandler);
export const initializeApp = async () => {
  try {
    await prisma
      .$connect()
      .then(() => Logger.info("Connected to PostgreSQL database"));
    await connectRedis();
  } catch (error) {
    Logger.error("Error starting server", error);
  }
};

initializeApp();

export async function shutdown() {
  await prisma.$disconnect();
  await disconnectRedis();
}

export default app;

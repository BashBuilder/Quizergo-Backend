import express, { Express } from "express";
import "dotenv/config.js";
import cors from "cors";
import helmet from "helmet";
import "./cache/index.js";
import "./services/event.service.js";
import { errorHandler } from "./lib/middleware.js";
import cookieParser from "cookie-parser";
import { prisma } from "./config/prisma.js";
import { connectRedis, disconnectRedis } from "./cache/index.js";
import Logger from "../core/Logger.js";
import { registerRoutes } from "./routes/index.js";

const app: Express = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

registerRoutes(app);

// Error handler interceptor
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

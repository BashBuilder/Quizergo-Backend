import express, { Express } from "express";
import "dotenv/config.js";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.route.js";
import "./cache/index.js";
import "./services/email.service.js";
import "./services/event.service.js";
import questionRoutes from "./routes/question.route.js";
import { errorHandler } from "./lib/middleware.js";
import cookieParser from "cookie-parser";
import quizRoutes from "./routes/quiz.route.js";
import { prisma } from "./config/prisma.js";
import { connectRedis, disconnectRedis } from "./cache/index.js";
import Logger from "../core/Logger.js";

const app: Express = express();
export const version = "api/v1";

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (_, res) => res.send("Server is ok"));

app.use(`/${version}/auth`, authRoutes);
app.use(`/${version}/questions`, questionRoutes);
app.use(`/${version}/quiz`, quizRoutes);

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

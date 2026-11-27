import { Router } from "express";
import helmet from "helmet";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";

export default function registerMiddleware(app: Router) {
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
}

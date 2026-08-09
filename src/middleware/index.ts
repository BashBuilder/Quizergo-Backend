import { Router } from "express";
import helmet from "helmet";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";

export default function registerMiddleware(app: Router) {
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
}

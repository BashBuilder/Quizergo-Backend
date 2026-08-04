import { Router } from "express";
import authRoutes from "./auth.route.js";
import questionRoutes from "./question.route.js";
import quizRoutes from "./quiz.route.js";

export const version = "api/v1";

export const registerRoutes = (app: Router) => {
  app.get("/", (req, res) => {
    res.send("Welcome to Quizergo API");
  });

  app.get("/health", (_, res) => res.send("Server is ok"));
  app.use(`/${version}/auth`, authRoutes);
  app.use(`/${version}/questions`, questionRoutes);
  app.use(`/${version}/quiz`, quizRoutes);

  app.use((_, res) => {
    res.status(404).send("Not found");
  });
};

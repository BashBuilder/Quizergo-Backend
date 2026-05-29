// routes/quiz.routes.ts
import { Router } from "express";
import {
  createSession,
  syncAnswers,
  submitSession,
} from "../controllers/quiz.controller.js";
import rateLimit from "express-rate-limit";
import authMiddleware from "../middleware/auth.middleware.js";

const quizRouter: Router = Router();

const submitLimiter = rateLimit({ windowMs: 60_000, max: 10 });

quizRouter.post("/session", authMiddleware, createSession);
quizRouter.patch("/session/:sessionId/sync", authMiddleware, syncAnswers);
quizRouter.post(
  "/session/:sessionId/submit",
  authMiddleware,
  submitLimiter,
  submitSession,
);

export default quizRouter;

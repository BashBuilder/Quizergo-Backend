import { Router } from "express";
import {
  createSession,
  syncAnswers,
  submitSession,
} from "../controllers/quiz.controller.js";
import rateLimit from "express-rate-limit";
import requireAuth from "../middleware/auth.middleware.js";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import {
  createSessionModel,
  answersModel,
  sessionValidation,
} from "../models/quiz.model.js";

const quizRoutes: Router = Router();
const submitLimiter = rateLimit({ windowMs: 60_000, max: 1 });

quizRoutes.use(requireAuth);

quizRoutes.post(
  "",
  validateRequest(createSessionModel, ValidationSource.BODY),
  createSession,
);
quizRoutes.patch(
  "/:sessionId/sync",
  validateRequest(answersModel, ValidationSource.BODY),
  syncAnswers,
);
quizRoutes.post(
  "/:sessionId/submit",
  submitLimiter,
  validateRequest(sessionValidation, ValidationSource.PARAMS),
  validateRequest(answersModel, ValidationSource.BODY),
  submitSession,
);

export default quizRoutes;

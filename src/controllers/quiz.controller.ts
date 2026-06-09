import { NextFunction, Request, Response } from "express";
import eventEmitter from "../config/events.js";
import { QuizSessionService } from "../services/quiz.service.js";
import { UserProgressService } from "../services/user.progress.service.js";
import {
  AnswerValidationType,
  CreateSessionType,
  SessionValidationType,
} from "../models/quiz.model.js";

const sessionService = new QuizSessionService();
const progressService = new UserProgressService();

export const createSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { subjects, questionCount, duration } = req.body as CreateSessionType;

    const session = await sessionService.createSession(user.id, {
      subjects,
      questionCount,
      duration,
    });

    eventEmitter.emit("quiz.started", {
      userId: user.id,
      subjects,
      sessionId: session.sessionId,
    });
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};

export const syncAnswers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { sessionId } = req.params as SessionValidationType;
    const { answers } = req.body as AnswerValidationType;

    const result = await sessionService.syncAnswers(
      sessionId as string,
      user.id,
      answers,
    );
    res.status(200).json({ message: "Answers synced", ...result });
  } catch (error: any) {
    if (error.message === "Session not found or expired") {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

export const submitSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { sessionId } = req.params as SessionValidationType;
    const { answers } = req.body as AnswerValidationType;

    const result = await sessionService.gradeSession(
      sessionId,
      user.id,
      answers,
    );

    progressService
      .saveResult(user.id, result)
      .catch((err) => console.error("Failed to persist quiz result:", err));

    eventEmitter.emit("quiz.submitted", {
      userId: user.id,
      sessionId,
      score: result.score,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

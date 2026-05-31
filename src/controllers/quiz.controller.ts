// controllers/quiz.controller.ts
import { NextFunction, Request, Response } from "express";
import eventEmitter from "../config/events.js";
import { QuizSessionService } from "../services/quiz.service.js";
import { UserProgressService } from "../services/user.progress.service.js";
import { AnswerType } from "../models/quiz.model.js";

const sessionService = new QuizSessionService();
const progressService = new UserProgressService();

export const createSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { subjects, questionCount, duration } = req.body;
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
    const { sessionId } = req.params;
    const { answers } = req.body;

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ message: "answers object is required" });
    }
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
  req: Request<{ sessionId: string }, {}, AnswerType>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;
    const { answers } = req.body;

    const result: QuizResultReturnType = await sessionService.gradeSession(
      sessionId as string,
      user.id,
      answers,
    );
    await progressService.saveResult(user.id, result);
    eventEmitter.emit("quiz.submitted", {
      userId: user.id,
      sessionId,
      score: result.score,
    });

    res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "Already submitted") {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

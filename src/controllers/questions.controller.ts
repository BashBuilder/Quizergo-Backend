import { NextFunction, Request, Response } from "express";
import { subjects } from "../lib/constants.js";
import { DbQuestionService } from "../services/db.question.service.js";
import eventEmitter from "../config/events.js";

export const getSubjectLists = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.status(200).json(subjects);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch questions" });
  }
};

export const getQuestionsBySubject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { subject: subjectQuery, limit } = req.query;
    const subjectValue =
      typeof subjectQuery === "string"
        ? subjectQuery
        : Array.isArray(subjectQuery) && typeof subjectQuery[0] === "string"
          ? subjectQuery[0]
          : undefined;

    if (!subjectValue) {
      return res.status(400).json({ message: "Subject is required" });
    }

    const user = req.user;
    const dbService = new DbQuestionService();
    const questions = await dbService.getQuestionsBySubject(
      subjectValue,
      limit ? Number(limit) : undefined,
    );

    eventEmitter.emit("quiz.started", { user, subject: subjectValue });

    res.status(200).json({ questions });
    eventEmitter.emit("question.fetched", questions);
  } catch (error: any) {
    next(error);
  }
};

export const gradeScore = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { answers } = req.body;
  } catch (error) {
    next(error);
  }
};

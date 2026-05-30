import { NextFunction, Request, Response } from "express";
import { subjects } from "../lib/constants.js";
import { AlocQuestionService } from "../services/aloc.question.service.js";
import eventEmitter from "../config/events.js";
import redisClient from "../cache/index.js";

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
    const subjectValue = Array.isArray(subjectQuery)
      ? subjectQuery[0]
      : (subjectQuery as string);

    if (!subjectValue) {
      return res.status(400).json({ message: "Subject is required" });
    }

    // @ts-expect-error "type validation"
    const subject: string = subjectValue;
    const user = req.user;
    const alocService = new AlocQuestionService();
    const questions: {
      subject: string;
      status: number;
      data: AlocQuestionType[];
    } = await alocService.getQuestionsBySubject(
      subject,
      limit ? parseInt(limit as string) : undefined,
    );

    const cacheQuestionKey = `questions:${subject}.user:${user?.id}`;
    await redisClient.set(cacheQuestionKey, JSON.stringify(questions));

    eventEmitter.emit("quiz.started", { user, subject });

    res.status(200).json({ questions });
    eventEmitter.emit("aloc.question.fetched", questions);
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

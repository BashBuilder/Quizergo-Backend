import { NextFunction, Request, Response } from "express";
import { subjects } from "../lib/constants.js";
import { AlocQuestionService } from "../services/aloc.question.service.js";
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
    const { subject, limit } = req.query;
    const alocService = new AlocQuestionService();
    const questions = await alocService.getQuestionsBySubject(
      subject as string,
      limit ? parseInt(limit as string) : undefined,
    );

    res.status(200).json({ questions });
    eventEmitter.emit("aloc.question.fetched", questions);
  } catch (error: any) {
    next(error);
  }
};

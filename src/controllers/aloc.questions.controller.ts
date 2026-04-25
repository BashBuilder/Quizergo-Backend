import { Request, Response, NextFunction } from "express";
import z from "zod";
import { AlocQuestionService } from "../services/aloc.question.service.js";
import eventEmitter from "../config/events.js";

export const getQuestionsBySubject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { subject, limit } = req.query;
    const schema = z.object({
      subject: z.string(),
      limit: z.string().optional(),
    });
    const validation = schema.safeParse({ subject, limit });
    if (!validation.success) {
      return res.status(400).json({ message: validation.error.message });
    }
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

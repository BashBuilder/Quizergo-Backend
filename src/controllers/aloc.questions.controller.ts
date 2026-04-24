import { Request, Response } from "express";
import z from "zod";
import { AlocQuestionService } from "../services/aloc.question.service.js";

export const getQuestionsBySubject = async (req: Request, res: Response) => {
  try {
    const { subject, limit } = req.query;
    const schemat = z.object({
      subject: z.string(),
      limit: z.string().optional(),
    });
    const validation = schemat.safeParse({ subject, limit });
    if (!validation.success) {
      return res.status(400).json({ message: validation.error.message });
    }
    const alocService = new AlocQuestionService();
    const questions = await alocService.getQuestionsBySubject(
      subject as string,
      limit ? parseInt(limit as string) : undefined,
    );

    res.status(200).json({ questions });
  } catch (error: any) {
    console.log("Error fetching questions from ALOC:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch questions from ALOC",
    });
  }
};

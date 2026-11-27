import { NextFunction, Request, Response } from "express";
import { DbQuestionService } from "../services/db.question.service.js";
import eventEmitter from "../config/events.js";
import { BadRequestError, handleFunctionError } from "../lib/errors.js";
import { prisma } from "../config/prisma.js";

export const getSubjectLists = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subjects = await new DbQuestionService().getSubjects();
    res.status(200).json(subjects);
  } catch (error) {
    next(error);
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

interface GradeRequest {
  subject: string;
  answers: Record<string, string>;
}

export const gradeScore = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { subject, answers } = req.body as GradeRequest;

    if (!subject || !answers || typeof answers !== "object") {
      throw new BadRequestError("Subject and answers are required");
    }

    const dbService = new DbQuestionService();
    const questionIds = Object.keys(answers);

    if (questionIds.length === 0) {
      throw new BadRequestError("At least one answer is required");
    }

    // Fetch questions to get correct answers
    const questions = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
        subject: subject.toLowerCase(),
      },
      select: { id: true, answer: true },
    });

    if (questions.length === 0) {
      throw new BadRequestError("No matching questions found for grading");
    }

    // Create a map of questionId -> correctAnswer
    const correctAnswers = new Map(questions.map((q) => [q.id, q.answer]));

    let score = 0;
    const breakdown = questionIds.map((qid) => {
      const userAnswer = answers[qid]?.toLowerCase().trim();
      const correctAnswer = correctAnswers.get(qid)?.toLowerCase().trim();
      const isCorrect = userAnswer === correctAnswer;
      if (isCorrect) score++;
      return {
        questionId: qid,
        userAnswer,
        correctAnswer,
        isCorrect,
      };
    });

    res.status(200).json({
      score,
      total: questionIds.length,
      breakdown,
    });
  } catch (error) {
    next(handleFunctionError(error));
  }
};

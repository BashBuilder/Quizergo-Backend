// // controllers/quiz.controller.ts
// import { NextFunction, Request, Response } from "express";
// import eventEmitter from "../config/events.js";
// import { QuizSessionService } from "../services/quiz.service.js";
// import { UserProgressService } from "../services/user.progress.service.js";
// import { AnswerType } from "../models/quiz.model.js";

// const sessionService = new QuizSessionService();
// const progressService = new UserProgressService();

// export const createSession = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const user = req.user!;
//     const { subjects, questionCount, duration } = req.body;
//     const session = await sessionService.createSession(user.id, {
//       subjects,
//       questionCount,
//       duration,
//     });
//     eventEmitter.emit("quiz.started", {
//       userId: user.id,
//       subjects,
//       sessionId: session.sessionId,
//     });
//     res.status(201).json(session);
//   } catch (error) {
//     next(error);
//   }
// };

// export const syncAnswers = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const user = req.user!;
//     const { sessionId } = req.params;
//     const { answers } = req.body;

//     if (!answers || typeof answers !== "object") {
//       return res.status(400).json({ message: "answers object is required" });
//     }
//     const result = await sessionService.syncAnswers(
//       sessionId as string,
//       user.id,
//       answers,
//     );
//     res.status(200).json({ message: "Answers synced", ...result });
//   } catch (error: any) {
//     if (error.message === "Session not found or expired") {
//       return res.status(404).json({ message: error.message });
//     }
//     next(error);
//   }
// };

// export const submitSession = async (
//   req: Request<{ sessionId: string }, {}, AnswerType>,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const user = req.user!;
//     const { sessionId } = req.params;
//     const { answers } = req.body;

//     const result: QuizResultReturnType = await sessionService.gradeSession(
//       sessionId as string,
//       user.id,
//       answers,
//     );
//     await progressService.saveResult(user.id, result);
//     eventEmitter.emit("quiz.submitted", {
//       userId: user.id,
//       sessionId,
//       score: result.score,
//     });

//     res.status(200).json(result);
//   } catch (error: any) {
//     next(error);
//   }
// };

// controllers/quiz.controller.ts
import { NextFunction, Request, Response } from "express";
import eventEmitter from "../config/events.js";
import { QuizSessionService } from "../services/quiz.service.js";
import { UserProgressService } from "../services/user.progress.service.js";

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

    if (!subjects?.length) {
      return res
        .status(400)
        .json({ message: "At least one subject is required" });
    }
    if (!questionCount || questionCount < 1) {
      return res
        .status(400)
        .json({ message: "questionCount must be at least 1" });
    }

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

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: "answers must be an array" });
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
  req: Request<{ sessionId: string }, {}, { answers: AnswersType[] | null }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;
    const { answers } = req.body;

    const result = await sessionService.gradeSession(
      sessionId,
      user.id,
      answers ?? null,
    );

    // Fire and forget — don't block the response on DB write
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

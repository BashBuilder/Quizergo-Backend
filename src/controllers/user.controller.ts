import { Request, Response, NextFunction } from "express";
import { getUserQuizHistory } from "../services/user.service.js";

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    return res.status(200).json({ user });
  } catch (error: any) {
    next(error);
  }
};

export const getUserHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const userHistory = await getUserQuizHistory(user.id, { page, limit });
    return res.status(200).json(userHistory);
  } catch (error: any) {
    next(error);
  }
};

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

    const userHistory = await getUserQuizHistory(user.id);
    return res.status(200).json(userHistory);
  } catch (error: any) {
    next(error);
  }
};

import { NextFunction, Request, Response } from "express";
import { subjects } from "../lib/constants.js";

export const getSubjectLists = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.status(200).json(subjects);
  } catch (error) {
    next(error);
  }
};

import { ZodError, ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";

export enum ValidationSource {
  BODY = "body",
  QUERY = "query",
  PARAMS = "params",
  HEADERS = "headers",
  COOKIES = "cookies",
}

const validateRequest = (
  schema: ZodSchema,
  source: ValidationSource = ValidationSource.BODY,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log(req[source]);
      const data = schema.parse(req[source]);
      Object.assign(req[source], data);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map((err) => err.message).join(", ");
        return next(new BadRequestError(message));
      }
      next(error);
    }
  };
};

export const validateAuth = (
  schema: ZodSchema,
  source: ValidationSource = ValidationSource.BODY,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      Object.assign(req[source], data);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map((err) => err.message).join(", ");
        return next(new UnauthorizedError(message));
      }
      next(error);
    }
  };
};

export default validateRequest;

import { Request, Response, NextFunction } from "express";
import redisClient from "../cache/index.js";
import { verifyToken } from "./utility.js";
import { AppError, UnauthorizedError } from "./errors.js";
import Logger from "../../core/Logger.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      retriesLeft?: number;
    }
  }
}
export const throttleNetwork = (
  action: string,
  limit: number = 10,
  window: number = 60,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body?.email || "anonymous";
      const ip = req.ip || req.headers["x-forwarded-for"];
      const key = `throttle:${email}:${ip}:${action}`;
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, window);
      }
      if (current > limit) {
        const ttl = await redisClient.ttl(key);
        return res.status(429).json({
          message: "Too many requests. Please try again later.",
          retryAfter: ttl,
        });
      }
      req.retriesLeft = limit - current;
      next();
    } catch (error) {
      console.error("Error in throttleNetwork middleware:", error);
      next();
    }
  };
};

export const debounceNetwork = (window: number = 5) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body?.email || "anonymous";
      const ip = req.ip || req.headers["x-forwarded-for"];
      const route = req.originalUrl;
      const key = `debounce:${email}:${ip}:${route}`;

      const isProcessing = await redisClient.get(key);

      if (isProcessing) {
        return res.status(429).json({
          message: "Request already in progress. Please wait.",
          retryAfter: await redisClient.ttl(key),
        });
      }
      // Lock the key for the duration of the window
      await redisClient.set(key, "1", { EX: window });
      // Release the lock once the response is finished
      res.on("finish", async () => {
        await redisClient.del(key);
      });

      next();
    } catch (error) {
      console.error("Error in debounceNetwork middleware:", error);
      next(); // fail open
    }
  };
};

export const validateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new UnauthorizedError("Token not valid");
    const payload: TokenPayload = verifyToken(token);
    if (!payload.id) throw new UnauthorizedError("User not authorized ");
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  Logger.error(err?.message || "operation error occured", err);
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  if ((err as any)?.isAxiosError) {
    return res.status(502).json({
      success: false,
      message: "External service error",
    });
  }
  return res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
};

import { Request, Response, NextFunction } from "express";
import redisClient from "../cache/index.js";
import { AppError, ErrorCode } from "./errors.js";
import Logger from "../../core/Logger.js";

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
      next(error);
    }
  };
};

// export const debounceNetwork = (window: number = 5) => {
//   return async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const email = req.body?.email || "anonymous";
//       const ip = req.ip || req.headers["x-forwarded-for"];
//       const route = req.originalUrl;
//       const key = `debounce:${email}:${ip}:${route}`;

//       const isProcessing = await redisClient.get(key);

//       if (isProcessing) {
//         return res.status(429).json({
//           message: "Request already in progress. Please wait.",
//           retryAfter: await redisClient.ttl(key),
//         });
//       }
//       // Lock the key for the duration of the window
//       await redisClient.set(key, "1", { EX: window });
//       // Release the lock once the response is finished
//       res.on("finish", async () => {
//         await redisClient.del(key);
//       });

//       next();
//     } catch (error) {
//       next(error); // fail open
//     }
//   };
// };

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
      code: err.code,
    });
  }
  if ((err as any)?.isAxiosError) {
    return res.status(502).json({
      success: false,
      message: "External service error",
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    });
  }

  if (err instanceof Error) {
    return res.status(500).json({
      success: false,
      message: err.message,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    });
  }
  return res.status(500).json({
    success: false,
    message: "Something went wrong",
    code: ErrorCode.INTERNAL_SERVER_ERROR,
  });
};

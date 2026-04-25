import { AxiosError } from "axios";
import { NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";

// errors/AppError.ts
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request") {
    super(message, 400);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation Error") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too Many Requests") {
    super(message, 429);
  }
}

export class TimeoutError extends AppError {
  constructor(message = "Request Timeout") {
    super(message, 504);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super(message, 500);
  }
}

export function handleFunctionError(error: unknown, context?: string): never {
  console.error(`Error in ${context || "unknown"}:`);
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const errorMessage = error.response?.data?.message;

    if (error.code === "ECONNABORTED") {
      throw new TimeoutError("External API timeout");
    }
    switch (status) {
      case 400:
        throw new BadRequestError(
          errorMessage || "Bad request to external API",
        );
      case 401:
        throw new UnauthorizedError(
          errorMessage || "Unauthorized external API",
        );
      case 403:
        throw new ForbiddenError(errorMessage || "Forbidden external API");
      case 404:
        throw new NotFoundError(errorMessage || "Resource not found");
      case 409:
        throw new ConflictError(errorMessage || "Conflict from external API");
      case 429:
        throw new TooManyRequestsError(errorMessage || "Rate limit exceeded");
      case 500:
      case 502:
      case 503:
        throw new InternalServerError(
          errorMessage || "External service failure",
        );
      default:
        throw new InternalServerError(
          errorMessage || "Unknown external API error",
        );
    }
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ConflictError("User with this email already exists");
    }
    throw new ValidationError(error.message);
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new ValidationError("Invalid data provided");
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new InternalServerError("Unknown error occurred");
}

export const handleApiError = (error: unknown, next: NextFunction) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return next(new ConflictError("User with this email already exists"));
    }
    return next(new ValidationError(error.message));
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return next(new ValidationError("Invalid data provided"));
  }
  if (error instanceof Error) {
    return next(error);
  }
};

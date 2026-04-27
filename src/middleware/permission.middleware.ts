import { NextFunction, Request, RequestHandler, Response } from "express";
import { Permissions } from "../generated/prisma/enums.js";
import { ForbiddenError } from "../lib/errors.js";

export function permissionMiddleware(permmission: Permissions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.apiKey?.permissions)
        throw new ForbiddenError("Permissions required");
      const exists = req.apiKey.permissions.includes(
        permmission as Permissions,
      );
      if (!exists) throw new ForbiddenError("Permission Denied");
      next();
    } catch (error) {
      next(error);
    }
  };
}

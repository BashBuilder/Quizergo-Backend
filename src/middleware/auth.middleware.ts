import { NextFunction, Request, Response, Router } from "express";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import { authenticateApiKeySchema } from "../models/apikey.model.js";
import {
  getAccessToken,
  validateToken,
  validateTokenData,
} from "../lib/jwt.js";
import { tokenInfo } from "../config/config.js";
import { prisma } from "../config/prisma.js";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";
import { KeyStatus } from "../generated/prisma/enums.js";
import asyncHandler from "../helper/asyncHandle.js";

const authMiddleware: Router = Router();

authMiddleware.use(
  validateRequest(authenticateApiKeySchema, ValidationSource.HEADERS),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = req?.cookies?.accessToken;
      if (!accessToken) throw new UnauthorizedError("Token not valid");
      req.accessToken = accessToken;
      const payload = await validateToken(accessToken, tokenInfo.secret);
      validateTokenData(payload);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) throw new BadRequestError("User does not exist");
      req.user = user;
      const keyStore = await prisma.keyStore.findUnique({
        where: {
          client: payload.sub,
          primaryKey: payload.prm,
          status: KeyStatus.ACTIVE,
        },
      });
      if (!keyStore) throw new BadRequestError("Invalid access token");
      req.keyStore = keyStore;
      next();
    } catch (error) {
      next(error);
    }
  }),
);

export default authMiddleware;

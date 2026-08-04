import { NextFunction, Request, Response, Router } from "express";
import { validateAuth, ValidationSource } from "../helper/validator.js";
import { authenticateApiSchema } from "../models/apikey.model.js";
import {
  createTokens,
  JwtPayload,
  validateToken,
  validateTokenData,
} from "../lib/jwt.js";
import { environment, tokenInfo } from "../config/config.js";
import { prisma } from "../config/prisma.js";
import { BadTokenError, UnauthorizedError } from "../lib/errors.js";
import { KeyStatus } from "../generated/prisma/enums.js";
import asyncHandler from "../helper/asyncHandle.js";

const requireAuth: Router = Router();

requireAuth.use(
  // validateAuth(authenticateApiSchema, ValidationSource.COOKIES),
  // validateAuth(authenticateApiSchema, ValidationSource.HEADERS),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const accessToken = req?.cookies?.accessToken;
      const accessToken = req?.headers?.authorization?.split(" ")[1];
      if (!accessToken) throw new UnauthorizedError("Access token not found");

      req.accessToken = accessToken;
      let payload: JwtPayload;
      try {
        payload = await validateToken(accessToken, tokenInfo.secret);
      } catch (err) {
        throw new BadTokenError();
      }

      // Access token was valid — continue normally
      validateTokenData(payload);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedError("User does not exist");
      req.user = user;

      const keyStore = await prisma.keyStore.findUnique({
        where: {
          client: payload.sub,
          primaryKey: payload.prm,
          status: KeyStatus.ACTIVE,
        },
      });
      if (!keyStore) throw new BadTokenError();
      req.keyStore = keyStore;
      next();
    } catch (error) {
      next(error);
    }
  }),
);

export default requireAuth;

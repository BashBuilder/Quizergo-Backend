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
import { BadRequestError } from "../lib/errors.js";

const authRouter: Router = Router();

authRouter.use(
  validateRequest(authenticateApiKeySchema, ValidationSource.HEADERS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = getAccessToken(req?.headers?.authorization);
      if (typeof accessToken !== "string") throw accessToken;

      req.accessToken = accessToken;
      const payload = await validateToken(accessToken, tokenInfo.secret);
      validateTokenData(payload);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) throw new BadRequestError("User does not exist");
      const keyStore = await prisma.keyStore.findUnique({
        where: {
          client: payload.sub,
          primaryKey: payload.prm,
          status: true,
        },
      });

      if (!keyStore) throw new BadRequestError("Invalid access token");

      next();
    } catch (error) {
      next(error);
    }
  },
);

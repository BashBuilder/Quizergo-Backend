import { NextFunction, Request, Response, Router } from "express";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import { authenticateApiKeySchema } from "../models/apikey.model.js";
import {
  createTokens,
  getAccessToken,
  JwtPayload,
  validateToken,
  validateTokenData,
} from "../lib/jwt.js";
import { environment, tokenInfo } from "../config/config.js";
import { prisma } from "../config/prisma.js";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";
import { KeyStatus } from "../generated/prisma/enums.js";
import asyncHandler from "../helper/asyncHandle.js";
import crypto from "node:crypto";
import { createUserToken } from "../controllers/keystore.controller.js";

const authMiddleware: Router = Router();

// authMiddleware.use(
//   validateRequest(authenticateApiKeySchema, ValidationSource.HEADERS),
//   asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const accessToken = req?.cookies?.accessToken;
//       if (!accessToken) throw new UnauthorizedError("Token not valid");
//       req.accessToken = accessToken;
//       const payload = await validateToken(accessToken, tokenInfo.secret);
//       validateTokenData(payload);

//       const user = await prisma.user.findUnique({
//         where: { id: payload.sub },
//       });
//       if (!user) throw new BadRequestError("User does not exist");
//       req.user = user;
//       const keyStore = await prisma.keyStore.findUnique({
//         where: {
//           client: payload.sub,
//           primaryKey: payload.prm,
//           status: KeyStatus.ACTIVE,
//         },
//       });
//       if (!keyStore) throw new BadRequestError("Invalid access token");
//       req.keyStore = keyStore;
//       next();
//     } catch (error) {
//       next(error);
//     }
//   }),
// );

authMiddleware.use(
  validateRequest(authenticateApiKeySchema, ValidationSource.HEADERS),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = req?.cookies?.accessToken;
      if (!accessToken) throw new UnauthorizedError("Token not valid");
      req.accessToken = accessToken;

      let payload: JwtPayload;

      try {
        // Try access token first
        payload = await validateToken(accessToken, tokenInfo.secret);
      } catch (err) {
        // Access token invalid — try refresh token inline
        const refreshTokenCookie = req?.cookies?.refreshToken;
        if (!refreshTokenCookie)
          throw new UnauthorizedError("Session expired, please login again");

        payload = await validateToken(refreshTokenCookie, tokenInfo.secret);
        validateTokenData(payload);

        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
        });
        if (!user) throw new BadRequestError("User does not exist");

        const keyStore = await prisma.keyStore.findUnique({
          where: {
            client: payload.sub,
            primaryKey: payload.prm,
            status: KeyStatus.ACTIVE,
          },
        });
        if (!keyStore) throw new BadRequestError("Invalid refresh token");

        // Generate new tokens
        const accessTokenKey = crypto.randomBytes(64).toString("hex");
        const refreshTokenKey = crypto.randomBytes(64).toString("hex");
        await createUserToken(user, accessTokenKey, refreshTokenKey);
        const tokens = await createTokens(
          user,
          accessTokenKey,
          refreshTokenKey,
        );

        // Set new cookies on the same response
        res
          .cookie("accessToken", tokens.accessToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: environment === "production",
            maxAge: 24 * 60 * 60 * 1000,
          })
          .cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: environment === "production",
            maxAge: 30 * 24 * 60 * 60 * 1000,
          });

        req.user = user;
        req.keyStore = keyStore;
        return next(); // skip the rest, already populated
      }

      // Access token was valid — continue normally
      validateTokenData(payload);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
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

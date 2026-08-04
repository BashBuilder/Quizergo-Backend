import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import {
  decryptPassword,
  generateOtp,
  hashPassword,
  verifyOtp,
} from "../lib/utility.js";
import eventEmitter from "../config/events.js";
import redisClient from "../cache/index.js";
import {
  BadRequestError,
  BadTokenError,
  handleFunctionError,
  ValidationError,
} from "../lib/errors.js";
import crypto from "node:crypto";
import { saveUserToken } from "./keystore.controller.js";
import { createTokens, validateToken, validateTokenData } from "../lib/jwt.js";
import { environment, tokenInfo } from "../config/config.js";
import { UserLogin, UserRegister, VerifyUser } from "../models/auth.model.js";
import { KeyStatus } from "../generated/prisma/enums.js";

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, firstName, lastName, password } = req.body as UserRegister;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user)
      throw new ValidationError("User already exist, login to continue");
    const hashedPassword = await hashPassword(password);
    await generateOtp(email, "auth");
    await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashedPassword,
      },
    });
    res.status(201).json({
      message:
        "User created successfully. Otp sent to your email, verify to login",
    });
    eventEmitter.emit("user.created", { email, firstName, lastName });
  } catch (error: any) {
    next(handleFunctionError(error));
  }
};

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, otp } = req.body as VerifyUser;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ValidationError("User does not exist");
    const otpRes = await verifyOtp(email, otp, "auth");
    if (!(otpRes.status === "verified")) {
      throw new ValidationError(otpRes.message);
    }
    await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });
    res.status(200).json({ message: "User verified successfully" });
    eventEmitter.emit("user.verified", {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    next(handleFunctionError(error));
  }
};

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body as UserLogin;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ValidationError("User does not exist");
    if (!user.isVerified) {
      await generateOtp(email, "auth");
      throw new ValidationError(
        "User not verified, check your email to complete registration",
      );
    }
    const isPasswordValid = await decryptPassword(password, user.password);
    if (!isPasswordValid) throw new ValidationError("Invalid credentials");

    const { password: userPassword, ...rest } = user;
    const keys = await redisClient.keys(`refresh:${user.id}:*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    const accessTokenKey = crypto.randomBytes(64).toString("hex");
    const refreshTokenKey = crypto.randomBytes(64).toString("hex");

    await saveUserToken(user, accessTokenKey, refreshTokenKey);
    const tokens = await createTokens(user, accessTokenKey, refreshTokenKey);

    res
      .status(200)
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
      })
      .json({
        message: "User logged in successfully",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: rest,
      });
  } catch (error) {
    next(handleFunctionError(error));
  }
};

export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    await prisma.keyStore.delete({
      where: {
        client: userId!,
      },
    });
    res
      .status(200)
      .cookie("accessToken", "", {
        httpOnly: true,
        sameSite: "strict",
        secure: environment === "production",
        maxAge: 0,
      })
      .cookie("refreshToken", "", {
        httpOnly: true,
        sameSite: "strict",
        secure: environment === "production",
        maxAge: 0,
      })
      .json({ message: "User logged out successfully" });
  } catch (error: any) {
    next(handleFunctionError(error));
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    return res.status(200).json({ user });
  } catch (error: any) {
    res.status(500).json({
      message: error?.message || "An error occurred while fetching user data",
    });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestError("Email is not registered");
    }
    await generateOtp(email, "auth");
    res.status(200).json({
      message: "Otp sent to your email, verify to reset password",
    });
  } catch (error: any) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestError("Email is not registered");
    }
    // const isOtpValid = await verifyOtp(email, otp, "auth");
    // if (!(isOtpValid.status === "verified")) {
    //   throw new BadRequestError(isOtpValid.message);
    // }
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error: any) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const accessToken = req?.headers?.authorization?.split(" ")[1];
    const { refreshToken: refreshTokenBody } = req.body;

    if (accessToken) {
      try {
        const payload = await validateToken(accessToken, tokenInfo.secret);
        validateTokenData(payload);

        return res.status(200).json({
          accessToken,
          refreshToken: refreshTokenBody,
        });
      } catch {}
    }

    const payload = await validateToken(refreshTokenBody, tokenInfo.secret);
    validateTokenData(payload);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new BadTokenError();

    const keyStore = await prisma.keyStore.findUnique({
      where: {
        client: payload.sub,
        secondaryKey: payload.prm,
        status: KeyStatus.ACTIVE,
      },
    });
    if (!keyStore) throw new BadTokenError("Invalid refresh token");

    // Generate new tokens
    const accessTokenKey = crypto.randomBytes(64).toString("hex");
    const refreshTokenKey = crypto.randomBytes(64).toString("hex");

    await saveUserToken(user, accessTokenKey, refreshTokenKey);
    const tokens = await createTokens(user, accessTokenKey, refreshTokenKey);

    // Set new cookies on the same response
    // res
    //   .cookie("accessToken", tokens.accessToken, {
    //     httpOnly: true,
    //     sameSite: "strict",
    //     secure: environment === "production",
    //     maxAge: 24 * 60 * 60 * 1000,
    //   })
    //   .cookie("refreshToken", tokens.refreshToken, {
    //     httpOnly: true,
    //     sameSite: "strict",
    //     secure: environment === "production",
    //     maxAge: 30 * 24 * 60 * 60 * 1000,
    // });

    req.user = user;
    req.keyStore = keyStore;

    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
};

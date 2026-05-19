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
  handleFunctionError,
  UnauthorizedError,
  ValidationError,
} from "../lib/errors.js";
import crypto from "node:crypto";
import { createUserToken } from "./keystore.controller.js";
import { createTokens } from "../lib/jwt.js";
import { environment } from "../config/config.js";

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, firstName, lastName, password } = req.body;
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
  const retriesLeft = req.retriesLeft || 0;
  try {
    const { email, otp } = req.body;
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
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedError("User does not exist");
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

    await createUserToken(user, accessTokenKey, refreshTokenKey);
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
      .json({ message: "User logged in successfully", user: rest });
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
    if (!userId) throw new BadRequestError("User not found");
    await prisma.keyStore.delete({
      where: {
        id: userId,
      },
    });
    res.status(200).json({ message: "User logged out successfully" });
  } catch (error: any) {
    next(handleFunctionError(error));
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    return res.status(200).json({ user });
  } catch (error: any) {
    console.error("Error fetching current user:", error);
    res.status(500).json({
      message: error?.message || "Error fetching current user, ",
    });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "Email is not registered" });
    }
    await generateOtp(email, "auth");
    res.status(200).json({
      message: "Otp sent to your email, verify to reset password",
    });
  } catch (error: any) {
    console.error("Error handling forgot password request:", error);
    res.status(500).json({
      message: error?.message || "Error handling forgot password request, ",
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isOtpValid = await verifyOtp(email, otp, "auth");
    if (!(isOtpValid.status === "verified")) {
      return res.status(400).json({ message: isOtpValid.message });
    }
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      message: error?.message || "Error resetting password, ",
    });
  }
};

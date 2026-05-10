import bcrypt from "bcrypt";
import redisClient from "../cache/index.js";
import { sendOTPEmail } from "./resend.js";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";
import "dotenv/config";
import { prisma } from "../config/prisma.js";
import {
  handleFunctionError,
  InternalServerError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "./errors.js";

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export const generateOtp = async (email: string, action: string) => {
  try {
    const key = `otp:${action}:${email}`;
    const existingOtp = await redisClient.get(key);
    if (existingOtp)
      throw new TooManyRequestsError(
        "OTP already sent. Please wait before requesting a new one.",
      );
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.set(key, otp, { EX: 7200 });
    await sendOTPEmail(email, otp);
    return otp;
  } catch (error) {
    throw error;
  }
};

export const verifyOtp = async (email: string, otp: string, action: string) => {
  try {
    const key = `otp:${action}:${email}`;
    const storedOtp = await redisClient.get(key);
    if (!storedOtp) {
      await generateOtp(email, action);
      return {
        message: "OTP expired. A new OTP has been sent to your email.",
        status: "expired",
      };
    }
    if (storedOtp === otp) {
      await redisClient.del(key); // OTP is valid, remove it from cache
      return {
        message: "OTP verified successfully",
        status: "verified",
      };
    }
    return {
      message: "Invalid OTP",
      status: "invalid",
    };
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    throw new Error(error?.message || "Failed to verify OTP");
  }
};

export const hashPassword = async (password: string) => {
  try {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new InternalServerError("Failed to hash password");
  }
};

export const decryptPassword = async (password: string, hash: string) => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new ValidationError("Failed to compare password");
  }
};

export const revokeAllTokens = async (userId: string): Promise<void> => {
  const keys = await redisClient.keys(`refresh:${userId}:*`);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

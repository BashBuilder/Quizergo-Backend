import bcrypt from "bcrypt";
import redisClient from "../cache/index.js";
import { sendOTPEmail } from "./resend.js";
import jwt from "jsonwebtoken";
import { randomBytes, createHash, randomInt } from "crypto";
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

// Default cooldown period before allowing OTP regeneration (60 seconds)
const OTP_REGENERATION_COOLDOWN_MS = 60 * 1000;

export const generateOtp = async (email: string, action: string, allowResend = false) => {
  try {
    const key = `otp:${action}:${email}`;
    const existingOtpData = await redisClient.get(key);
    if (existingOtpData) {
      // Check if existing OTP is in new JSON format with timestamp
      let isExpired = false;
      let hasValidTimestamp = false;
      try {
        const parsed = JSON.parse(existingOtpData);
        if (typeof parsed === "object" && parsed !== null && "otp" in parsed && "createdAt" in parsed) {
          const elapsed = Date.now() - (parsed as { createdAt: number }).createdAt;
          isExpired = elapsed >= OTP_REGENERATION_COOLDOWN_MS;
          hasValidTimestamp = true;
        }
      } catch {
        // Legacy format (plain OTP string) - no timestamp
      }
      // Case 1: JSON OTP with timestamp within cooldown period
      if (hasValidTimestamp && !isExpired) {
        // OTP sent within last 60 seconds - reject
        throw new TooManyRequestsError(
          "OTP already sent. Please wait before requesting a new one.",
        );
      }
      // Case 2: JSON OTP with timestamp in cooldown OR legacy format OR expired OTP
      // For register (allowResend=false): any existing OTP means user already started verification
      if (!allowResend) {
        throw new TooManyRequestsError(
          "User already has a pending verification. Please verify or wait for OTP to expire.",
        );
      }
      // Case 3: allowResend=true and (expired OTP or legacy format)
      // Delete old OTP before generating new one
      await redisClient.del(key);
    }
    const otp = randomInt(100000, 1000000).toString();
    await redisClient.set(key, JSON.stringify({ otp, createdAt: Date.now() }), {
      EX: 7200,
    });
    await sendOTPEmail(email, otp);
    return otp;
  } catch (error) {
    throw error;
  }
};

export const verifyOtp = async (email: string, otp: string, action: string) => {
  try {
    const key = `otp:${action}:${email}`;
    const storedOtpData = await redisClient.get(key);
    if (!storedOtpData) {
      await generateOtp(email, action);
      return {
        message: "OTP expired. A new OTP has been sent to your email.",
        status: "expired",
      };
    }
    let otpValue: string | null = null;
    try {
      const parsed = JSON.parse(storedOtpData);
      if (typeof parsed === "object" && parsed !== null && "otp" in parsed) {
        otpValue = (parsed as { otp: string }).otp as string;
      }
    } catch {
      // Legacy format: plain string
      otpValue = storedOtpData as string;
    }
    if (otpValue === otp) {
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
    throw new Error(error?.message || "Failed to verify OTP");
  }
};

export const hashPassword = async (password: string) => {
  try {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
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

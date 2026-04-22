import bcrypt from "bcrypt";
import redisClient from "../cache/index.js";
import { sendOTPEmail } from "./resend.js";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";
import "dotenv/config";
import { getUserById } from "../services/auth.service.js";

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export const generateOtp = async (email: string, action: string) => {
  try {
    const key = `otp:${action}:${email}`;
    const existingOtp = await redisClient.get(key);
    if (existingOtp) {
      throw new Error(
        "OTP already sent. Please wait before requesting a new one.",
      );
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.set(key, otp, { EX: 7200 });
    await sendOTPEmail(email, otp);
    return otp;
  } catch (error: any) {
    console.error("Error generating OTP:", error);
    throw new Error(error?.message || "Failed to generate OTP");
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
    throw new Error("Failed to hash password");
  }
};

export const decryptPassword = async (password: string, hash: string) => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("Error comparing password:", error);
    throw new Error("Failed to compare password");
  }
};

const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not defined in environment");
  return secret;
};

export const createToken = async (
  payload: TokenPayload,
  expiresIn: string = "6h",
): Promise<TokenResponse> => {
  try {
    const privateKey = getSecret();
    const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
    const accessToken = jwt.sign(payload, privateKey, { expiresIn } as any);

    const tokenId = randomBytes(16).toString("hex");
    const refreshToken = randomBytes(64).toString("hex");
    const hashedRefreshToken = hashToken(refreshToken);

    const key = `refresh:${payload.id}:${tokenId}`;
    await redisClient.set(key, hashedRefreshToken, { EX: REFRESH_TTL });
    return {
      accessToken,
      refreshToken: `${tokenId}.${refreshToken}`,
    };
  } catch (error: any) {
    console.error("Error creating token:", error);
    throw new Error(error?.message || "Failed to create token");
  }
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, getSecret()) as TokenPayload;
  } catch (error) {
    console.error("Error verifying token:", error);
    // if (error instanceof TokenExpiredError) {
    //   throw new Error("Token expired");
    // }
    // if (error instanceof JsonWebTokenError) {
    //   throw new Error("Invalid token");
    // }
    throw new Error("Failed to verify token");
  }
};

export const refreshAccessToken = async (
  userId: string,
  rawRefreshToken: string,
  expiresIn: string = "6h",
): Promise<TokenResponse> => {
  try {
    const [tokenId, token] = rawRefreshToken.split(".");
    const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

    if (!tokenId || !token) {
      throw new Error("Invalid refresh token format");
    }
    const key = `refresh:${userId}:${tokenId}`;
    const storedHashedToken = await redisClient.get(key);

    if (!storedHashedToken) {
      throw new Error("Refresh token not found");
    }

    const isValid = hashToken(token) === storedHashedToken;
    if (!isValid) {
      await redisClient.del(key);
      throw new Error("Invalid refresh token");
    }

    const newTokenId = randomBytes(16).toString("hex");
    const newRefreshToken = randomBytes(64).toString("hex");
    const newHashed = hashToken(newRefreshToken);
    const newKey = `refresh:${userId}:${newTokenId}`;

    await redisClient.set(newKey, newHashed, { EX: REFRESH_TTL });
    const user = await getUserById(userId);
    if (!user) {
      await redisClient.del(newKey);
      throw new Error("User not found");
    }
    // Refresh token expires in 7 days
    const newAccessToken = jwt.sign(
      {
        id: userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      } as TokenPayload,
      process.env.JWT_SECRET as string,
      { expiresIn } as any,
    );
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error: any) {
    console.log("Error refreshing token:", error);
    throw new Error(error?.message || "Failed to refresh token");
  }
};

export const revokeToken = async (
  userId: string,
  rawRefreshToken: string,
): Promise<void> => {
  const [tokenId] = rawRefreshToken.split(".");
  if (tokenId) {
    await redisClient.del(`refresh:${userId}:${tokenId}`);
  }
};

export const revokeAllTokens = async (userId: string): Promise<void> => {
  const keys = await redisClient.keys(`refresh:${userId}:*`);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

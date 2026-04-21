import bcrypt from "bcrypt";
import redisClient from "../cache/index.js";
import { sendOTPEmail } from "./resend.js";

export const generateOtp = async (email: string) => {
  try {
    if (!email) {
      throw new Error("Email is required to generate OTP");
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${email}`;
    await redisClient.set(key, otp, { EX: 300 }); // OTP expires in 5 minutes
    const emailRes = await sendOTPEmail(email, otp);
    console.log("OTP email sent:", emailRes);
    return otp;
  } catch (error) {
    console.error("Error generating OTP:", error);
    throw new Error("Failed to generate OTP");
  }
};

export const verifyOtp = async (email: string, otp: string) => {
  try {
    if (!email || !otp) {
      throw new Error("Email and OTP are required for verification");
    }
    const key = `otp:${email}`;
    const storedOtp = await redisClient.get(key);
    if (storedOtp === otp) {
      await redisClient.del(key); // OTP is valid, remove it from cache
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw new Error("Failed to verify OTP");
  }
};

export const hashPassword = async (password: string) => {
  try {
    const saltRounds = 10;
    if (!password) {
      throw new Error("Password is required");
    }
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Failed to hash password");
  }
};

export const decryptPassword = async (password: string, hash: string) => {
  try {
    if (!password || !hash) {
      throw new Error("Password and hash are required for comparison");
    }
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("Error comparing password:", error);
    throw new Error("Failed to compare password");
  }
};

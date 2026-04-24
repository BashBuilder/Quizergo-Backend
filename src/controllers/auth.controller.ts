import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import {
  createToken,
  decryptPassword,
  generateOtp,
  hashPassword,
  revokeAllTokens,
  verifyOtp,
} from "../lib/utility.js";
import eventEmitter from "../config/events.js";
import { sendWelcomeEmail } from "../lib/resend.js";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, password, confirmPassword } = req.body;
    const schema = z.object({
      email: z.email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      password: z.string().min(6),
      confirmPassword: z.string().min(6),
    });
    const validation = schema.safeParse({
      email,
      firstName,
      lastName,
      password,
      confirmPassword,
    });
    if (!validation.success) {
      return res.status(400).json({ message: validation.error.message });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      return res.status(400).json({ message: "User already exist" });
    }
    const hashedPassword = await hashPassword(password);
    await sendWelcomeEmail(email, firstName);
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
  } catch (error: any) {
    console.error("Error registering user:", error);
    res.status(500).json({
      message: error?.message || "Error registering user",
    });
  }
};

export const verifyUser = async (req: Request, res: Response) => {
  const retriesLeft = req.retriesLeft || 0;
  try {
    const { email, otp } = req.body;
    const schema = z.object({
      email: z.email(),
      otp: z.string().length(6),
    });
    const validation = schema.safeParse({ email, otp });
    if (!validation.success) {
      return res
        .status(400)
        .json({ message: validation.error.message, retriesLeft });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found", retriesLeft });
    }
    const otpRes = await verifyOtp(email, otp, "auth");
    if (!(otpRes.status === "verified")) {
      return res.status(400).json({ message: otpRes.message, retriesLeft });
    }
    await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });
    res.status(200).json({ message: "User verified successfully" });
    // eventEmitter.emit("user.verified", {
    //   email: user.email,
    //   firstName: user.firstName,
    // });
  } catch (error: any) {
    console.error("Error verifying user:", error);
    res.status(500).json({
      message: error?.message || "Error verifying user, ",
      retriesLeft,
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const schema = z.object({
      email: z.email(),
      password: z.string(),
    });
    const validataion = schema.safeParse({ email, password });
    if (!validataion.success) {
      return res.status(400).json({ message: validataion.error.message });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "Invalid credentials" });
    }
    if (!user.isVerified) {
      await generateOtp(email, "auth");
      return res.status(400).json({
        message: "User not verified, check email for OTP verification",
      });
    }
    const isPasswordValid = await decryptPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: " Invalid credentials " });
    }

    const { password: userPassword, ...rest } = user;

    const token = await createToken({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    res
      .status(200)
      .json({ message: "User logged in successfully", ...token, user: rest });
  } catch (error: any) {
    console.error("Error logging in user:", error);
    res.status(500).json({
      message: error?.message || "Error logging in user, ",
    });
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    await revokeAllTokens(userId);
    res.status(200).json({ message: "User logged out successfully" });
  } catch (error: any) {
    console.error("Error logging out user:", error);
    res.status(500).json({
      message: error?.message || "Error logging out user, ",
    });
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
    const schema = z.object({
      email: z.email(),
    });
    const validation = schema.safeParse({ email });
    if (!validation.success) {
      return res.status(400).json({ message: validation.error.message });
    }
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
    const { email, otp, newPassword, confirmNewPassword } = req.body;
    const schema = z.object({
      email: z.email(),
      otp: z.string(),
      newPassword: z.string(),
      confirmNewPassword: z.string(),
    });
    const validation = schema.safeParse({
      email,
      otp,
      newPassword,
      confirmNewPassword,
    });
    if (!validation.success) {
      return res.status(400).json({ message: validation.error.message });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
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

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const schema = z.object({
      refreshToken: z.string(),
    });
    const validation = schema.safeParse({ refreshToken });
    if (!validation.success) {
      return res.status(400).json({ message: validation.error.message });
    }
    // const isValid = await
  } catch (error: any) {
    console.error("Error refreshing token:", error);
    res.status(500).json({
      message: error?.message || "Error refreshing token, ",
    });
  }
};

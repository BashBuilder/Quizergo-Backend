import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { generateOtp, hashPassword, verifyOtp } from "../lib/utility.js";
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
    await generateOtp(email);
    await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashedPassword,
      },
    });
    await sendWelcomeEmail(email, firstName);
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
  const retriesLeft = res.retriesLeft || 0;
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
      return res.status(404).json({ message: "User not found" });
    }
    const isValid = await verifyOtp(email, otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP", retriesLeft });
    }
    await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });
    res.status(200).json({ message: "User verified successfully" });
  } catch (error: any) {
    console.error("Error verifying user:", error);
    res.status(500).json({
      message: error?.message || "Error verifying user, internal server error",
      retriesLeft,
    });
  }
};

export const login = (req: Request, res: Response) => {
  try {
  } catch (error) {}
};
export const register = (req: Request, res: Response) => {
  try {
  } catch (error) {}
};

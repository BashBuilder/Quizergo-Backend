import z from "zod";
import { Header } from "../utils/auth.util.js";

export const apiKeySchema = z.object({
  [Header.API_KEY]: z
    .string({ message: "API key is required" })
    .min(1, "API key is required"),
});

export const authenticateApiSchema = z.object({
  accessToken: z.string({ message: "Token not valid" }).optional(),
  refreshToken: z
    .string({ message: "Session expired, please login again" })
    .min(1, "Session expired, please login again"),
});

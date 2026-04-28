import z from "zod";
import { Header } from "../utils/auth.util.js";

export const apiKeySchema = z.object({
  [Header.API_KEY]: z
    .string({ message: "API key is required" })
    .min(1, "API key is required"),
});

export const authenticateApiKeySchema = z.object({
  authorization: z
    .string("Authorization header is required")
    .refine((data) => data.startsWith("Bearer"), "Invalid authoriztion header")
    .refine((data) => data.split(" ")[1], "Authorization must contain a token"),
});

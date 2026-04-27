import z from "zod";
import { Header } from "../utils/auth.util.js";

export const apiKeySchema = z.object({
  [Header.API_KEY]: z
    .string({ message: "API key is required" })
    .min(1, "API key is required"),
});

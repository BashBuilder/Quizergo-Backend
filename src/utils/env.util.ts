import z from "zod";
import "dotenv/config";
import { ConfigurationError } from "../lib/errors.js";

// Every variable the application reads through src/config/*.
// Values are checked, never logged, so secrets stay out of the logs.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"], {
    error: "NODE_ENV is required (development, test or production)",
  }),

  PORT: z.coerce
    .number("PORT is required and must be a number")
    .int("PORT must be an integer")
    .positive("PORT must be greater than 0"),

  LOG_DIRECTORY: z
    .string("LOG_DIRECTORY is required")
    .min(1, "LOG_DIRECTORY cannot be empty"),

  ACCESS_TOKEN_VALIDITY_SEC: z.coerce
    .number("ACCESS_TOKEN_VALIDITY_SEC is required and must be a number")
    .int("ACCESS_TOKEN_VALIDITY_SEC must be an integer")
    .positive("ACCESS_TOKEN_VALIDITY_SEC must be greater than 0"),

  REFRESH_TOKEN_VALIDITY_SEC: z.coerce
    .number("REFRESH_TOKEN_VALIDITY_SEC is required and must be a number")
    .int("REFRESH_TOKEN_VALIDITY_SEC must be an integer")
    .positive("REFRESH_TOKEN_VALIDITY_SEC must be greater than 0"),

  JWT_ISSUER: z.string("JWT_ISSUER is required").min(1, "JWT_ISSUER cannot be empty"),
  JWT_AUDIENCE: z
    .string("JWT_AUDIENCE is required")
    .min(1, "JWT_AUDIENCE cannot be empty"),
  JWT_SECRET: z.string("JWT_SECRET is required").min(1, "JWT_SECRET cannot be empty"),
  JWT_ALGORITHM: z
    .string("JWT_ALGORITHM is required")
    .min(1, "JWT_ALGORITHM cannot be empty"),

  DB_URL: z.url("DB_URL must be a valid connection URL"),
  REDIS_URL: z.url("REDIS_URL must be a valid connection URL"),

  RESEND_API_KEY: z
    .string("RESEND_API_KEY is required")
    .min(1, "RESEND_API_KEY cannot be empty"),
  RESEND_CONTACT_EMAIL: z.email(
    "RESEND_CONTACT_EMAIL must be a valid email address",
  ),
});

export type Env = z.infer<typeof envSchema>;

export const handleEnv = async (): Promise<void> => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new ConfigurationError(
      `Invalid environment configuration:\n${problems}`,
    );
  }
};

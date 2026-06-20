import "dotenv/config";

export const logDirectory = process.env.LOG_DIRECTORY || "logs";
export const environment = process.env.NODE_ENV || "development";

// token
export const tokenInfo = {
  accessTokenValidity:
    parseInt(process.env.ACCESS_TOKEN_VALIDITY_SEC || "") || 3600,
  refreshTokenValidity:
    parseInt(process.env.REFRESH_TOKEN_VALIDITY_SEC || "") || 86400,
  issuer: process.env.JWT_ISSUER || "",
  audience: process.env.JWT_AUDIENCE || "",
  secret: process.env.JWT_SECRET || "",
  algorithm: process.env.JWT_ALGORITHM || "",
};

// prisma
const USER = process.env["POSTGRES_USER"] || "";
const PASSWORD = process.env["POSTGRES_PASSWORD"] || "";
const HOST = process.env["POSTGRES_HOST"] || "";
const PORT = process.env["POSTGRES_PORT"] || "";
const DB = process.env["POSTGRES_DB"] || "";
const TEST_DB = process.env["POSTGRES_TEST_DB"] || "";

const db = environment === "test" ? TEST_DB : DB;

export const postresConnectionString = `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${db}`;

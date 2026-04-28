import "dotenv/config";

export const logDirectory = process.env.LOG_DIRECTORY || "logs";
export const environment = process.env.NODE_ENV || "development";

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

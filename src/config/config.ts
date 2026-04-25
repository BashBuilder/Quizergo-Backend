import "dotenv/config";

export const logDirectory = process.env.LOG_DIRECTORY || "logs";
export const environment = process.env.NODE_ENV || "development";

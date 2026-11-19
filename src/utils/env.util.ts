import z from "zod";
import "dotenv/config";

const env = process.env;

export const handleEnv = async () => {
  try {
    const secret = env["JWT_SECRET"];
    console.log(secret);
    throw new Error(
      "Environment variables are not set, add before continueing",
    );
  } catch (error) {
    throw error;
  }
};

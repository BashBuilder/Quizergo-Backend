import { prisma } from "../config/prisma.js";
import { BadRequestError } from "../lib/errors.js";

export const getUserByEmail = async (email: string) => {
  try {
    return await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    throw new BadRequestError("Failed to fetch user");
  }
};

export const getUserById = async (id: string) => {
  try {
    return await prisma.user.findUnique({ where: { id } });
  } catch (error) {
    throw new BadRequestError("Failed to fetch user");
  }
};

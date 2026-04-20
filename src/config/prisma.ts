import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const USER = process.env["POSTGRES_USER"] || "";
const PASSWORD = process.env["POSTGRES_PASSWORD"] || "";
const HOST = process.env["POSTGRES_HOST"] || "";
const PORT = process.env["POSTGRES_PORT"] || "";
const DB = process.env["POSTGRES_DB"] || "";

const connectionString = `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${DB}`;

// const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { environment } from "./config.js";

const USER = process.env["POSTGRES_USER"] || "";
const PASSWORD = process.env["POSTGRES_PASSWORD"] || "";
const HOST = process.env["POSTGRES_HOST"] || "";
const PORT = process.env["POSTGRES_PORT"] || "";
const DB = process.env["POSTGRES_DB"] || "";
const TEST_DB = process.env["POSTGRES_TEST_DB"] || "";

const db = environment === "test" ? TEST_DB : DB;

export const postresConnectionString = `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${db}`;

const adapter = new PrismaPg({ connectionString: postresConnectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };

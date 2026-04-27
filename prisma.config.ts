import "dotenv/config";
import { defineConfig } from "prisma/config";
const USER = process.env["POSTGRES_USER"] || "";
const PASSWORD = process.env["POSTGRES_PASSWORD"] || "";
const HOST = process.env["POSTGRES_HOST"] || "";
const PORT = process.env["POSTGRES_PORT"] || "";
const DB = process.env["POSTGRES_DB"] || "";

const url = `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${DB}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url,
  },
});

import "dotenv/config";
import { defineConfig } from "prisma/config";
const USER = process.env["POSTGRES_USER"] || "";
const PASSWORD = process.env["POSTGRES_PASSWORD"] || "";
const HOST = process.env["POSTGRES_HOST"] || "localhost";
const PORT = process.env["POSTGRES_PORT"] || "5432";
const DB = process.env["POSTGRES_DB"] || "quizergo";

const url = `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${DB}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});

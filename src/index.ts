import express from "express";
import "dotenv/config.js";
import cors from "cors";
import helmet from "helmet";
// import mongoose from "mongoose";
import authRoutes from "./routes/auth.route.js";
import "./cache/index.js";
import { prisma } from "./config/prisma.js";
import { connectRedis } from "./cache/index.js";
import "./services/email.service.js";

const app = express();
const PORT = process.env.PORT || 4000;
const version = "api/v1";

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Routes
app.get("/", (_, res) => {
  res.send("Hell There, Welcome to QUIZERGO API");
});
app.get("/health", (_, res) => {
  console.log("Health check endpoint hit");
  console.log("Testing health check point");
  res.json({
    status: "OK",
    version,
  });
});

app.use(`/${version}/auth`, authRoutes);

const startServer = async () => {
  try {
    // await mongoose
    //   .connect(process.env.DATABASE_URL || "")
    // .then(() => console.log("Connected to MongoDB database"));
    await prisma
      .$connect()
      .then(() => console.log("Connected to PostgreSQL database"));
    await connectRedis().then(() => console.log("Connected to Redis cache"));
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.log("Error starting server:", error);
  }
};

process.on("SIGINT", () => {
  console.log("Shutting down server...");
  // mongoose.connection.close();
  prisma.$disconnect();
});

startServer();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.route.js";
import "./cache/index.js";

dotenv.config();

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
  res.json({
    status: "OK",
    version,
  });
});

app.use(`/${version}/auth`, authRoutes);

const startServer = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || "");
    console.log("Database connected successfully");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.log("Error starting server:", error);
  }
};

startServer();

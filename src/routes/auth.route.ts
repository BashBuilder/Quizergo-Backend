import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { throttleNetwork } from "../lib/middleware.js";

const authRoutes = Router();

authRoutes.post("/register", authController.registerUser);
authRoutes.post(
  "/verify",
  throttleNetwork("verify", 5, 300),
  authController.verifyUser,
);
// authRoutes.post("/login", throttleNetwork(500), authController.login);
// authRoutes.post("/logout");
// authRoutes.post("/refresh");
// authRoutes.get("/profile");

export default authRoutes;

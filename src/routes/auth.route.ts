import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { throttleNetwork, validateUser } from "../lib/middleware.js";

const authRoutes: Router = Router();

authRoutes.post("/register", authController.registerUser);
authRoutes.post(
  "/verify",
  throttleNetwork("verify", 5, 3600),
  authController.verifyUser,
);
authRoutes.post(
  "/login",
  throttleNetwork("login", 5, 3600),
  authController.loginUser,
);
authRoutes.post("/logout", authController.logoutUser);
authRoutes.get("/me", validateUser, authController.getCurrentUser);
authRoutes.post(
  "/forgot-password",
  throttleNetwork("forgot-password", 5, 3600),
  authController.forgotPassword,
);
authRoutes.post(
  "/refresh-token",
  throttleNetwork("refresh-token", 5, 3600),
  authController.refreshToken,
);

export default authRoutes;

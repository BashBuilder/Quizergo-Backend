import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { throttleNetwork } from "../lib/middleware.js";

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
// authRoutes.post("/me", authController.getCurrentUser);

export default authRoutes;

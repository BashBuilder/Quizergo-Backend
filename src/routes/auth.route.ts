import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { throttleNetwork, validateUser } from "../lib/middleware.js";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import {
  userLoginSchema,
  userRegisterSchema,
  verifyUserSchema,
} from "../models/auth.model.js";
import authMiddleware from "../middleware/auth.middleware.js";

const authRoutes: Router = Router();

authRoutes
  .route("/register")
  .post(
    validateRequest(userRegisterSchema, ValidationSource.BODY),
    authController.registerUser,
  );
authRoutes
  .route("/verify")
  .post(
    throttleNetwork("verify", 5, 3600),
    validateRequest(verifyUserSchema, ValidationSource.BODY),
    authController.verifyUser,
  );

authRoutes.route("/login").post(
  // throttleNetwork("login", 5, 3600),
  validateRequest(userLoginSchema, ValidationSource.BODY),
  authController.loginUser,
);

authRoutes.get("/me", authMiddleware, authController.getCurrentUser);
authRoutes.post("/logout", authController.logoutUser);
authRoutes.post(
  "/forgot-password",
  throttleNetwork("forgot-password", 5, 3600),
  authController.forgotPassword,
);
// authRoutes.post(
//   "/refresh-token",
//   throttleNetwork("refresh-token", 5, 3600),
//   authController.refreshToken,
// );

export default authRoutes;

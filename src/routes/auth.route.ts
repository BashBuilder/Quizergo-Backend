import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { throttleNetwork } from "../lib/middleware.js";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import {
  userForgotPasswordSchema,
  userLoginSchema,
  userRegisterSchema,
  verifyUserSchema,
  userResetPasswordSchema,
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

authRoutes
  .route("/login")
  .post(
    throttleNetwork("login", 5, 3600),
    validateRequest(userLoginSchema, ValidationSource.BODY),
    authController.loginUser,
  );

authRoutes.route("/me").get(authMiddleware, authController.getCurrentUser);
authRoutes.route("/logout").post(authMiddleware, authController.logoutUser);
authRoutes
  .route("/forgot-password")
  .post(
    throttleNetwork("forgot-password", 5, 3600),
    validateRequest(userForgotPasswordSchema, ValidationSource.BODY),
    authController.forgotPassword,
  );

authRoutes
  .route("/reset-password")
  .post(
    throttleNetwork("reset-password", 5, 3600),
    validateRequest(userResetPasswordSchema, ValidationSource.BODY),
    authController.resetPassword,
  );

export default authRoutes;

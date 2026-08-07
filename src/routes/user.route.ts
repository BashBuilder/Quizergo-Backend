import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import * as userController from "../controllers/user.controller.js";

export const userRoutes: Router = Router();

userRoutes.route("/me").get(requireAuth, userController.getCurrentUser);
userRoutes.route("/history").get(requireAuth, userController.getUserHistory);

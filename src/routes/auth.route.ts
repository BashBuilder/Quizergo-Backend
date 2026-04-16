import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";

const authRoutes = Router();

authRoutes.post("/register", authController.register);
authRoutes.post("/login", authController.login);
// authRoutes.post("/logout");
// authRoutes.post("/refresh");
// authRoutes.get("/profile");

export default authRoutes;

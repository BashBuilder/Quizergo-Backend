import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { throttleNetwork } from "../lib/middleware.js";

const authRoutes = Router();

authRoutes.post("/register", authController.register);
authRoutes.post("/login", throttleNetwork(500), authController.login);
// authRoutes.post("/logout");
// authRoutes.post("/refresh");
// authRoutes.get("/profile");

export default authRoutes;

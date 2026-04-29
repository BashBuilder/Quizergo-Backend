import { Router } from "express";
import * as alocQuestionController from "../controllers/aloc.questions.controller.js";
import { validateUser } from "../lib/middleware.js";
import apikeyRouter from "../middleware/apikey.middleware.js";
import { permissionMiddleware } from "../middleware/permission.middleware.js";
import { Permissions } from "../generated/prisma/enums.js";
import authMiddleware from "../middleware/auth.middleware.js";

const questionRoutes: Router = Router();

questionRoutes.use(apikeyRouter);
questionRoutes.use(permissionMiddleware(Permissions.GENERAL));
questionRoutes.use(authMiddleware);

questionRoutes.get(
  "",
  validateUser,
  alocQuestionController.getQuestionsBySubject,
);

export default questionRoutes;

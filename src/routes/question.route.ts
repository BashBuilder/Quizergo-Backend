import { Router } from "express";
import apikeyRouter from "../middleware/apikey.middleware.js";
import { permissionMiddleware } from "../middleware/permission.middleware.js";
import { Permissions } from "../generated/prisma/enums.js";
import authMiddleware from "../middleware/auth.middleware.js";
import * as questionController from "../controllers/questions.controller.js";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import { questionQuerySchema } from "../models/subject.model.js";

const questionRoutes: Router = Router();

// questionRoutes.use(apikeyRouter);
// questionRoutes.use(permissionMiddleware(Permissions.GENERAL));
// questionRoutes.use(authMiddleware);

questionRoutes.route("/subjects").get(questionController.getSubjectLists);

questionRoutes
  .route("/questions")
  .get(
    authMiddleware,
    validateRequest(questionQuerySchema, ValidationSource.QUERY),
    questionController.getQuestionsBySubject,
  );

export default questionRoutes;

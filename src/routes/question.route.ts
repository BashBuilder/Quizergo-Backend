import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import * as questionController from "../controllers/questions.controller.js";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import { questionQuerySchema } from "../models/subject.model.js";

const questionRoutes: Router = Router();

questionRoutes.route("/subjects").get(questionController.getSubjectLists);

questionRoutes
  .route("")
  .get(
    requireAuth,
    validateRequest(questionQuerySchema, ValidationSource.QUERY),
    questionController.getQuestionsBySubject,
  );

export default questionRoutes;

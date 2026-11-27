import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import * as questionController from "../controllers/questions.controller.js";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import { questionQuerySchema } from "../models/subject.model.js";
import z from "zod";

const questionRoutes: Router = Router();

questionRoutes.route("/subjects").get(questionController.getSubjectLists);

questionRoutes
  .route("")
  .get(
    requireAuth,
    validateRequest(questionQuerySchema, ValidationSource.QUERY),
    questionController.getQuestionsBySubject,
  );

const gradeScoreSchema = z.object({
  body: z.object({
    subject: z.string("Subject is required").min(1, "Subject is required"),
    answers: z
      .record(z.string("Question ID is required"), z.string("Answer is required"))
      .refine((val) => Object.keys(val).length > 0, "At least one answer is required"),
  }),
});

questionRoutes
  .route("/grade")
  .post(requireAuth, validateRequest(gradeScoreSchema, ValidationSource.BODY), questionController.gradeScore);

export default questionRoutes;

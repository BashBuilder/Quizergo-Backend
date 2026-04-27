import { Router } from "express";
import * as alocQuestionController from "../controllers/aloc.questions.controller.js";
import { validateUser } from "../lib/middleware.js";
import apikeyRouter from "../middleware/apikey.middleware.js";

const questionRoutes: Router = Router();

questionRoutes.use(apikeyRouter);

questionRoutes.get(
  "",
  validateUser,
  alocQuestionController.getQuestionsBySubject,
);

export default questionRoutes;

import { Router } from "express";
import * as alocQuestionController from "../controllers/aloc.questions.controller.js";

const questionRoutes: Router = Router();

questionRoutes.get("/subject", alocQuestionController.getQuestionsBySubject);

export default questionRoutes;

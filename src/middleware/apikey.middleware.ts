import { NextFunction, Router, Request, Response } from "express";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import { ApiKeySchema } from "../models/apikey.model.js";
import { Header } from "../utils/auth.util.js";
import { ForbiddenError } from "../lib/errors.js";
import { findByKey } from "../controllers/apikey.controller.js";

const apikeyRouter: Router = Router();

apikeyRouter.use(
  validateRequest(ApiKeySchema, ValidationSource.HEADER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.headers[Header.API_KEY]?.toString();
      if (!key) throw new ForbiddenError();
      const apiKey = await findByKey(key);
      if (!apiKey) throw new ForbiddenError();
      req.apiKey = apiKey;
    } catch (error) {
      next(error);
    }
  },
);

export default apikeyRouter;

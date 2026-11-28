import { Router } from "express";
import {
  sendMessage,
  sendMessageNonStreaming,
  createConversation,
  getConversations,
  getConversation,
  getMessageHistory,
  updateConversation,
  deleteConversation,
} from "../controllers/qbot.controller.js";
import requireAuth from "../middleware/auth.middleware.js";
import validateRequest, { ValidationSource } from "../helper/validator.js";
import { throttleUserAction } from "../lib/middleware.js";
import { qbotConfig } from "../config/qbot.js";
import {
  sendMessageModel,
  createConversationModel,
  conversationIdParams,
  messageHistoryModel,
  listConversationsModel,
  updateConversationModel,
} from "../models/qbot.model.js";

const qbotRoutes: Router = Router();

// All Qbot routes require authentication.
qbotRoutes.use(requireAuth);

const messageRateLimiter = throttleUserAction(
  "qbot:message",
  qbotConfig.rateLimit.maxRequests,
  qbotConfig.rateLimit.windowSec,
);

// Send message (streaming)
qbotRoutes.post(
  "/message",
  messageRateLimiter,
  validateRequest(sendMessageModel, ValidationSource.BODY),
  sendMessage,
);

// Send message (non-streaming)
qbotRoutes.post(
  "/message/non-streaming",
  messageRateLimiter,
  validateRequest(sendMessageModel, ValidationSource.BODY),
  sendMessageNonStreaming,
);

// Conversation management
qbotRoutes.post(
  "/conversations",
  validateRequest(createConversationModel, ValidationSource.BODY),
  createConversation,
);

qbotRoutes.get(
  "/conversations",
  validateRequest(listConversationsModel, ValidationSource.QUERY),
  getConversations,
);

qbotRoutes.get(
  "/conversations/:conversationId",
  validateRequest(conversationIdParams, ValidationSource.PARAMS),
  getConversation,
);

qbotRoutes.get(
  "/conversations/:conversationId/messages",
  validateRequest(conversationIdParams, ValidationSource.PARAMS),
  validateRequest(messageHistoryModel, ValidationSource.QUERY),
  getMessageHistory,
);

qbotRoutes.patch(
  "/conversations/:conversationId",
  validateRequest(conversationIdParams, ValidationSource.PARAMS),
  validateRequest(updateConversationModel, ValidationSource.BODY),
  updateConversation,
);

qbotRoutes.delete(
  "/conversations/:conversationId",
  validateRequest(conversationIdParams, ValidationSource.PARAMS),
  deleteConversation,
);

export default qbotRoutes;

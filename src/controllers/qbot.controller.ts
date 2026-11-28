import { NextFunction, Request, Response } from "express";
import { qbotService } from "../services/qbot.service.js";
import { sendMessageModel, createConversationModel, conversationIdParams, messageHistoryModel, updateConversationModel } from "../models/qbot.model.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import Logger from "../core/Logger.js";

export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { message, conversationId } = req.body;

    // Get or create conversation
    const conversation = await qbotService.getOrCreateConversation(
      user.id,
      conversationId
    );

    // Save user message
    await qbotService.addMessage(conversation.id, user.id, "user", message);

    // Set up streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let fullResponse = "";
    let fullReasoning = "";
    let messageId: string | null = null;

    try {
      for await (const chunk of qbotService.streamResponse(
        conversation.id,
        user.id,
        message
      )) {
        if (chunk.done) {
          fullResponse = chunk.fullResponse ?? "";
          fullReasoning = chunk.fullReasoning ?? "";
          
          // Save assistant message
          const savedMessage = await qbotService.addMessage(
            conversation.id,
            user.id,
            "assistant",
            fullResponse,
            fullReasoning || null
          );
          messageId = savedMessage.id;

          // Send final chunk with message ID
          res.write(`data: ${JSON.stringify({
            type: "complete",
            messageId,
            conversationId: conversation.id,
            content: fullResponse,
            reasoning: fullReasoning,
          })}\n\n`);
        } else {
          // Send streaming chunk
          res.write(`data: ${JSON.stringify({
            type: "chunk",
            content: chunk.content,
            reasoning: chunk.reasoning,
          })}\n\n`);
        }
      }
    } catch (streamError) {
      Logger.error("Streaming error:", streamError);
      res.write(`data: ${JSON.stringify({
        type: "error",
        message: "Failed to generate response",
      })}\n\n`);
    }

    res.end();
  } catch (error) {
    next(error);
  }
};

export const sendMessageNonStreaming = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { message, conversationId } = req.body;

    const conversation = await qbotService.getOrCreateConversation(
      user.id,
      conversationId
    );

    // Save user message
    await qbotService.addMessage(conversation.id, user.id, "user", message);

    // Generate response
    const response = await qbotService.generateResponse(
      conversation.id,
      user.id,
      message
    );

    // Save assistant message
    const savedMessage = await qbotService.addMessage(
      conversation.id,
      user.id,
      "assistant",
      response,
      undefined
    );

    res.status(200).json({
      message: "Response generated",
      conversationId: conversation.id,
      messageId: savedMessage.id,
      content: response,
    });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { title } = req.body;

    const conversation = await qbotService.getOrCreateConversation(
      user.id,
      undefined,
      title
    );

    res.status(201).json({
      message: "Conversation created",
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const conversations = await qbotService.getUserConversations(
      user.id,
      limit,
      offset
    );

    res.status(200).json({
      conversations,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { conversationId } = req.params as { conversationId: string };

    const conversation = await qbotService.getConversation(
      conversationId,
      user.id
    );

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    res.status(200).json({ conversation });
  } catch (error) {
    next(error);
  }
};

export const getMessageHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { conversationId } = req.params as { conversationId: string };
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await qbotService.getMessageHistory(
      conversationId,
      user.id,
      limit,
      offset
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { conversationId } = req.params as { conversationId: string };
    const { title } = req.body;

    const conversation = await qbotService.updateConversation(
      conversationId,
      user.id,
      title
    );

    res.status(200).json({
      message: "Conversation updated",
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { conversationId } = req.params as { conversationId: string };

    await qbotService.deleteConversation(conversationId, user.id);

    res.status(200).json({ message: "Conversation deleted" });
  } catch (error) {
    next(error);
  }
};
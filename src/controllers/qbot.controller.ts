import { NextFunction, Request, Response } from "express";
import { qbotService, type QbotStreamEvent } from "../services/qbot.service.js";
import { AppError, InternalServerError, NotFoundError } from "../lib/errors.js";
import Logger from "../core/Logger.js";

function writeEvent(res: Response, event: unknown): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function publicErrorMessage(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : "Qbot is temporarily unavailable. Please try again.";
}

// Provider errors can contain request details, so only typed AppErrors keep
// their message. Everything else becomes a generic 500 for the client.
function toHttpError(error: unknown): Error {
  return error instanceof AppError
    ? error
    : new InternalServerError("Qbot is temporarily unavailable. Please try again.");
}

function loggableError(error: unknown): string {
  if (error instanceof AppError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.name : "unknown error";
}

function pagination(
  query: Request["query"],
  fallbackLimit: number,
): { limit: number; offset: number } {
  const parsedLimit = Number.parseInt(String(query.limit ?? ""), 10);
  const parsedOffset = Number.parseInt(String(query.offset ?? ""), 10);

  return {
    limit: Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : fallbackLimit,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
}

export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user!;
  const { message, conversationId } = req.body;

  try {
    const stream: AsyncGenerator<QbotStreamEvent> = qbotService.streamMessage(
      conversationId,
      user.id,
      message,
    );

    // Pull the first event before sending headers so conversation validation
    // errors still produce a normal JSON 4xx response.
    const first = await stream.next();
    if (first.done) {
      throw new InternalServerError("Qbot did not start a response");
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    writeEvent(res, first.value);

    let clientClosed = false;
    res.on("close", () => {
      clientClosed = true;
    });

    for await (const event of stream) {
      if (clientClosed || res.writableEnded || res.destroyed) break;
      writeEvent(res, event);
    }

    if (!res.writableEnded && !res.destroyed) res.end();
  } catch (error) {
    Logger.error("Qbot message failed", {
      userId: user.id,
      conversationId,
      error: loggableError(error),
    });

    if (res.headersSent) {
      try {
        if (!res.writableEnded) {
          writeEvent(res, {
            type: "error",
            message: publicErrorMessage(error),
          });
          res.end();
        }
      } catch {
        // The client closed the stream first; nothing left to send.
      }
      return;
    }

    next(toHttpError(error));
  }
};

export const sendMessageNonStreaming = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user!;
  const { message, conversationId } = req.body;

  try {
    const result = await qbotService.sendMessage(
      conversationId,
      user.id,
      message,
    );

    res.status(200).json({
      message: "Response generated",
      conversationId: result.conversationId,
      userMessageId: result.userMessage.id,
      messageId: result.assistantMessage.id,
      content: result.assistantMessage.content,
      reasoning: result.assistantMessage.reasoning,
    });
  } catch (error) {
    Logger.error("Qbot non-streaming message failed", {
      userId: user.id,
      conversationId,
      error: loggableError(error),
    });
    next(toHttpError(error));
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

    const conversation = await qbotService.createConversation(user.id, title);

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
    const { limit, offset } = pagination(req.query, 20);

    const result = await qbotService.listConversations(user.id, limit, offset);

    res.status(200).json({
      conversations: result.conversations,
      total: result.total,
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
      user.id,
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
    const { limit, offset } = pagination(req.query, 50);

    const result = await qbotService.getMessageHistory(
      conversationId,
      user.id,
      limit,
      offset,
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
      title,
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

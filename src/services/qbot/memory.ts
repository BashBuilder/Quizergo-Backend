import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { prisma } from "../../config/prisma.js";
import { qbotConfig } from "../../config/qbot.js";
import Logger from "../../core/Logger.js";
import { SUMMARY_SYSTEM_PROMPT } from "./prompts.js";
import { messageText } from "./utils.js";

export interface QbotContextMessage {
  role: string;
  content: string;
}

export interface QbotContext {
  summary: string | null;
  messages: QbotContextMessage[];
}

// Summary-based memory: Postgres is the durable store, so a conversation keeps
// its context after Redis or the process restarts.
export class QbotMemoryService {
  constructor(private readonly model: BaseChatModel) {}

  async getSummary(conversationId: string, userId: string): Promise<string | null> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { summary: true },
    });

    return conversation?.summary ?? null;
  }

  // Returns the rolling summary plus only the recent messages that have not
  // already been folded into it.
  async buildContext(conversationId: string, userId: string): Promise<QbotContext> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { summary: true, summaryMessageCount: true },
    });

    if (!conversation) return { summary: null, messages: [] };

    const total = await prisma.message.count({ where: { conversationId } });
    const firstUnsummarized = Math.min(conversation.summaryMessageCount, total);
    const start = Math.max(firstUnsummarized, total - qbotConfig.maxHistoryMessages);
    if (total <= start) {
      return { summary: conversation.summary, messages: [] };
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: start,
      take: total - start,
      select: { role: true, content: true },
    });

    return { summary: conversation.summary, messages };
  }

  // Folds unsummarized messages into the persisted summary once the configured
  // threshold is reached. Recent messages stay verbatim for continuity.
  async maybeSummarize(conversationId: string, userId: string): Promise<void> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { summary: true, summaryMessageCount: true },
    });

    if (!conversation) return;

    const total = await prisma.message.count({ where: { conversationId } });
    const unsummarized = total - conversation.summaryMessageCount;
    if (unsummarized < qbotConfig.summaryThreshold) return;

    const end = total - Math.min(qbotConfig.recentMessagesToKeep, total);
    if (end <= conversation.summaryMessageCount) return;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: conversation.summaryMessageCount,
      take: end - conversation.summaryMessageCount,
      select: { role: true, content: true },
    });

    if (messages.length === 0) return;

    try {
      const summary = await this.summarize(conversation.summary, messages);
      if (!summary) return;

      // Conditional update prevents two concurrent requests from overwriting
      // each other with summaries built from different message ranges.
      const updated = await prisma.conversation.updateMany({
        where: {
          id: conversationId,
          summaryMessageCount: conversation.summaryMessageCount,
        },
        data: {
          summary,
          summaryMessageCount: end,
          summaryUpdatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        Logger.debug("Qbot summary update skipped after a concurrent update", {
          conversationId,
        });
        return;
      }

      Logger.info("Qbot conversation summary updated", {
        conversationId,
        summarizedMessages: end,
      });
    } catch (error) {
      Logger.error("Qbot conversation summary failed", {
        conversationId,
        error: error instanceof Error ? error.name : "unknown error",
      });
    }
  }

  private async summarize(
    existingSummary: string | null,
    messages: QbotContextMessage[],
  ): Promise<string | null> {
    const transcript = messages
      .map(
        (message) =>
          `${message.role === "user" ? "Student" : "Qbot"}: ${message.content}`,
      )
      .join("\n\n");

    const input = existingSummary
      ? `Existing summary:\n${existingSummary}\n\nNew messages to merge into the summary:\n${transcript}`
      : `Conversation to summarize:\n${transcript}`;

    const response = await this.model.invoke(
      [new SystemMessage(SUMMARY_SYSTEM_PROMPT), new HumanMessage(input)],
      { signal: AbortSignal.timeout(qbotConfig.timeoutMs) },
    );

    const summary = messageText(response.content).trim();
    return summary.length > 0 ? summary : null;
  }
}

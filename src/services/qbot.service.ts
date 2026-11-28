import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { prisma } from "../config/prisma.js";
import { qbotConfig } from "../config/qbot.js";
import { InternalServerError, NotFoundError } from "../lib/errors.js";
import { QbotGraph, type QbotGraphInput } from "./qbot/graph.js";
import { getChatModel } from "./qbot/llm.js";
import { QbotMemoryService } from "./qbot/memory.js";

export interface QbotMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  reasoning: string | null;
  createdAt: string;
}

export interface QbotConversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: QbotMessage;
}

export interface QbotConversationDetail extends QbotConversation {
  messageCount: number;
  messages: QbotMessage[];
}

export interface QbotMessageHistory {
  messages: QbotMessage[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export type QbotStreamEvent =
  | { type: "start"; conversationId: string; messageId: string }
  | { type: "chunk"; content: string; reasoning: string }
  | {
      type: "complete";
      conversationId: string;
      messageId: string;
      content: string;
      reasoning: string;
    };

type ConversationRow = {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MessageRow = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  reasoning: string | null;
  createdAt: Date;
};

function toMessage(message: MessageRow): QbotMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
    reasoning: message.reasoning,
    createdAt: message.createdAt.toISOString(),
  };
}

function toConversation(conversation: ConversationRow): QbotConversation {
  return {
    id: conversation.id,
    userId: conversation.userId,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export class QbotService {
  private engine: {
    graph: QbotGraph;
    memory: QbotMemoryService;
  } | null = null;

  // Test seam: integration tests swap in a fake model without a provider key.
  /** @internal */
  setModelForTesting(model: BaseChatModel): void {
    this.engine = {
      graph: new QbotGraph(model),
      memory: new QbotMemoryService(model),
    };
  }

  private async ensureInitialized() {
    if (!this.engine) {
      const model = await getChatModel();
      this.engine = {
        graph: new QbotGraph(model),
        memory: new QbotMemoryService(model),
      };
    }

    return this.engine;
  }

  async createConversation(
    userId: string,
    title?: string,
  ): Promise<QbotConversation> {
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: title?.trim() || "New Conversation",
      },
    });

    return toConversation(conversation);
  }

  async listConversations(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ conversations: QbotConversation[]; total: number }> {
    const [total, conversations] = await prisma.$transaction([
      prisma.conversation.count({ where: { userId } }),
      prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
          },
          _count: { select: { messages: true } },
        },
      }),
    ]);

    return {
      total,
      conversations: conversations.map((conversation) => {
        const lastMessage = conversation.messages[0];
        return {
          ...toConversation(conversation),
          messageCount: conversation._count.messages,
          ...(lastMessage ? { lastMessage: toMessage(lastMessage) } : {}),
        };
      }),
    };
  }

  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<QbotConversationDetail | null> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: { _count: { select: { messages: true } } },
    });

    if (!conversation) return null;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: qbotConfig.maxHistoryMessages,
    });

    return {
      ...toConversation(conversation),
      messageCount: conversation._count.messages,
      messages: messages.reverse().map(toMessage),
    };
  }

  async getMessageHistory(
    conversationId: string,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<QbotMessageHistory> {
    await this.requireConversation(conversationId, userId);

    const [total, messages] = await prisma.$transaction([
      prisma.message.count({ where: { conversationId } }),
      prisma.message.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      messages: messages.map(toMessage),
      total,
      limit,
      offset,
      hasMore: offset + messages.length < total,
    };
  }

  async updateConversation(
    conversationId: string,
    userId: string,
    title: string,
  ): Promise<QbotConversation> {
    await this.requireConversation(conversationId, userId);

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });

    return toConversation(updated);
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<{ success: true }> {
    await this.requireConversation(conversationId, userId);

    // Messages are removed by the Conversation -> Message cascade.
    await prisma.conversation.delete({ where: { id: conversationId } });

    return { success: true };
  }

  async getSummary(conversationId: string, userId: string): Promise<string | null> {
    await this.requireConversation(conversationId, userId);
    const { memory } = await this.ensureInitialized();
    return memory.getSummary(conversationId, userId);
  }

  /** @internal - for testing, lets tests inject a mock model so no provider key is needed */
  resetForTesting(): void {
    this.engine = null;
  }

  async *streamMessage(
    conversationId: string | undefined,
    userId: string,
    content: string,
  ): AsyncGenerator<QbotStreamEvent> {
    const { graph, memory } = await this.ensureInitialized();
    const { conversation, userMessage } = await this.prepareMessage(
      conversationId,
      userId,
      content,
    );

    yield {
      type: "start",
      conversationId: conversation.id,
      messageId: userMessage.id,
    };

    const input = await this.buildGraphInput(conversation.id, userId);
    let complete: { content: string; reasoning: string } | null = null;

    for await (const chunk of graph.stream(input)) {
      if (chunk.type === "chunk") {
        yield chunk;
      } else {
        complete = { content: chunk.content, reasoning: chunk.reasoning };
      }
    }

    if (!complete || !complete.content.trim()) {
      throw new InternalServerError("Qbot returned an empty response");
    }

    const assistantMessage = await this.saveMessage(
      conversation.id,
      "assistant",
      complete.content,
      complete.reasoning || null,
    );

    // Summarisation runs in the background so it never delays the answer.
    // Failures are logged inside the memory service and retried on the next turn.
    void memory.maybeSummarize(conversation.id, userId);

    yield {
      type: "complete",
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      content: assistantMessage.content,
      reasoning: assistantMessage.reasoning ?? "",
    };
  }

  async sendMessage(
    conversationId: string | undefined,
    userId: string,
    content: string,
  ): Promise<{
    conversationId: string;
    userMessage: QbotMessage;
    assistantMessage: QbotMessage;
  }> {
    const { graph, memory } = await this.ensureInitialized();
    const { conversation, userMessage } = await this.prepareMessage(
      conversationId,
      userId,
      content,
    );

    const input = await this.buildGraphInput(conversation.id, userId);
    const result = await graph.invoke(input);

    if (!result.content.trim()) {
      throw new InternalServerError("Qbot returned an empty response");
    }

    const assistantMessage = await this.saveMessage(
      conversation.id,
      "assistant",
      result.content,
      result.reasoning || null,
    );

    // See streamMessage: the answer should not wait for summary generation.
    void memory.maybeSummarize(conversation.id, userId);

    return {
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
    };
  }

  private async prepareMessage(
    conversationId: string | undefined,
    userId: string,
    content: string,
  ): Promise<{
    conversation: ConversationRow;
    userMessage: QbotMessage;
  }> {
    const conversation = conversationId
      ? await this.requireConversation(conversationId, userId)
      : await prisma.conversation.create({
          data: {
            userId,
            title: content.trim().slice(0, 60) || "New Conversation",
          },
        });

    const userMessage = await this.saveMessage(
      conversation.id,
      "user",
      content,
    );

    return { conversation, userMessage };
  }

  private async buildGraphInput(
    conversationId: string,
    userId: string,
  ): Promise<QbotGraphInput> {
    const { memory } = await this.ensureInitialized();
    const context = await memory.buildContext(conversationId, userId);

    const messages: BaseMessage[] = context.messages.map((message) =>
      message.role === "assistant"
        ? new AIMessage(message.content)
        : new HumanMessage(message.content),
    );

    return {
      conversationId,
      summary: context.summary ?? "",
      messages,
      subject: "",
    };
  }

  private async saveMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    reasoning: string | null = null,
  ): Promise<QbotMessage> {
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: { conversationId, role, content, reasoning },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return toMessage(message);
  }

  private async requireConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationRow> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    return conversation;
  }
}

export const qbotService = new QbotService();

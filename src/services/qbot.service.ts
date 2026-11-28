import { prisma } from "../config/prisma.js";
import redisClient from "../cache/index.js";
import { qbotConfig } from "../config/qbot.js";
import Logger from "../core/Logger.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { v4 as uuidv4 } from "uuid";

// Initialize LLM based on provider
let llm: any;

async function initializeLLM() {
  const { provider, apiKey, model, temperature, maxTokens } = qbotConfig;
  
  if (provider === "openai") {
    const { ChatOpenAI } = await import("@langchain/openai");
    llm = new ChatOpenAI({
      apiKey,
      model,
      temperature,
      maxTokens,
      streaming: true,
    });
  } else if (provider === "anthropic") {
    const { ChatAnthropic } = await import("@langchain/anthropic");
    llm = new ChatAnthropic({
      apiKey,
      model,
      temperature,
      maxTokens,
      streaming: true,
    });
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
  
  return llm;
}

// System prompt for Qbot - the AI tutor
const QBOT_SYSTEM_PROMPT = `You are Qbot, a friendly, patient, and knowledgeable AI tutor for secondary school students preparing for Nigerian examinations (WAEC, JAMB, NECO). 

Your teaching approach:
- **Simple language**: Explain concepts in language that a child or secondary school student can easily understand
- **Stay on topic**: Keep explanations relevant to the question without introducing unnecessary information
- **Relatable analogies**: Use everyday examples and comparisons to make difficult concepts easier to understand
- **Step-by-step explanations**: For mathematical problems and questions requiring calculations or logical reasoning, break the solution into clear, manageable steps
- **Clarity over complexity**: Avoid unnecessary technical jargon. When technical terms are unavoidable, explain what they mean in simple language
- **Accuracy**: Ensure answers and explanations are factually correct. Never sacrifice correctness for simplicity
- **Encourage understanding**: Focus on helping students understand WHY an answer is correct rather than simply providing the answer

Behavior guidelines:
- Give direct answers before providing detailed explanations where appropriate
- Adapt explanations to the subject and complexity of the question
- Use examples, analogies, and practical illustrations where they genuinely improve understanding
- Understand follow-up questions that depend on previous messages
- If a question is ambiguous, ask for clarification instead of making unsupported assumptions
- If you don't know an answer, acknowledge this rather than fabricate information
- Be encouraging and supportive - students may be stressed about exams

You have access to conversation history. Reference previous messages when relevant to provide continuity in learning.`;

export class QbotService {
  private conversationChain: any = null;
  private initialized = false;

  async ensureInitialized() {
    if (!this.initialized) {
      await initializeLLM();
      this.conversationChain = this.createConversationChain();
      this.initialized = true;
    }
  }

  private createConversationChain() {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", QBOT_SYSTEM_PROMPT],
      new MessagesPlaceholder("history"),
      ["human", "{input}"],
    ]);

    return prompt.pipe(llm).pipe(new StringOutputParser());
  }

  // Redis keys for conversation memory
  private getConversationKey(conversationId: string) {
    return `qbot:conversation:${conversationId}`;
  }

  private getSummaryKey(conversationId: string) {
    return `qbot:summary:${conversationId}`;
  }

  private getUserConversationsKey(userId: string) {
    return `qbot:user:${userId}:conversations`;
  }

  // Get conversation from Redis cache or database
  async getConversation(conversationId: string, userId: string) {
    // Try Redis first
    const cached = await redisClient.get(this.getConversationKey(conversationId));
    if (cached) {
      const data = JSON.parse(cached);
      if (data.userId === userId) return data;
    }

    // Fallback to database
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: qbotConfig.maxHistoryMessages,
        },
      },
    });

    if (!conversation) return null;

    const result = {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        reasoning: m.reasoning,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    // Cache in Redis
    await redisClient.setEx(
      this.getConversationKey(conversationId),
      3600, // 1 hour TTL
      JSON.stringify(result)
    );

    return result;
  }

  // Get or create a conversation
  async getOrCreateConversation(userId: string, conversationId?: string, title?: string) {
    if (conversationId) {
      const existing = await this.getConversation(conversationId, userId);
      if (existing) return existing;
      throw new NotFoundError("Conversation not found");
    }

    // Create new conversation
    const newConversation = await prisma.conversation.create({
      data: {
        userId,
        title: title || "New Conversation",
      },
    });

    const result = {
      id: newConversation.id,
      userId: newConversation.userId,
      title: newConversation.title,
      createdAt: newConversation.createdAt.toISOString(),
      updatedAt: newConversation.updatedAt.toISOString(),
      messages: [],
    };

    // Update user's conversation list in Redis
    await this.addConversationToUserList(userId, result);

    return result;
  }

  // Add message to conversation
  async addMessage(
    conversationId: string,
    userId: string,
    role: "user" | "assistant",
    content: string,
    reasoning?: string | null
  ) {
    const message = await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        reasoning: reasoning ?? null,
      },
    });

    // Invalidate Redis cache
    await redisClient.del(this.getConversationKey(conversationId));
    
    // Update conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Check if we need to summarize
    await this.maybeSummarizeConversation(conversationId, userId);

    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      reasoning: message.reasoning,
      createdAt: message.createdAt.toISOString(),
    };
  }

  // Summarize conversation when it gets too long
  private async maybeSummarizeConversation(conversationId: string, userId: string) {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) return;

    const messageCount = conversation.messages.length;
    if (messageCount < qbotConfig.summaryThreshold) return;

    // Check if we already have a recent summary
    const summaryKey = this.getSummaryKey(conversationId);
    const existingSummary = await redisClient.get(summaryKey);
    if (existingSummary) return;

    // Create summary using LLM
    await this.createSummary(conversationId, userId, conversation.messages);
  }

  private async createSummary(conversationId: string, userId: string, messages: any[]) {
    try {
      // Take older messages (excluding recent ones)
      const recentCount = Math.min(5, messages.length);
      const olderMessages = messages.slice(0, -recentCount);
      
      if (olderMessages.length < 3) return; // Not enough to summarize

      const summaryPrompt = `Summarize the following conversation between a student and an AI tutor. 
Focus on:
- Key topics discussed
- Important concepts explained
- Questions the student asked
- Solutions/approaches provided
- Any ongoing context the student might reference later

Keep the summary concise but informative (200-400 words).`;

      const historyText = olderMessages
        .map(m => `${m.role === "user" ? "Student" : "Qbot"}: ${m.content}`)
        .join("\n\n");

      const summary = await llm.invoke([
        new SystemMessage(summaryPrompt),
        new HumanMessage(historyText),
      ]);

      await redisClient.setEx(
        this.getSummaryKey(conversationId),
        86400 * 7, // 7 days TTL
        summary.content.toString()
      );

      Logger.info(`Created summary for conversation ${conversationId}`);
    } catch (error) {
      Logger.error("Failed to create conversation summary:", error);
    }
  }

  // Get conversation summary
  async getConversationSummary(conversationId: string) {
    return await redisClient.get(this.getSummaryKey(conversationId));
  }

  // Build history for LLM (including summary if available)
  async buildLLMHistory(conversationId: string, userId: string): Promise<BaseMessage[]> {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) return [];

    const messages: BaseMessage[] = [];

    // Add summary as system context if available
    const summary = await this.getConversationSummary(conversationId);
    if (summary) {
      messages.push(new SystemMessage(`Previous conversation summary:\n${summary}`));
    }

    // Add recent messages
    const recentMessages = conversation.messages.slice(-qbotConfig.maxHistoryMessages);
    for (const msg of recentMessages) {
      if (msg.role === "user") {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === "assistant") {
        messages.push(new AIMessage(msg.content));
      }
    }

    return messages;
  }

  // Stream response from LLM
  async *streamResponse(conversationId: string, userId: string, userMessage: string) {
    await this.ensureInitialized();

    // Build history
    const history = await this.buildLLMHistory(conversationId, userId);

    // Add user message to history for this invocation
    const fullHistory = [...history, new HumanMessage(userMessage)];

    // Stream the response
    const stream = await llm.stream(fullHistory);
    
    let fullResponse = "";
    let fullReasoning = "";
    
    for await (const chunk of stream) {
      const content = chunk.content?.toString() || "";
      const reasoning = chunk.additional_kwargs?.reasoning?.toString() || "";
      
      fullResponse += content;
      fullReasoning += reasoning;
      
      yield {
        content,
        reasoning,
        done: false,
      };
    }

    yield {
      content: "",
      reasoning: fullReasoning,
      done: true,
      fullResponse,
      fullReasoning,
    };
  }

  // Non-streaming response (for simpler use cases)
  async generateResponse(conversationId: string, userId: string, userMessage: string) {
    await this.ensureInitialized();

    const history = await this.buildLLMHistory(conversationId, userId);
    const fullHistory = [...history, new HumanMessage(userMessage)];

    const response = await this.conversationChain.invoke({
      input: userMessage,
      history: history,
    });

    return response;
  }

  // Get user's conversations list
  async getUserConversations(userId: string, limit = 20, offset = 0) {
    // Try Redis first
    const cacheKey = this.getUserConversationsKey(userId);
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return data.slice(offset, offset + limit);
    }

    // Fallback to database
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    const result = conversations.map(c => ({
      id: c.id,
      userId: c.userId,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
      lastMessage: c.messages[0] ? {
        id: c.messages[0].id,
        conversationId: c.messages[0].conversationId,
        role: c.messages[0].role,
        content: c.messages[0].content,
        reasoning: c.messages[0].reasoning,
        createdAt: c.messages[0].createdAt.toISOString(),
      } : undefined,
    }));

    // Cache in Redis
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result)); // 5 min TTL

    return result;
  }

  // Update conversation title
  async updateConversation(conversationId: string, userId: string, title: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) throw new NotFoundError("Conversation not found");

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });

    // Invalidate cache
    await redisClient.del(this.getConversationKey(conversationId));
    await redisClient.del(this.getUserConversationsKey(userId));

    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // Delete conversation
  async deleteConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) throw new NotFoundError("Conversation not found");

    // Delete messages (cascade will handle this, but explicit is clearer)
    await prisma.message.deleteMany({
      where: { conversationId },
    });

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    // Invalidate cache
    await redisClient.del(this.getConversationKey(conversationId));
    await redisClient.del(this.getSummaryKey(conversationId));
    await redisClient.del(this.getUserConversationsKey(userId));

    return { success: true };
  }

  // Add conversation to user's list cache
  private async addConversationToUserList(userId: string, conversation: any) {
    const cacheKey = this.getUserConversationsKey(userId);
    const cached = await redisClient.get(cacheKey);
    let list = cached ? JSON.parse(cached) : [];
    list.unshift(conversation);
    list = list.slice(0, 50); // Keep only latest 50
    await redisClient.setEx(cacheKey, 300, JSON.stringify(list));
  }

  // Get conversation message history
  async getMessageHistory(conversationId: string, userId: string, limit = 50, offset = 0) {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) throw new NotFoundError("Conversation not found");

    const messages = conversation.messages.slice(offset, offset + limit);
    return {
      messages,
      total: conversation.messages.length,
      hasMore: offset + limit < conversation.messages.length,
    };
  }
}

export const qbotService = new QbotService();
import z from "zod";

export const sendMessageModel = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(5000, "Message too long"),
  conversationId: z.string().uuid("Invalid conversation ID").optional(),
});

export type SendMessageType = z.infer<typeof sendMessageModel>;

export const createConversationModel = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(200).optional(),
});

export type CreateConversationType = z.infer<typeof createConversationModel>;

export const conversationIdParams = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
});

export type ConversationIdParams = z.infer<typeof conversationIdParams>;

export const messageHistoryModel = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type MessageHistoryType = z.infer<typeof messageHistoryModel>;

export const listConversationsModel = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListConversationsType = z.infer<typeof listConversationsModel>;

export const updateConversationModel = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(200),
});

export type UpdateConversationType = z.infer<typeof updateConversationModel>;

// Response types
export const messageResponseModel = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  reasoning: z.string().nullable(),
  createdAt: z.string(),
});

export type MessageResponseType = z.infer<typeof messageResponseModel>;

export const conversationResponseModel = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number().int().nonnegative().optional(),
  lastMessage: messageResponseModel.optional(),
});

export type ConversationResponseType = z.infer<typeof conversationResponseModel>;

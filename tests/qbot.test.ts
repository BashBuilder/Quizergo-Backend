import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { version } from "../src/routes/index.js";
import { qbotConfig } from "../src/config/qbot.js";
import { QbotMemoryService } from "../src/services/qbot/memory.js";
import { qbotService } from "../src/services/qbot.service.js";
import redisClient from "../src/cache/index.js";
import { createTokens } from "../src/lib/jwt.js";
import { saveUserToken } from "../src/controllers/keystore.controller.js";

const { fakeModel, streamCalls } = vi.hoisted(() => {
  const streamCalls: unknown[][] = [];

  const fakeModel = {
    async *stream(messages: Array<{ getType: () => string; content: unknown }>) {
      streamCalls.push(messages);

      const lastHuman = [...messages]
        .reverse()
        .find((message) => message.getType() === "human");
      const prompt = lastHuman ? String(lastHuman.content) : "";

      if (prompt.includes("FAIL")) {
        throw new Error("provider unavailable");
      }

      yield { content: "Sure! ", additional_kwargs: {} };
      yield { content: `You asked: ${prompt}`, additional_kwargs: {} };
    },
    async invoke(messages: Array<{ content: unknown }>) {
      const last = messages[messages.length - 1];
      return {
        content: `Summary notes: ${String(last?.content ?? "").slice(0, 120)}`,
      };
    },
  };

  return { fakeModel, streamCalls };
});

// The global test setup imports the app (and therefore the real Redis client)
// before test files run, so replace the few Redis commands used here instead of
// trying to mock the whole module. The Qbot service gets an injected fake model
// for the same reason: no provider call is made in tests.
beforeAll(() => {
  const counters = new Map<string, number>();

  qbotService.setModelForTesting(fakeModel as never);

  vi.spyOn(redisClient, "incr").mockImplementation(async (key: string) => {
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    return next;
  });
  vi.spyOn(redisClient, "expire").mockResolvedValue(true);
  vi.spyOn(redisClient, "ttl").mockResolvedValue(60);
});

let authToken: string;
let userId: string;

async function createUserWithToken(
  email: string,
): Promise<{ id: string; token: string }> {
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      firstName: "Test",
      lastName: "User",
      isVerified: true,
    },
  });

  const accessTokenKey = crypto.randomBytes(64).toString("hex");
  const refreshTokenKey = crypto.randomBytes(64).toString("hex");
  await saveUserToken(user, accessTokenKey, refreshTokenKey);
  const tokens = await createTokens(user, accessTokenKey, refreshTokenKey);

  return { id: user.id, token: tokens.accessToken };
}

async function createConversation(title = "Test Conversation") {
  const res = await request(app)
    .post(`/${version}/qbot/conversations`)
    .set("Authorization", `Bearer ${authToken}`)
    .send({ title })
    .expect(201);

  return res.body.conversation as {
    id: string;
    userId: string;
    title: string;
  };
}

beforeEach(async () => {
  streamCalls.length = 0;

  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.keyStore.deleteMany();
  await prisma.user.deleteMany();

  const user = await createUserWithToken("qbot-test@example.com");
  userId = user.id;
  authToken = user.token;
});

describe("Qbot conversation API", () => {
  it("creates a new conversation for the authenticated user", async () => {
    const conversation = await createConversation("Algebra help");

    expect(conversation.id).toBeDefined();
    expect(conversation.title).toBe("Algebra help");
    expect(conversation.userId).toBe(userId);
  });

  it("streams a response and persists the user and assistant messages", async () => {
    const conversation = await createConversation();

    const res = await request(app)
      .post(`/${version}/qbot/message`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        message: "What is photosynthesis?",
        conversationId: conversation.id,
      })
      .expect(200);

    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain('"type":"start"');
    expect(res.text).toContain('"type":"chunk"');
    expect(res.text).toContain('"type":"complete"');

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(messages[0]?.content).toBe("What is photosynthesis?");
    expect(messages[1]?.content).toContain("What is photosynthesis?");
  });

  it("returns a non-streaming response", async () => {
    const conversation = await createConversation();

    const res = await request(app)
      .post(`/${version}/qbot/message/non-streaming`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Hello Qbot!", conversationId: conversation.id })
      .expect(200);

    expect(res.body.message).toBe("Response generated");
    expect(res.body.conversationId).toBe(conversation.id);
    expect(res.body.content).toContain("Hello Qbot!");
    expect(res.body.messageId).toBeDefined();
  });

  it("lists conversations with their latest message", async () => {
    const conversation = await createConversation("Conversation 1");
    await createConversation("Conversation 2");

    await request(app)
      .post(`/${version}/qbot/message/non-streaming`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Latest message", conversationId: conversation.id })
      .expect(200);

    const res = await request(app)
      .get(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.total).toBe(2);
    expect(res.body.conversations).toHaveLength(2);

    const updated = res.body.conversations.find(
      (item: { id: string }) => item.id === conversation.id,
    );
    expect(updated.lastMessage.role).toBe("assistant");
    expect(updated.lastMessage.content).toContain("Latest message");
  });

  it("paginates message history and reports the total", async () => {
    const conversation = await createConversation();
    const base = Date.now();

    await prisma.message.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        conversationId: conversation.id,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `message ${index}`,
        createdAt: new Date(base + index * 1000),
      })),
    });

    const res = await request(app)
      .get(`/${version}/qbot/conversations/${conversation.id}/messages`)
      .query({ limit: 2, offset: 1 })
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].content).toBe("message 1");
    expect(res.body.messages[1].content).toBe("message 2");
    expect(res.body.total).toBe(5);
    expect(res.body.hasMore).toBe(true);
  });

  it("updates the conversation title", async () => {
    const conversation = await createConversation("Old Title");

    const res = await request(app)
      .patch(`/${version}/qbot/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "New Title" })
      .expect(200);

    expect(res.body.conversation.title).toBe("New Title");
  });

  it("deletes a conversation and its messages", async () => {
    const conversation = await createConversation();

    await request(app)
      .post(`/${version}/qbot/message/non-streaming`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Delete me", conversationId: conversation.id })
      .expect(200);

    await request(app)
      .delete(`/${version}/qbot/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    await request(app)
      .get(`/${version}/qbot/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(404);

    expect(
      await prisma.message.count({ where: { conversationId: conversation.id } }),
    ).toBe(0);
  });

  it("prevents users from reading or writing another user's conversation", async () => {
    const conversation = await createConversation();
    const other = await createUserWithToken("qbot-other@example.com");

    await request(app)
      .get(`/${version}/qbot/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${other.token}`)
      .expect(404);

    await request(app)
      .post(`/${version}/qbot/message/non-streaming`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ message: "Hijack", conversationId: conversation.id })
      .expect(404);

    await request(app)
      .delete(`/${version}/qbot/conversations/${conversation.id}`)
      .set("Authorization", `Bearer ${other.token}`)
      .expect(404);

    expect(
      await prisma.message.count({ where: { conversationId: conversation.id } }),
    ).toBe(0);
  });

  it("rejects unauthenticated and invalid requests", async () => {
    await request(app)
      .post(`/${version}/qbot/conversations`)
      .send({ title: "Test" })
      .expect(401);

    const conversation = await createConversation();

    await request(app)
      .post(`/${version}/qbot/message`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "", conversationId: conversation.id })
      .expect(400);

    await request(app)
      .post(`/${version}/qbot/message`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "a".repeat(5001), conversationId: conversation.id })
      .expect(400);

    await request(app)
      .get(`/${version}/qbot/conversations/not-a-uuid`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(400);

    await request(app)
      .get(`/${version}/qbot/conversations`)
      .query({ limit: 0 })
      .set("Authorization", `Bearer ${authToken}`)
      .expect(400);
  });

  it("does not persist an assistant message when the provider fails", async () => {
    const conversation = await createConversation();

    const res = await request(app)
      .post(`/${version}/qbot/message`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "FAIL", conversationId: conversation.id })
      .expect(200);

    expect(res.text).toContain('"type":"error"');

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("user");
  });
});

describe("Qbot summary memory", () => {
  it("summarizes older messages and persists the summary", async () => {
    const memory = new QbotMemoryService(fakeModel as never);
    const conversation = await prisma.conversation.create({
      data: { userId, title: "Memory test" },
    });

    const total = qbotConfig.summaryThreshold + qbotConfig.recentMessagesToKeep;
    const base = Date.now();

    await prisma.message.createMany({
      data: Array.from({ length: total }, (_, index) => ({
        conversationId: conversation.id,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `message ${index}`,
        createdAt: new Date(base + index * 1000),
      })),
    });

    await memory.maybeSummarize(conversation.id, userId);

    const updated = await prisma.conversation.findUnique({
      where: { id: conversation.id },
    });

    expect(updated?.summary).toBeTruthy();
    expect(updated?.summaryMessageCount).toBe(
      total - qbotConfig.recentMessagesToKeep,
    );
    expect(updated?.summaryUpdatedAt).toBeTruthy();
  });

  it("does not summarize before the threshold is reached", async () => {
    const memory = new QbotMemoryService(fakeModel as never);
    const conversation = await prisma.conversation.create({
      data: { userId, title: "Small memory test" },
    });

    await prisma.message.createMany({
      data: Array.from(
        { length: Math.max(1, qbotConfig.summaryThreshold - 1) },
        (_, index) => ({
          conversationId: conversation.id,
          role: index % 2 === 0 ? "user" : "assistant",
          content: `message ${index}`,
        }),
      ),
    });

    await memory.maybeSummarize(conversation.id, userId);

    const updated = await prisma.conversation.findUnique({
      where: { id: conversation.id },
    });

    expect(updated?.summary).toBeNull();
    expect(updated?.summaryMessageCount).toBe(0);
  });

  it("merges new messages into an existing summary", async () => {
    const memory = new QbotMemoryService(fakeModel as never);
    const conversation = await prisma.conversation.create({
      data: { userId, title: "Merging memory test" },
    });

    const firstBatch = qbotConfig.summaryThreshold + qbotConfig.recentMessagesToKeep;
    const base = Date.now();

    await prisma.message.createMany({
      data: Array.from({ length: firstBatch }, (_, index) => ({
        conversationId: conversation.id,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `first batch ${index}`,
        createdAt: new Date(base + index * 1000),
      })),
    });

    await memory.maybeSummarize(conversation.id, userId);

    const afterFirst = await prisma.conversation.findUnique({
      where: { id: conversation.id },
    });
    const firstCount = afterFirst?.summaryMessageCount ?? 0;
    expect(firstCount).toBeGreaterThan(0);

    const secondBatch = qbotConfig.summaryThreshold + 2;
    await prisma.message.createMany({
      data: Array.from({ length: secondBatch }, (_, index) => ({
        conversationId: conversation.id,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `second batch ${index}`,
        createdAt: new Date(base + (firstBatch + index) * 1000),
      })),
    });

    await memory.maybeSummarize(conversation.id, userId);

    const afterSecond = await prisma.conversation.findUnique({
      where: { id: conversation.id },
    });

    expect(afterSecond?.summaryMessageCount).toBeGreaterThan(firstCount);
    expect(afterSecond?.summary).toBeTruthy();
  });

  it("does not leak a conversation's memory to another user", async () => {
    const memory = new QbotMemoryService(fakeModel as never);
    const conversation = await prisma.conversation.create({
      data: { userId, title: "Private memory" },
    });

    await prisma.message.createMany({
      data: Array.from({ length: 3 }, (_, index) => ({
        conversationId: conversation.id,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `private ${index}`,
      })),
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { summary: "Private summary", summaryMessageCount: 3 },
    });

    const other = await createUserWithToken("qbot-memory-other@example.com");

    const ownContext = await memory.buildContext(conversation.id, userId);
    const otherContext = await memory.buildContext(conversation.id, other.id);

    expect(ownContext.summary).toBe("Private summary");
    expect(otherContext).toEqual({ summary: null, messages: [] });
  });

  it("sends the persisted summary plus recent messages to the model", async () => {
    const conversation = await createConversation();
    const base = Date.now();

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { summary: "Student is learning algebra.", summaryMessageCount: 0 },
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          role: "user",
          content: "What is x?",
          createdAt: new Date(base),
        },
        {
          conversationId: conversation.id,
          role: "assistant",
          content: "x is an unknown number.",
          createdAt: new Date(base + 1000),
        },
      ],
    });

    await request(app)
      .post(`/${version}/qbot/message`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Continue", conversationId: conversation.id })
      .expect(200);

    const prompt = streamCalls.at(-1) as Array<{
      getType: () => string;
      content: unknown;
    }>;

    expect(prompt[0]?.getType()).toBe("system");
    expect(
      prompt.some(
        (message) =>
          message.getType() === "system" &&
          String(message.content).includes("Student is learning algebra."),
      ),
    ).toBe(true);
    expect(
      prompt.some(
        (message) =>
          message.getType() === "human" &&
          String(message.content) === "What is x?",
      ),
    ).toBe(true);
    expect(prompt.length).toBeLessThanOrEqual(
      qbotConfig.maxHistoryMessages + 3,
    );
  });
});

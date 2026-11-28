import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app, initializeApp } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { version } from "../src/routes/index.js";
import bcrypt from "bcrypt";
import { qbotService } from "../src/services/qbot.service.js";

// Mock the LLM
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      stream: async function* () {
        yield { content: "Hello! ", additional_kwargs: {} };
        yield { content: "How can I help you today?", additional_kwargs: {} };
      },
      invoke: vi.fn().mockResolvedValue({ content: "Hello! How can I help you today?" }),
    })),
  };
});

vi.mock("@langchain/anthropic", () => {
  return {
    ChatAnthropic: vi.fn().mockImplementation(() => ({
      stream: async function* () {
        yield { content: "Hello! ", additional_kwargs: {} };
        yield { content: "How can I help you today?", additional_kwargs: {} };
      },
      invoke: vi.fn().mockResolvedValue({ content: "Hello! How can I help you today?" }),
    })),
  };
});

let authToken: string;
let userId: string;

beforeEach(async () => {
  // Clean up
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.keyStore.deleteMany();
  await prisma.user.deleteMany();

  // Create a test user
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: {
      email: "test@example.com",
      password: passwordHash,
      firstName: "Test",
      lastName: "User",
      isVerified: true,
    },
  });
  userId = user.id;

  // Login to get token
  const loginRes = await request(app)
    .post(`/${version}/auth/login`)
    .send({ email: "test@example.com", password: "password123" });
  
  authToken = loginRes.body.accessToken;
});

describe("Qbot Chatbot", () => {
  it("should create a new conversation", async () => {
    const res = await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Test Conversation" })
      .expect(201);

    expect(res.body.conversation).toBeDefined();
    expect(res.body.conversation.id).toBeDefined();
    expect(res.body.conversation.title).toBe("Test Conversation");
    expect(res.body.conversation.userId).toBe(userId);
  });

  it("should send a message and get streaming response", async () => {
    // First create a conversation
    const convRes = await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Test Conversation" })
      .expect(201);

    const conversationId = convRes.body.conversation.id;

    // Send a message
    const res = await request(app)
      .post(`/${version}/qbot/message`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Hello Qbot!", conversationId })
      .expect(200);

    // Response should be a stream, check it contains data
    expect(res.text).toContain("chunk");
    expect(res.text).toContain("complete");
  });

  it("should send a message non-streaming", async () => {
    const convRes = await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Test Conversation" })
      .expect(201);

    const conversationId = convRes.body.conversation.id;

    const res = await request(app)
      .post(`/${version}/qbot/message/non-streaming`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Hello Qbot!", conversationId })
      .expect(200);

    expect(res.body.message).toBe("Response generated");
    expect(res.body.conversationId).toBe(conversationId);
    expect(res.body.content).toBeDefined();
  });

  it("should get user conversations", async () => {
    // Create a couple of conversations
    await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Conversation 1" })
      .expect(201);

    await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Conversation 2" })
      .expect(201);

    const res = await request(app)
      .get(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.conversations).toBeDefined();
    expect(res.body.conversations.length).toBe(2);
  });

  it("should get a specific conversation", async () => {
    const convRes = await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Test Conversation" })
      .expect(201);

    const conversationId = convRes.body.conversation.id;

    const res = await request(app)
      .get(`/${version}/qbot/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.conversation.id).toBe(conversationId);
    expect(res.body.conversation.title).toBe("Test Conversation");
  });

  it("should get message history", async () => {
    const convRes = await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Test Conversation" })
      .expect(201);

    const conversationId = convRes.body.conversation.id;

    // Send a message
    await request(app)
      .post(`/${version}/qbot/message/non-streaming`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Hello!", conversationId })
      .expect(200);

    const res = await request(app)
      .get(`/${version}/qbot/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.messages).toBeDefined();
    expect(res.body.messages.length).toBeGreaterThan(0);
  });

  it("should update conversation title", async () => {
    const convRes = await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Old Title" })
      .expect(201);

    const conversationId = convRes.body.conversation.id;

    const res = await request(app)
      .patch(`/${version}/qbot/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "New Title" })
      .expect(200);

    expect(res.body.conversation.title).toBe("New Title");
  });

  it("should delete a conversation", async () => {
    const convRes = await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Test Conversation" })
      .expect(201);

    const conversationId = convRes.body.conversation.id;

    await request(app)
      .delete(`/${version}/qbot/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    // Verify it's deleted
    await request(app)
      .get(`/${version}/qbot/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(404);
  });

  it("should reject unauthenticated requests", async () => {
    await request(app)
      .post(`/${version}/qbot/conversations`)
      .send({ title: "Test" })
      .expect(401);
  });

  it("should validate message input", async () => {
    const convRes = await request(app)
      .post(`/${version}/qbot/conversations`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Test" })
      .expect(201);

    const conversationId = convRes.body.conversation.id;

    // Empty message should fail
    await request(app)
      .post(`/${version}/qbot/message`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "", conversationId })
      .expect(400);

    // Too long message should fail
    await request(app)
      .post(`/${version}/qbot/message`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "a".repeat(5001), conversationId })
      .expect(400);
  });
});
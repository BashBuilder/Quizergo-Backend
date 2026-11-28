import { describe, it, expect, beforeAll, afterAll, skip } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { getChatModel, resetChatModel } from "../src/services/qbot/llm.js";
import { qbotConfig } from "../src/config/qbot.js";

// Skip integration tests if:
// - No API key is set
// - Using placeholder/test keys
// - Running in test environment without proper setup
const shouldRunIntegration =
  qbotConfig.apiKey &&
  !qbotConfig.apiKey.includes("the_api_key") &&
  qbotConfig.apiKey !== "test-key" &&
  qbotConfig.provider === "openrouter";

describe.skipIf(!shouldRunIntegration)("LLM Integration Tests", () => {
  let model: Awaited<ReturnType<typeof getChatModel>>;

  beforeAll(async () => {
    model = await getChatModel();
  });

  afterAll(() => {
    resetChatModel();
  });

  it("connects to the LLM provider and gets a response", async () => {
    const response = await model.invoke([new HumanMessage("Hello, what is 2 + 2?")]);

    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
    expect(typeof response.content).toBe("string");

    // Should be a reasonable answer
    const content = String(response.content).toLowerCase();
    expect(content).toContain("4");
  }, 30000);

  it("handles streaming responses", async () => {
    const chunks: string[] = [];

    for await (const chunk of model.stream([
      new HumanMessage("Count to 3 in English, separated by commas"),
    ])) {
      if (chunk.content) {
        chunks.push(String(chunk.content));
      }
    }

    const fullResponse = chunks.join("");
    expect(fullResponse.length).toBeGreaterThan(0);
  }, 30000);
});

// Standalone test runner for manual verification
if (import.meta.path === new URL(import.meta.url) && process.argv.includes("--standalone")) {
  const runStandaloneTest = async () => {
    console.log("\n===== LLM Integration Test =====\n");
    console.log(`Provider: ${qbotConfig.provider}`);
    console.log(`Model: ${qbotConfig.model}`);
    console.log(`API Key: ${qbotConfig.apiKey ? `****${qbotConfig.apiKey.slice(-4)}` : "NOT SET"}`);
    console.log(`Temperature: ${qbotConfig.temperature}`);
    console.log(`Max Tokens: ${qbotConfig.maxTokens}`);
    console.log(`Timeout: ${qbotConfig.timeoutMs}ms`);
    console.log(`Max Retries: ${qbotConfig.maxRetries}`);

    if (!qbotConfig.apiKey) {
      console.error("\n❌ ERROR: Qbot_LLM_API_KEY is not set in .env file");
      console.error("\n   For OpenRouter, add to .env:");
      console.error("   Qbot_LLM_PROVIDER=openrouter");
      console.error("   Qbot_LLM_API_KEY=your-openrouter-api-key");
      console.error("   Qbot_LLM_MODEL=meta-llama/llama-3.1-8b-instruct");
      process.exit(1);
    }

    try {
      console.log("\n⏳ Attempting to get chat model...");
      const model = await getChatModel();
      console.log("✅ Model instantiated successfully\n");

      console.log("📤 Sending test message: 'What is 2 plus 2?'");
      const response = await model.invoke([new HumanMessage("What is 2 plus 2?")]);
      console.log(`✅ Received response: ${response.content}\n`);

      const content = String(response.content).toLowerCase();
      if (content.includes("4")) {
        console.log("✅ Response contains expected answer '4'");
      }

      console.log("\n📤 Testing streaming response...");
      const chunks: string[] = [];
      for await (const chunk of model.stream([
        new HumanMessage("Count to 3 in English, separated by commas"),
      ])) {
        if (chunk.content) chunks.push(String(chunk.content));
      }
      console.log(`✅ Stream response: ${chunks.join("")}\n`);

      resetChatModel();
      console.log("🎉 Integration test passed! LLM provider is working correctly.\n");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ Integration test failed:");

      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : "";

      if (errMsg.includes("403") || errMsg.includes("limit")) {
        console.error("\n   Status: 403 - API Key Limit Exceeded");
        console.error("   Cause: Your OpenRouter API key has reached its daily free tier limit.");
        console.error("   Solution: Wait for quota reset or upgrade your OpenRouter key at:");
        console.error("   https://openrouter.ai/settings/keys");
      } else if (errMsg.includes("429") || errMsg.includes("rate")) {
        console.error("\n   Status: 429 - Rate Limit Exceeded");
        console.error("   Solution: Reduce request frequency or upgrade your plan.");
      } else if (errMsg.includes("401") || errMsg.includes("authentication") || errMsg.includes("API key")) {
        console.error("\n   Status: 401 - Authentication Failed");
        console.error("   Cause: Invalid API key or provider mismatch.");
        console.error("   Solution: Verify your API key and set Qbot_LLM_PROVIDER to match your key type.");
        console.error("\n   Debug info:", errMsg.split("\n")[0]);
      } else if (errMsg.includes("400") || errMsg.includes("not a valid model")) {
        console.error("\n   Status: 400 - Bad Request (Invalid Model)");
        console.error("   Cause: The model ID is not recognized.");
        console.error("   Solution: Use a valid model ID from https://openrouter.ai/models");
        console.error("\n   Debug info:", errMsg.split("\n")[0]);
      } else {
        console.error("\n   Error message:", errMsg);
        if (errStack) {
          console.error("\n   Stack trace (first 5 lines):");
          console.error(errStack.split("\n").slice(0, 5).join("\n"));
        }
      }

      resetChatModel();
      process.exit(1);
    }
  };

  runStandaloneTest();
}
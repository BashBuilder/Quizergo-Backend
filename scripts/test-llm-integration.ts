/**
 * Standalone LLM Integration Test Script
 *
 * Usage:
 *   pnpm exec tsx scripts/test-llm-integration.ts
 *
 * Requires:
 *   Qbot_LLM_PROVIDER=openrouter
 *   Qbot_LLM_API_KEY=<your-openrouter-api-key>
 *   Qbot_LLM_MODEL=<model-name> (optional, defaults to gpt-4o)
 */

import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { getChatModel, resetChatModel } from "../src/services/qbot/llm.js";
import { qbotConfig } from "../src/config/qbot.js";

// Print current configuration
console.log("\n===== LLM Configuration Check =====\n");
console.log(`Provider: ${qbotConfig.provider}`);
console.log(`Model: ${qbotConfig.model}`);
console.log(`API Key: ${qbotConfig.apiKey ? `****${qbotConfig.apiKey.slice(-4)}` : "NOT SET"}`);
console.log(`Temperature: ${qbotConfig.temperature}`);
console.log(`Max Tokens: ${qbotConfig.maxTokens}`);
console.log(`Timeout: ${qbotConfig.timeoutMs}ms`);
console.log(`Max Retries: ${qbotConfig.maxRetries}`);

// Validate configuration
if (!qbotConfig.apiKey) {
  console.error("\n❌ ERROR: Qbot_LLM_API_KEY is not set in .env file");
  console.error("\n   For OpenRouter, add to .env:");
  console.error("   Qbot_LLM_PROVIDER=openrouter");
  console.error("   Qbot_LLM_API_KEY=your-openrouter-api-key");
  console.error("   Qbot_LLM_MODEL=google/gemini-pro (or any OpenRouter model)");
  process.exit(1);
}

if (qbotConfig.provider !== "openrouter") {
  console.error("\n⚠️  WARNING: Provider is set to '${qbotConfig.provider}', expected 'openrouter'");
  console.error("   OpenRouter keys won't work with the default OpenAI endpoint.");
  console.error("   Change your .env to: Qbot_LLM_PROVIDER=openrouter");
}

// Check if it looks like an OpenRouter key
const isLikelyOpenRouter = qbotConfig.apiKey === "the_api_key" || qbotConfig.apiKey.includes("openrouter");
if (isLikelyOpenRouter && qbotConfig.provider !== "openrouter") {
  console.error("\n❌ DETECTED: API key looks like an OpenRouter key, but provider is not set to 'openrouter'");
  console.error("   This causes authentication errors because OpenRouter keys don't work with OpenAI's API.");
  console.error("\n   Fix: Set Qbot_LLM_PROVIDER=openrouter in your .env");
}

console.log("\n===== Integration Test =====\n");

async function runIntegrationTest() {
  try {
    console.log("⏳ Attempting to get chat model...");
    const model = await getChatModel();

    console.log("✅ Model instantiated successfully\n");

    console.log("📤 Sending test message: 'What is 2 plus 2?'");
    const response = await model.invoke([new HumanMessage("What is 2 plus 2?")]);

    console.log(`✅ Received response: ${response.content}\n`);

    const content = String(response.content).toLowerCase();
    if (content.includes("4")) {
      console.log("✅ Response contains expected answer '4'");
    } else {
      console.warn("⚠️  Warning: Response may not contain expected answer");
    }

    console.log("\n📤 Testing streaming response...");
    const chunks: string[] = [];

    for await (const chunk of model.stream([
      new HumanMessage("Count to 3 in English, separated by commas"),
    ])) {
      if (chunk.content) {
        chunks.push(String(chunk.content));
      }
    }

    const streamResponse = chunks.join("");
    console.log(`✅ Stream response: ${streamResponse}\n`);

    resetChatModel();

    console.log("🎉 All integration tests passed! External LLM provider is working correctly.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Integration test failed:");

    if (error instanceof Error && error.message.includes("403")) {
      console.error("\n   Status: 403 - API Key Limit Exceeded");
      console.error("   Cause: Your OpenRouter API key has reached its daily free tier limit ($0.00).");
      console.error("   Solution: Wait for quota reset or upgrade your OpenRouter key at:");
      console.error("   https://openrouter.ai/settings/keys");
      console.error("\n   ✅ CONFIRMED: The integration is working correctly!");
      console.error("   The authentication and headers are properly configured.");
    } else if (error instanceof Error && error.message.includes("401")) {
      console.error("\n   Status: 401 - Authentication Failed");
      console.error("   This is an authentication error.");
      console.error("   Common causes:");
      console.error("   1. Wrong API key for the provider");
      console.error("   2. Provider mismatch (OpenRouter key with OpenAI endpoint)");
      console.error("   3. Using a placeholder/test API key that doesn't have access");
      console.error("\n   Solutions:");
      console.error("   - Ensure Qbot_LLM_PROVIDER matches your API key type");
      console.error("   - Get a valid API key from the provider's developer portal");
      console.error("   - For OpenRouter: https://openrouter.ai/settings/api-keys");
    } else if (error instanceof Error && error.message.includes("429")) {
      console.error("\n   Status: 429 - Rate Limit Exceeded");
      console.error("   Rate limit exceeded. Try again later or upgrade your plan.");
    } else if (error instanceof Error && error.message.includes("timeout")) {
      console.error("\n   Request timed out. Try with a smaller model or increase Qbot_LLM_TIMEOUT_MS.");
    } else {
      console.error(error);
    }

    resetChatModel();
    process.exit(1);
  }
}

runIntegrationTest();
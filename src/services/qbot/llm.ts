import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { qbotConfig } from "../../config/qbot.js";
import { ConfigurationError } from "../../lib/errors.js";

let cachedModel: BaseChatModel | null = null;

// Provider-specific construction stays here so the graph and memory layers only
// depend on LangChain's BaseChatModel interface.
export async function getChatModel(): Promise<BaseChatModel> {
  if (cachedModel) return cachedModel;

  const {
    provider,
    apiKey,
    model,
    temperature,
    maxTokens,
    timeoutMs,
    maxRetries,
  } = qbotConfig;

  if (!apiKey) {
    throw new ConfigurationError("Qbot LLM API key is not configured");
  }

  if (provider === "openai") {
    const { ChatOpenAI } = await import("@langchain/openai");
    cachedModel = new ChatOpenAI({
      apiKey,
      model,
      temperature,
      maxTokens,
      timeout: timeoutMs,
      maxRetries,
      streaming: true,
    });
    return cachedModel;
  }

  if (provider === "anthropic") {
    const { ChatAnthropic } = await import("@langchain/anthropic");
    cachedModel = new ChatAnthropic({
      apiKey,
      model,
      temperature,
      maxTokens,
      clientOptions: { timeout: timeoutMs, maxRetries },
      streaming: true,
    });
    return cachedModel;
  }

  if (provider === "openrouter") {
    const { ChatOpenAI } = await import("@langchain/openai");
    cachedModel = new ChatOpenAI({
      apiKey,
      model,
      temperature,
      maxTokens,
      timeout: timeoutMs,
      maxRetries,
      streaming: true,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    });
    return cachedModel;
  }

  if (provider === "deepseek") {
    const { ChatDeepSeek } = await import("@langchain/deepseek");
    cachedModel = new ChatDeepSeek({
      apiKey,
      model,
      temperature,
      maxTokens,
      timeout: timeoutMs,
      maxRetries,
      streaming: true,
    });
    return cachedModel;
  }

  throw new ConfigurationError(`Unsupported Qbot LLM provider: ${provider}`);
}

export function resetChatModel(): void {
  cachedModel = null;
}

import "dotenv/config";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const qbotConfig = {
  provider: process.env.Qbot_LLM_PROVIDER || "openai",
  apiKey: process.env.Qbot_LLM_API_KEY || "",
  model: process.env.Qbot_LLM_MODEL || "gpt-4o",
  temperature: Number.parseFloat(process.env.Qbot_LLM_TEMPERATURE || "0.7"),
  maxTokens: envInt("Qbot_LLM_MAX_TOKENS", 4000),
  timeoutMs: envInt("Qbot_LLM_TIMEOUT_MS", 60_000),
  maxRetries: envInt("Qbot_LLM_MAX_RETRIES", 2),

  // Memory: keep the last N messages verbatim, fold the rest into a rolling summary.
  maxHistoryMessages: envInt("Qbot_MAX_HISTORY_MESSAGES", 20),
  summaryThreshold: envInt("Qbot_SUMMARY_THRESHOLD", 16),
  recentMessagesToKeep: envInt("Qbot_RECENT_MESSAGES_KEEP", 6),

  rateLimit: {
    maxRequests: envInt("Qbot_RATE_LIMIT_MAX", 30),
    windowSec: envInt("Qbot_RATE_LIMIT_WINDOW_SEC", 60),
  },
};

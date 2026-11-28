import "dotenv/config";

export const qbotConfig = {
  provider: process.env.Qbot_LLM_PROVIDER || "openai",
  apiKey: process.env.Qbot_LLM_API_KEY || "",
  model: process.env.Qbot_LLM_MODEL || "gpt-4o",
  temperature: parseFloat(process.env.Qbot_LLM_TEMPERATURE || "0.7"),
  maxTokens: parseInt(process.env.Qbot_LLM_MAX_TOKENS || "4000"),
  
  // Memory configuration
  maxHistoryMessages: 20,
  summaryThreshold: 15, // Summarize when conversation exceeds this many messages
  
  // Rate limiting
  rateLimit: {
    maxRequests: 30,
    windowMs: 60000, // 1 minute
  },
};
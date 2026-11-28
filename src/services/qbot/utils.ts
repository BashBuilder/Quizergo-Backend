import type { MessageContent } from "@langchain/core/messages";

// LLM content can be a plain string or a list of content blocks depending on
// the provider, so normalise it before it is appended to a response.
export function messageText(content: MessageContent | string | null | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("");
}

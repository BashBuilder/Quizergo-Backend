import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import { qbotConfig } from "../../config/qbot.js";
import { InternalServerError, TimeoutError } from "../../lib/errors.js";
import { QBOT_SYSTEM_PROMPT } from "./prompts.js";
import { messageText } from "./utils.js";

export type QbotStreamChunk =
  | { type: "chunk"; content: string; reasoning: string }
  | { type: "complete"; content: string; reasoning: string };

export interface QbotGraphInput {
  conversationId: string;
  summary: string;
  messages: BaseMessage[];
  subject: string;
}

const QbotState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (_previous, next) => next,
    default: () => [],
  }),
  summary: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  subject: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
  conversationId: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => "",
  }),
});

// The graph owns the tutoring turn: it assembles the system prompt, optional
// summary, and recent history, then streams the model's answer. Durable
// messages and summaries live in Postgres; MemorySaver checkpoints the graph
// state per conversation while the process is running.
export class QbotGraph {
  private readonly graph;

  constructor(private readonly model: BaseChatModel) {
    const agent = async (
      state: typeof QbotState.State,
      config?: LangGraphRunnableConfig,
    ) => {
      const prompt: BaseMessage[] = [new SystemMessage(QBOT_SYSTEM_PROMPT)];

      if (state.summary) {
        prompt.push(
          new SystemMessage(
            `Conversation summary so far. Use it to stay consistent with earlier answers:\n${state.summary}`,
          ),
        );
      }

      if (state.subject) {
        prompt.push(
          new SystemMessage(
            `The student is currently studying ${state.subject}. Stay within this subject unless they ask otherwise.`,
          ),
        );
      }

      prompt.push(...state.messages);

      let content = "";
      let reasoning = "";

      try {
        const stream = await this.model.stream(prompt, {
          signal: AbortSignal.timeout(qbotConfig.timeoutMs),
        });

        for await (const chunk of stream) {
          const text = messageText(chunk.content);
          const chunkReasoning = reasoningText(chunk.additional_kwargs);

          if (text) {
            content += text;
            config?.writer?.({
              type: "chunk",
              content: text,
              reasoning: chunkReasoning,
            });
          }

          if (chunkReasoning) reasoning += chunkReasoning;
        }
      } catch (error) {
        throw toQbotError(error);
      }

      if (!content.trim()) {
        throw new InternalServerError("Qbot returned an empty response");
      }

      config?.writer?.({ type: "complete", content, reasoning });
      return { messages: [new AIMessage(content)] };
    };

    this.graph = new StateGraph(QbotState)
      .addNode("agent", agent)
      .addEdge(START, "agent")
      .addEdge("agent", END)
      .compile({ checkpointer: new MemorySaver() });
  }

  async *stream(input: QbotGraphInput): AsyncGenerator<QbotStreamChunk> {
    const stream = await this.graph.stream(input, {
      streamMode: "custom",
      configurable: { thread_id: input.conversationId },
    });

    for await (const chunk of stream) {
      if (isQbotChunk(chunk)) yield chunk;
    }
  }

  async invoke(
    input: QbotGraphInput,
  ): Promise<{ content: string; reasoning: string }> {
    const result = await this.graph.invoke(input, {
      configurable: { thread_id: input.conversationId },
    });

    const last = result.messages[result.messages.length - 1];
    if (!last) {
      throw new InternalServerError("Qbot returned an empty response");
    }

    return { content: messageText(last.content), reasoning: "" };
  }
}

function reasoningText(
  additionalKwargs: Record<string, unknown> | undefined,
): string {
  const value =
    additionalKwargs?.reasoning ?? additionalKwargs?.reasoning_content;
  return typeof value === "string" ? value : "";
}

function isQbotChunk(value: unknown): value is QbotStreamChunk {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return type === "chunk" || type === "complete";
}

function toQbotError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return new TimeoutError(
        "Qbot took too long to respond. Please try again.",
      );
    }
    return error;
  }

  return new InternalServerError("Qbot failed to generate a response");
}

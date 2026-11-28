import { describe, expect, it } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { QbotGraph } from "../src/services/qbot/graph.js";

function createFakeModel() {
  const calls: unknown[][] = [];

  return {
    calls,
    async *stream(messages: unknown[]) {
      calls.push(messages);
      yield { content: "Hello ", additional_kwargs: {} };
      yield { content: "student!", additional_kwargs: {} };
    },
    async invoke() {
      return { content: "The student learned algebra." };
    },
  };
}

describe("Qbot LangGraph orchestration", () => {
  it("streams chunks and assembles the full response", async () => {
    const model = createFakeModel();
    const graph = new QbotGraph(model as never);

    const chunks: Array<{ type: string; content?: string }> = [];
    for await (const chunk of graph.stream({
      conversationId: "conversation-1",
      summary: "The student is learning algebra.",
      messages: [new HumanMessage("What is x?")],
      subject: "",
    })) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => chunk.type)).toEqual([
      "chunk",
      "chunk",
      "complete",
    ]);
    expect(chunks.at(-1)).toMatchObject({
      type: "complete",
      content: "Hello student!",
    });
  });

  it("injects the persisted summary into the model prompt", async () => {
    const model = createFakeModel();
    const graph = new QbotGraph(model as never);

    await graph.invoke({
      conversationId: "conversation-2",
      summary: "The student already solved two linear equations.",
      messages: [new HumanMessage("What next?")],
      subject: "",
    });

    const prompt = model.calls[0] as Array<{
      getType: () => string;
      content: unknown;
    }>;

    expect(prompt[0]?.getType()).toBe("system");
    expect(
      prompt.some(
        (message) =>
          message.getType() === "system" &&
          String(message.content).includes(
            "The student already solved two linear equations.",
          ),
      ),
    ).toBe(true);
  });

  it("returns the full answer for non-streaming callers", async () => {
    const model = createFakeModel();
    const graph = new QbotGraph(model as never);

    const result = await graph.invoke({
      conversationId: "conversation-3",
      summary: "",
      messages: [new HumanMessage("Hello")],
      subject: "",
    });

    expect(result.content).toBe("Hello student!");
  });
});

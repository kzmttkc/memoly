import type { LlmClient } from "./types";

export function createAnthropicClient(apiKey: string, model = "claude-sonnet-4-6"): LlmClient {
  return {
    async completeJson({ system, user, maxTokens = 8000 }) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) {
        throw new Error(`anthropic_${res.status}`);
      }
      const body = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = body.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
      return text;
    },
  };
}

import type { LlmClient } from "./types";

/**
 * 呼び出しの締切（ミリ秒）。**関数の maxDuration より必ず短くすること。**
 *
 * 2026-08-31 の本番障害の原因がここだった:
 *   この fetch にはタイムアウトが無く、max_tokens=8000 の生成が 60 秒を超えると
 *   Vercel の関数上限（app/api/zure/extract/route.ts の maxDuration=60）が先に来て
 *   **504 FUNCTION_INVOCATION_TIMEOUT** になっていた。500バイトの入力でも再現し、
 *   /zure に置いた人全員が「1枚が出ない」状態だった（実測: 61.0s / 60.5s で504）。
 *   route 側には heuristicGapSheet へのフォールバックが書いてあるのに、
 *   **例外が起きる前に関数ごと殺されるので到達しなかった**。
 *   締切を関数上限の半分以下に置き、超えたら例外にしてフォールバックへ渡す。
 */
const LLM_TIMEOUT_MS = 25_000;

export function createAnthropicClient(apiKey: string, model = "claude-sonnet-4-6"): LlmClient {
  return {
    async completeJson({ system, user, maxTokens = 8000 }) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), LLM_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ac.signal,
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
      } catch (e) {
        // AbortError もここに来る。呼び出し側（route.ts）が catch して
        // heuristicGapSheet へ落とすため、**必ず例外にして返す**（握りつぶさない）。
        throw new Error(
          (e as Error)?.name === "AbortError"
            ? `anthropic_timeout_${LLM_TIMEOUT_MS}ms`
            : `anthropic_fetch_failed:${(e as Error)?.message ?? "unknown"}`,
        );
      } finally {
        clearTimeout(timer);
      }
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

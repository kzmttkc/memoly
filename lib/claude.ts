import Anthropic from '@anthropic-ai/sdk'

// ============================================================================
// lib/claude.ts — Anthropic クライアント（就業規則AIの中核依存）
// ----------------------------------------------------------------------------
// 2026-07-30 可用性監査#9 の是正:
//   ここには timeout も maxRetries も指定が無く、SDK 既定（timeout 10分・
//   maxRetries 2）で動いていた。Dify 照会も OpenAI 埋め込みも締切と縮退を持って
//   いるのに、**最も重い中核の呼び出しだけが無防備**という状態だった。
//   最悪ケースは 10分 × (1+2回) で、その間 Vercel の関数枠を1本占有し続ける。
//
//   60秒 × 最大1リトライ（=最長およそ120秒）に絞る。就業規則AIのチャットは
//   ストリーミングで数十秒に収まるのが実測値で、60秒を超えた応答は待たせても
//   価値にならない（利用者はとっくに離脱している）。
//
//   ★呼び出し側の残タスク（このファイルの担当外・別班へ依頼済み）:
//     app/api/company/chat/ に `export const maxDuration = 90` を置き、
//     締切超過（APIConnectionTimeoutError）を捕まえて
//     「時間内に回答を作れませんでした。もう一度お試しください」を返すこと。
//     クライアント側の締切だけだと、関数側が先に切られて無言で落ちる。
// ============================================================================

/** 1回の API 呼び出しの締切（ミリ秒）。 */
export const CLAUDE_TIMEOUT_MS = 60_000

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: CLAUDE_TIMEOUT_MS,
  maxRetries: 1,
})

export const CHAT_MODEL = 'claude-sonnet-4-6'
export const MEMORY_MODEL = 'claude-haiku-4-5-20251001'

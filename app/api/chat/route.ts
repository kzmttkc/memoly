import { NextResponse } from 'next/server'

// ============================================================================
// 【retired】/api/chat — 旧Memoly個人版のAIチャット（恒久リタイア）
//
// このエンドポイントは旧「Memoly」消費者版の残骸だった。個人の記憶
// (memoly_memories) とプロファイル (memoly_profiles) を読み出してシステム
// プロンプトに注入し、Claudeへストリーミングチャットさせていた。現在この
// リポジトリは「番頭」SaaSであり、会社スコープのチャットは /api/company/chat
// が正規に担っている。この個人版は既存ユーザー0（未使用）で、放置すると
// 認証済みユーザーなら誰でも叩けるレート制限付きLLM呼び出し口＝コスト濫用
// および攻撃面として残り続ける。よってメモリ読出/プロファイル読出/LLM
// ストリーミングを全撤去し、常に 410 Gone を返す空エンドポイントにして
// 構造的に無害化する。
// ============================================================================

function gone() {
  return NextResponse.json(
    {
      error: 'Gone',
      detail:
        '/api/chat は廃止されました。番頭のチャットは /api/company/chat を使用してください。',
    },
    { status: 410 }
  )
}

export async function POST() {
  return gone()
}

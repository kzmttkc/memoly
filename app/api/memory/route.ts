import { NextResponse } from 'next/server'

// ============================================================================
// 【retired】/api/memory — 旧Memoly個人版の記憶保存・一覧・削除（恒久リタイア）
//
// このエンドポイントは旧「Memoly」消費者版の残骸だった。会話から抽出した
// 個人の記憶 (memoly_memories) とプロファイル属性 (memoly_profiles) を保存・
// 一覧取得・削除していた。現在このリポジトリは「就業規則AI」SaaSであり、会社
// スコープの記憶は /api/company/memory が正規に担っている。この個人版は
// 既存ユーザー0（未使用）で、放置すると認証済みユーザーの個人データ
// CRUD口として攻撃面が残り続ける。よってメモリ抽出/保存/一覧/削除ロジックを
// 全撤去し、常に 410 Gone を返す空エンドポイントにして構造的に無害化する。
// ============================================================================

function gone() {
  return NextResponse.json(
    {
      error: 'Gone',
      detail:
        '/api/memory は廃止されました。就業規則AIの記憶機能は /api/company/memory を使用してください。',
    },
    { status: 410 }
  )
}

export async function POST() {
  return gone()
}

export async function GET() {
  return gone()
}

export async function DELETE() {
  return gone()
}

import { NextResponse } from 'next/server'

// ============================================================================
// 【retired】/api/report — 旧Memoly個人版の通報受付（恒久リタイア）
//
// このエンドポイントは旧「Memoly」消費者版の残骸だった。ユーザーからの
// 通報内容 (memoly_reports) を認証済みユーザーIDに紐付けて保存していた。
// 現在このリポジトリは「Kabau」SaaSであり、会社スコープの通報は
// /api/company/reports が正規に担っている。この個人版は既存ユーザー0
// （未使用）で、放置すると認証済みユーザーなら誰でも書き込める任意データ
// 挿入口として攻撃面が残り続ける。よって保存ロジックを全撤去し、常に
// 410 Gone を返す空エンドポイントにして構造的に無害化する。
// ============================================================================

function gone() {
  return NextResponse.json(
    {
      error: 'Gone',
      detail:
        '/api/report は廃止されました。Kabauの通報機能は /api/company/reports を使用してください。',
    },
    { status: 410 }
  )
}

export async function POST() {
  return gone()
}

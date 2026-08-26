import { NextResponse } from 'next/server'

// ============================================================================
// 【retired】/api/profile — 旧Memoly個人版のプロファイル更新（恒久リタイア）
//
// このエンドポイントは旧「Memoly」消費者版の残骸だった。個人プロファイル
// 属性 (memoly_profiles) を直接更新していた。現在このリポジトリは「Kabau」
// SaaSであり、会社スコープのプロファイルは /api/company/profile が正規に
// 担っている。この個人版は既存ユーザー0（未使用）で、放置すると認証済み
// ユーザーの個人データ更新口として攻撃面が残り続ける。よって更新ロジックを
// 全撤去し、常に 410 Gone を返す空エンドポイントにして構造的に無害化する。
// ============================================================================

function gone() {
  return NextResponse.json(
    {
      error: 'Gone',
      detail:
        '/api/profile は廃止されました。Kabauのプロファイル機能は /api/company/profile を使用してください。',
    },
    { status: 410 }
  )
}

export async function PATCH() {
  return gone()
}

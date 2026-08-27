import { NextResponse } from 'next/server'

// ============================================================================
// 【retired】/api/digest — 旧Memoly個人版の週次ダイジェスト（恒久リタイア）
//
// このエンドポイントは旧「Memoly」消費者版の残骸だった。ユーザーの記憶内容
// (memoly_memories) を平文で読み出しAIで要約→Memolyブランドのメールとして
// 送信していた。現在このリポジトリは「就業規則AI」SaaSであり、送信元 DIGEST_FROM_EMAIL
// は 4 経路共通の就業規則AIアドレスに切り替わっている。放置すると:
//   - Memoryを引用したMemoly名義のメールが就業規則AIドメインから実ユーザーへ届く
//     ＝ブランド不整合＋個人データの不要な域外送信（漏えいリスク）。
//   - vercel.json の crons には無い(自動発火しない)が、CRON_SECRET を知る者が
//     手動で叩けば実配信できてしまう。
// よって memory 読み出し・AI生成・メール送信を全撤去し、常に 410 Gone を返す
// 空エンドポイントにして構造的に無害化する。就業規則AIの正規ダイジェストは
// /api/company/weekly-email ほか /api/company/* が担う。
// ============================================================================

function gone() {
  return NextResponse.json(
    {
      error: 'Gone',
      detail:
        '/api/digest は廃止されました。就業規則AIのメール配信は /api/company/* を使用してください。',
    },
    { status: 410 }
  )
}

export async function GET() {
  return gone()
}

export async function POST() {
  return gone()
}

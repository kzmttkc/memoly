import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'

// ============================================================================
// /api/company/conversations — 会話の継続性（P1-3）
//   GET ?companyId=...&latest=1
//     指定会社の「直近の会話」1件とそのメッセージ履歴を返す。
//     chat ページのマウント時に呼び、リロード/再訪しても前回の相談の続きから
//     再開できるようにする（保存はされているのに参照UIが無かった問題の解消）。
//
//   認可: getCurrentUser + getMembership（既存ルートと同一の流儀）。
//   読取り: RLS 下の anon(=ユーザーJWT) で引く（company_conversations_member_all /
//           company_messages のメンバー可視ポリシーを尊重。service role は使わない）。
//
//   返却:
//     会話あり: { conversation: { id, title, updatedAt }, messages: [{ role, content }] }
//     会話なし: { conversation: null, messages: [] }（新規状態＝エラーではない）
// ============================================================================

// 復元するメッセージ数の上限。チャットAPI側の文脈も直近50件に切るため、それに揃える
//（無制限に返すと長期会話でペイロードが肥大し、初期表示が重くなる）。
const MAX_RESTORE_MESSAGES = 50

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  // 所属ガード（RLSでも弾かれるが、明示的に403を返す）
  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabaseClient()

  // 直近の会話1件（updated_at はチャットAPIが応答保存のたびに更新している）。
  const { data: conv, error: convErr } = await supabase
    .from('company_conversations')
    .select('id, title, updated_at')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })
  if (!conv) return NextResponse.json({ conversation: null, messages: [] })

  // メッセージ履歴（古い順で表示するため、直近N件を降順で取り reverse する）。
  const { data: msgs, error: msgErr } = await supabase
    .from('company_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(MAX_RESTORE_MESSAGES)

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })

  return NextResponse.json({
    conversation: { id: conv.id, title: conv.title, updatedAt: conv.updated_at },
    messages: (msgs ?? [])
      .reverse()
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  })
}

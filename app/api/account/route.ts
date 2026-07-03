import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Service roleクライアントで全データ削除
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ユーザーデータを全削除（RLSを回避してservice roleで実行）
  await Promise.all([
    admin.from('memoly_memories').delete().eq('user_id', user.id),
    admin.from('memoly_profiles').delete().eq('user_id', user.id),
    admin.from('memoly_messages').delete().in(
      'conversation_id',
      (await admin.from('memoly_conversations').select('id').eq('user_id', user.id)).data?.map(r => r.id) ?? []
    ),
  ])
  await admin.from('memoly_conversations').delete().eq('user_id', user.id)
  await admin.from('memoly_users').delete().eq('id', user.id)

  // 退会後の会社データ残存対策（CTO P2-2）:
  //   番頭(company_*)側は company_id をキーに companies へ CASCADE する設計で、
  //   auth.users への user_id FK を持つのは company_members（ON DELETE CASCADE）と
  //   company_conversations.user_id（ON DELETE SET NULL）のみ。よって auth ユーザー削除で
  //   「この人の席」は自動で消えるが、会社本体と会社スコープの記憶/書類/期限等は残る。
  //   ・他メンバーが残る会社: そのデータは共有資産＝消してはいけない（席だけCASCADEで抜ける）。
  //   ・退会者が最後の1人だった会社: 誰も到達できない孤児テナントになる（課金も操作も不能）。
  //     この会社だけを対象に companies を削除し、company_* 全体を CASCADE で後始末する。
  //   破壊的な会社一括削除はせず「無人になる会社」限定・可逆性を優先した最小掃除。
  try {
    const { data: myMemberships } = await admin
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)

    for (const { company_id } of myMemberships ?? []) {
      // この会社に自分以外のメンバーがいるか（1人でもいれば会社は存続させる）。
      const { count } = await admin
        .from('company_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('company_id', company_id)
        .neq('user_id', user.id)

      if ((count ?? 0) === 0) {
        // 無人になる会社のみ削除。companies → 全 company_* が ON DELETE CASCADE で消える。
        await admin.from('companies').delete().eq('id', company_id)
      }
    }
  } catch (e) {
    // 会社側の掃除に失敗しても auth ユーザー削除は続行する（席は下の deleteUser で
    // CASCADE され、少なくとも「退会者本人の到達性」は必ず断たれる）。孤児会社が残った
    // 場合は後続の掃除SQL(supabase/cleanup_orphan_companies.sql)で冪等に回収できる。
    console.error('[account:delete] company cleanup failed', e)
  }

  // Supabase Authからユーザー削除（残る company_members 席は FK CASCADE で消える）
  await admin.auth.admin.deleteUser(user.id)

  return NextResponse.json({ ok: true })
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 状態（2026-07-04 更新・CMO/CPO 二次評価済み）:
// 現在 Supabase Auth は mailer_autoconfirm=True（Management API で設定）。よって
// signUp は即セッションを返し、signup/page.tsx は data.session 分岐で /company へ
// 直行する＝本ルートは現ハッピーパスでは呼ばれない「休眠フォールバック」。
//
// 2026-07-04 に Resend 独自SMTP を Supabase Auth に配線済み（パスワード再設定リンクは
// 本番ドメイン banto-roumu.com に着地・E2E実証済み）。ただし獲得フェーズでは登録摩擦を
// 避けるため autoconfirm=True を意図的に維持する（北極星＝無料登録）。SMTP を繋いだ
// 実利は「復旧メールの到達」であって、signup 確認クリックの必須化ではない（別の意思決定）。
//
// 本ルートは撤去せず安全網として残す: 将来 autoconfirm=False に切り替えると signup の
// else 分岐が再発火し、既定SMTP依存の確認デッドエンドを本ルートが回避する。通常のメール
// 確認フローへ戻す（＝本ルート撤去）場合は、実 inbox での signup 確認メール着地→リンク先
// ドメイン→session 確立までの本番 E2E をパスさせてから出荷すること（recovery の実証は
// signup 確認テンプレートの到達を保証しない）。
//
// セキュリティ: email を確認済みにするだけでは認証は付与されない（ログインには
// パスワードが必要）。実質 autoconfirm=ON と同じ挙動で、意図どおり。
//
// 無認証の公開エンドポイントなので、素朴な連打を IP+email 単位で弾く
// （leads/route.ts と同じ in-memory スライディングウィンドウ）。目的は service_role
// 書き込み＋listUsers 全ページ走査（登録数に比例）のリソース増幅を抑えること。
// サーバレスではインスタンス毎リセットで厳密でないが、単一インスタンス内の連打は防ぐ。
const RL_WINDOW_MS = 60_000 // 1分窓
const RL_MAX = 5 // 同一 IP+email から1分あたり5回まで
const rlHits = new Map<string, number[]>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const arr = (rlHits.get(key) ?? []).filter((t) => now - t < RL_WINDOW_MS)
  if (arr.length >= RL_MAX) {
    rlHits.set(key, arr)
    return true
  }
  arr.push(now)
  rlHits.set(key, arr)
  if (rlHits.size > 5_000) {
    for (const [k, v] of rlHits) {
      if (v.every((t) => now - t >= RL_WINDOW_MS)) rlHits.delete(k)
    }
  }
  return false
}

export async function POST(req: Request) {
  let email: unknown
  try {
    ({ email } = await req.json())
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 })
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(`${ip}:${email.toLowerCase()}`)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // メールから該当ユーザーを引く。
  //   この auth-js バージョン（2.108.2）に getUserByEmail は無く、listUsers も
  //   email フィルタを持たない（page/perPage のみ）。以前は先頭 200 件しか見ておらず、
  //   登録が 200 を超えると新規 confirm が壊れる時限爆弾だった。
  //   nextPage が尽きるまで全ページを走査して確実に該当ユーザーへ到達する。
  //   （暴走防止に上限ページ数を設ける＝将来の巨大化でも無限ループにしない。）
  const targetEmail = (email as string).toLowerCase()
  const PER_PAGE = 1000 // GoTrue の上限。ページ数=登録数/1000 に抑える。
  const MAX_PAGES = 500 // 安全弁（最大 50 万件相当）。実質到達しない上限。
  let target: { id: string; email_confirmed_at?: string | null } | undefined
  let page = 1
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) {
      return NextResponse.json({ ok: false, reason: 'lookup_failed' }, { status: 500 })
    }
    target = data.users.find((u) => u.email?.toLowerCase() === targetEmail)
    if (target) break
    // Pagination.nextPage が null なら最終ページ＝これ以上のユーザーは無い。
    const nextPage = (data as unknown as { nextPage?: number | null }).nextPage
    if (typeof nextPage !== 'number') break
    page = nextPage
  }
  // メール存在オラクル遮断（CTO P2-1）:
  //   未登録メールに 404{not_found}、既登録に 200{ok} を返すと、無認証の攻撃者が
  //   任意メールを投げて「Kabauに登録済みか」を応答差から列挙できる。
  //   正規フローの唯一の呼び手（signup/page.tsx）は signUp 直後・同一メールで叩き
  //   res.ok しか見ない（reason は参照しない）ため、未登録でも 200{ok:true} を返して
  //   応答を一様化してよい。未登録時は確認処理を何もしないだけで、副作用も情報も出さない。
  if (!target) {
    return NextResponse.json({ ok: true })
  }
  if (target.email_confirmed_at) {
    // 既に確認済みでも、未登録/未確認と同一の {ok:true} を返す。
    //   already:true を出すと「確認済みの登録者」だけ応答本文が変わり、確認済み
    //   アカウントを列挙できる残オラクルになる（呼び手 signup/page.tsx は本フィールドを
    //   参照しないため、落としても正規フローは無退行）。確認処理は不要なので成功応答のみ。
    return NextResponse.json({ ok: true })
  }

  const { error: upErr } = await admin.auth.admin.updateUserById(target.id, {
    email_confirm: true,
  })
  if (upErr) {
    // 内部失敗はログに残すが、対外的には成功と同一応答（存在×成否の差分を出さない）。
    // 呼び手は res.ok の後に signInWithPassword を試み、確認未了なら確認メール待ち画面へ
    // フォールバックするため、ここで 500 を返さなくても正規フローは壊れない。
    console.error('[confirm-signup] updateUserById failed', upErr)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: true })
}

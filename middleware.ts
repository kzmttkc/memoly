import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  type LpVariant,
  VARIANT_KEY,
  VARIANT_COOKIE_MAX_AGE,
  VARIANT_B_RATIO,
  VARIANT_HEADER,
  BOT_UA_RE,
  isLpVariant,
} from './app/business/_lib/variant-shared'

// 認証が必要なパス（未ログインは /login へリダイレクト）
// ※ 旧個人版 /chat・/memory は next.config の redirects で /company へ301済み
//   （redirects は middleware より先に評価されるため、ここには到達しない）。
const PROTECTED_PREFIXES = ['/company']

export async function middleware(req: NextRequest) {
  // ===== /business LP の A/B 変種を SSR 段階で確定する（2026-07-23 A02） =====
  //   従来は SSR 常にA・Bはhydration後差し替えで計測が歪んでいた。ここで着地時に
  //   変種を確定して cookie に固定し、内部ヘッダで page.tsx（サーバー）へ渡す。
  //   既存来訪者は cookie の既存値を維持（比率変更は新規割当のみに効く）。
  //   ボットは cookie を保持せず毎回振れるため、多数派 'B' に固定して
  //   検索スナップショットを安定させる（cookie は発行しない）。
  const reqHeaders = new Headers(req.headers)
  let lpCookieToSet: LpVariant | null = null
  if (req.nextUrl.pathname === '/business') {
    const existing = req.cookies.get(VARIANT_KEY)?.value
    let variant: LpVariant
    if (isLpVariant(existing)) {
      variant = existing
    } else if (BOT_UA_RE.test(req.headers.get('user-agent') ?? '')) {
      variant = 'B'
    } else {
      variant = Math.random() < VARIANT_B_RATIO ? 'B' : 'A'
      lpCookieToSet = variant
    }
    reqHeaders.set(VARIANT_HEADER, variant)
  }

  const res = NextResponse.next({ request: { headers: reqHeaders } })
  if (lpCookieToSet) {
    res.cookies.set(VARIANT_KEY, lpCookieToSet, {
      path: '/',
      maxAge: VARIANT_COOKIE_MAX_AGE,
      sameSite: 'lax',
    })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some(
    p => path === p || path.startsWith(`${p}/`)
  )

  if (isProtected && !user) {
    const loginUrl = new URL('/login', req.url)
    // pathname だけだと ?companyId= 等のクエリが落ち、ログイン後に別会社/別状態へ戻る。
    // クエリごと next に保存する（login 側は相対パスのみ許可＝open redirect 不可）。
    loginUrl.searchParams.set('next', path + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  // 静的アセット・API・画像最適化を除く全パスで実行
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}

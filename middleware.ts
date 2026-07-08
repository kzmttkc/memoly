import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 認証が必要なパス（未ログインは /login へリダイレクト）
// ※ 旧個人版 /chat・/memory は next.config の redirects で /company へ301済み
//   （redirects は middleware より先に評価されるため、ここには到達しない）。
const PROTECTED_PREFIXES = ['/company']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } })

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

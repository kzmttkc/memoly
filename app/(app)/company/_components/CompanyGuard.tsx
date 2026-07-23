'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// ============================================================================
// CompanyGuard — companyId 未指定時の共通ガード。
//   各会社版ページが手書きしていた「会社が指定されていません」表示を一元化する。
//   companyId があれば children をそのまま描画する。
//   （Suspense 境界内で使う前提: useSearchParams を読む。）
//
//   D03(2026-07-23): URL に companyId が無いとき、最後に選択した会社
//   (localStorage 'banto-last-company'・AppShell が保存) があれば、同じパスへ
//   ?companyId= を付けて置換遷移する。URL 指定は常に優先（既存互換）。
//   保存値の会社に所属が無い場合は各 API が 403 を返し、既存のエラーハンドリングに
//   乗る（ここでは所属検証をしない＝最小実装）。
// ============================================================================

const LAST_COMPANY_KEY = 'banto-last-company'

export function CompanyGuard({ children }: { children: React.ReactNode }) {
  const companyId = useSearchParams().get('companyId') ?? ''
  const pathname = usePathname()
  const router = useRouter()
  // 'checking' の間はフォールバック判定中（未指定カードのチラつき防止）。
  const [fallback, setFallback] = useState<'checking' | 'none'>('checking')

  useEffect(() => {
    if (companyId) return
    let stored = ''
    try {
      stored = localStorage.getItem(LAST_COMPANY_KEY) ?? ''
    } catch {
      /* localStorage 不可はフォールバックなし */
    }
    if (stored) {
      router.replace(`${pathname}?companyId=${stored}`)
      return
    }
    // localStorage（外部システム）確認後の一度きりの確定。マウント後にしか読めない
    // （SSRでは localStorage が無い）ため effect 内で確定させる。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFallback('none')
  }, [companyId, pathname, router])

  if (!companyId) {
    // フォールバック確認中は何も出さない（直後に replace されるため）。
    if (fallback === 'checking') return null
    return (
      <Card className="mx-auto max-w-md text-center">
        <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-warning-600" aria-hidden />
        <p className="text-sm text-neutral-700">会社が指定されていません。</p>
        <Link href="/company" className={buttonClass({ variant: 'secondary', className: 'mt-4' })}>
          会社一覧に戻る
        </Link>
      </Card>
    )
  }

  return <>{children}</>
}

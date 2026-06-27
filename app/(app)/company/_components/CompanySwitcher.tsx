'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// ============================================================================
// CompanySwitcher — 顧問先（所属会社）切替セレクタ
//   社労士が顧問先A→Bを画面内で切り替えるための共通コンポーネント。
//   chat/documents/insights/risk の各会社版ページ上部に置く。
//
//   挙動:
//     - /api/company GET で「自分が所属する全会社」を取得（RLS下の可視分のみ）。
//     - 現在の companyId（クエリパラメータ）を選択状態にする。
//     - 別会社を選ぶと、いま開いているパスを維持したまま companyId だけ差し替えて
//       遷移する（router.replace）。各ページは companyId 変化で自動的に再取得する。
//
//   1社しかなければセレクタは出さず会社名のみ表示（社労士でない通常ユーザーの体験を
//   従来どおりに保つ）。所属0社なら何も描画しない（呼び出し側が会社未指定を処理）。
// ============================================================================

interface Membership {
  companyId: string
  role: 'admin' | 'member'
  name: string
  plan: string
  seatsPurchased: number
}

interface Props {
  /** 現在対象の companyId（クエリパラメータ由来） */
  companyId: string
  /**
   * 'header' = AppShell ヘッダ内に置く前提のコンパクト表示（下マージン無し）。
   * 既定(undefined) = ページ内ブロック表示（後方互換）。
   */
  variant?: 'header'
}

export function CompanySwitcher({ companyId, variant }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [companies, setCompanies] = useState<Membership[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/company')
      if (!res.ok) {
        setCompanies([])
        return
      }
      const data = await res.json()
      setCompanies(data.companies ?? [])
    } catch {
      setCompanies([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleChange = useCallback(
    (nextId: string) => {
      if (!nextId || nextId === companyId) return
      // いま開いているパスを維持し companyId だけ差し替える。
      const params = new URLSearchParams(searchParams.toString())
      params.set('companyId', nextId)
      router.replace(`${pathname}?${params.toString()}`)
    },
    [companyId, pathname, router, searchParams],
  )

  // 読み込み中 / 0社 は何も出さない（レイアウトを乱さない）。
  if (companies === null || companies.length === 0) return null

  const current = companies.find(c => c.companyId === companyId)
  const wrap = variant === 'header' ? 'flex items-center gap-2 min-w-0' : 'flex items-center gap-2 mb-4'

  // 1社のみ: 切替不要。会社名のみ静的表示。
  if (companies.length === 1) {
    return (
      <div className={wrap}>
        <span className="shrink-0 text-xs text-neutral-500">対象</span>
        <span className="truncate text-sm font-medium text-neutral-800">
          {current?.name ?? companies[0].name}
        </span>
      </div>
    )
  }

  // 複数社（=顧問先を複数持つ社労士など）: セレクタで切替。
  return (
    <div className={wrap}>
      <label htmlFor="company-switcher" className="shrink-0 text-xs text-neutral-500">
        顧問先
      </label>
      <select
        id="company-switcher"
        value={companyId}
        onChange={e => handleChange(e.target.value)}
        aria-label="対象の顧問先を切り替える"
        className="max-w-[60%] truncate rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      >
        {companies.map(c => (
          <option key={c.companyId} value={c.companyId}>
            {c.name}
            {c.role === 'admin' ? '（管理者）' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

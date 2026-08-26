'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Home, MessageSquareText, FileText, ShieldCheck, Sparkles, BookOpenCheck, History, Plus, Users, CreditCard } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatPill } from '@/components/ui/StatPill'
import { Badge } from '@/components/ui/Badge'
import { track } from '@/lib/analytics'
import { afterCompanyCreateHref } from '@/lib/offer'
import { ingestPendingZure } from '@/lib/zure-pending'
import { resolvePlan, PAID_PLAN_IDS, type PlanId } from '@/lib/plans'
import { localizeError } from './_components/errors'

// ============================================================================
// /company — 会社オンボーディング / ハブ
//   所属会社を /api/company GET で解決し、
//     - 所属あり: 会社カード（相談を主要CTAに、他は二次アクション）+ 状態サマリ
//     - 所属なし: 「会社を作成」フォーム
//   個人版（/chat /memory）は別ルート。ヘッダ/ナビは AppShell が提供する。
// ============================================================================

interface Membership {
  companyId: string
  role: 'admin' | 'member'
  name: string
  plan: string
  seatsPurchased: number
}

interface ProfileSummary {
  count: number
}

export default function CompanyHomePage() {
  // useSearchParams は Suspense 境界を要求する（Next.js app router）。
  // 既存の描画・挙動は CompanyHome にそのまま保持し、境界だけ追加する（additive）。
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyHome />
    </Suspense>
  )
}

function CompanyHome() {
  const searchParams = useSearchParams()
  // Kotri→Kabau hire-bridge の会社名プリフィル。?company=<店名> が有れば会社名欄の初期値に。
  //   ユーザーは編集可能。値が無ければ従来どおり空。過度に長い値は切り詰める。
  //   Reactの標準エスケープに委ねる（dangerouslySetInnerHTML は使わない＝XSS安全）。
  const prefillCompany = (searchParams.get('company') ?? '').trim().slice(0, 100)

  // 無料ツールの「この結果を自社の記録として保存(無料)」の持ち回り終点。
  //   /tools/* → /signup?note=… → /company?note=…（signup の nextDest が持ち回る）。
  //   会社作成時（または既所属なら保存ボタン）に /api/company/memory?action=note で
  //   「会社の記憶」へ保存する＝CTAの約束（保存）を実挙動にする。自動保存はしない。
  const prefillNote = (searchParams.get('note') ?? '').trim().slice(0, 400)

  // 2026-07-26 CTO修正(I3導線バグ): 士業LP CTA(/signup?plan=shigyo)由来の plan を
  //   /company（会社作成画面）まで持ち回り、作成直後の onboarding へも渡す
  //   （signup の nextDest が company/note と同じ流儀で持ち回る・受け皿はここ）。
  const prefillPlan = (() => {
    const raw = (searchParams.get('plan') ?? '').trim()
    return PAID_PLAN_IDS.includes(raw as PlanId) ? (raw as PlanId) : ''
  })()

  const [companies, setCompanies] = useState<Membership[] | null>(null)
  const [summaries, setSummaries] = useState<Record<string, ProfileSummary>>({})
  const [name, setName] = useState(prefillCompany)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteSaved, setNoteSaved] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const router = useRouter()

  // ツール結果を「会社の記憶」へ保存（ベストエフォート・失敗しても本流を壊さない）。
  const saveToolNote = useCallback(
    async (companyId: string): Promise<boolean> => {
      if (!prefillNote) return false
      try {
        const res = await fetch('/api/company/memory?action=note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, text: prefillNote }),
        })
        if (res.ok) {
          // 計測: ツール→signup→保存 の一気通貫が実際に完了した数（A5の成否指標）。PIIなし。
          track('tool_result_saved')
          return true
        }
      } catch {
        /* 保存失敗は本流（会社作成・遷移）に影響させない */
      }
      return false
    },
    [prefillNote],
  )

  // 実フェッチ。setState は await 後の解決時のみ行う（effect 同期setStateを避ける）。
  //   ignore: アンマウント/再フェッチ時の遅延レスポンス取り込みを防ぐ。
  const load = useCallback(
    async (ignore?: () => boolean) => {
      try {
        const res = await fetch('/api/company')
        if (ignore?.()) return
        if (res.status === 401) {
          router.push('/login?next=/company')
          return
        }
        const data = await res.json()
        const list: Membership[] = data.companies ?? []
        if (ignore?.()) return
        setCompanies(list)
        if (list[0]) {
          const saved = await ingestPendingZure(list[0].companyId)
          if (saved) {
            router.push(afterCompanyCreateHref(list[0].companyId))
            return
          }
        }
        // 各社の自社ルール件数を取得（状態サマリ用・ベストエフォート）。
        const entries = await Promise.all(
          list.map(async c => {
            try {
              const r = await fetch(`/api/company/profile?companyId=${c.companyId}`)
              if (!r.ok) return [c.companyId, { count: 0 }] as const
              const d = await r.json()
              return [c.companyId, { count: (d.profiles ?? []).length }] as const
            } catch {
              return [c.companyId, { count: 0 }] as const
            }
          }),
        )
        if (ignore?.()) return
        setSummaries(Object.fromEntries(entries))
      } catch {
        if (ignore?.()) return
        setError('読み込みに失敗しました。通信を確認してください。')
        setCompanies([])
      }
    },
    [router],
  )

  useEffect(() => {
    let cancelled = false
    // load は setState を await 後（外部システム=API応答の同期）にのみ呼ぶ。
    // 同期的な setState ではないが react-hooks ルールが関数呼出しを一律警告するため抑止。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  async function createCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      // セッション切れ（401）は再ログインへ誘導（生英語エラーを画面に出さない）。
      if (res.status === 401) {
        router.push('/login?next=/company')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(localizeError(data.error, '会社の作成に失敗しました'))
        return
      }
      // 活性化ファネル: 会社作成の確定（登録→会社作成の到達を可視化）。
      // POST 成功(res.ok)を確認した後にのみ発火＝失敗と取り違えない。PIIは載せない。
      track('company_created')
      setName('')
      // 作成直後は「5問 構造化ウィザード」へ誘導（集合知の正規化属性を取る入口）。
      //   スキップ可。companyId が取れない場合のみ一覧再読込にフォールバック。
      const newId = data.company?.companyId
      if (newId) {
        // ツール結果の持ち回りがあれば、作った会社の「記憶」へ保存してから進む
        // （保存CTAの約束を実挙動に。失敗しても遷移は止めない）。
        if (prefillNote) await saveToolNote(newId)
        await ingestPendingZure(newId)
        const next = afterCompanyCreateHref(newId)
        router.push(prefillPlan ? `${next}&plan=${prefillPlan}` : next)
        return
      }
      await load()
    } catch {
      setError('会社の作成に失敗しました。通信を確認してください。')
    } finally {
      setCreating(false)
    }
  }

  if (companies === null) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>
  }

  // ---- 未所属: 会社作成フォーム ----
  if (companies.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="会社を作成"
          description="会社名のあとに、就業規則のファイルを置けます。ずれの1枚が出ます。相談はそのあとです。"
        />
        {/* ツール結果の持ち回りがある場合の踏み板: 保存の約束がここで果たされることを明示 */}
        {prefillNote && (
          <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 text-sm leading-relaxed text-neutral-700">
            <p>会社を作成すると、さきほどの無料ツールの点検結果を「会社の記憶」として保存します。</p>
            <p className="mt-1 text-xs text-neutral-500">{prefillNote}</p>
          </div>
        )}
        <Card>
          <form onSubmit={createCompany} className="space-y-4">
            <div>
              <label htmlFor="company-name" className="mb-1.5 block text-sm font-medium text-neutral-700">
                会社名
              </label>
              <Input
                id="company-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例：KIZUNAクリエーション株式会社"
                maxLength={100}
              />
            </div>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" size="lg" disabled={creating || !name.trim()} className="w-full">
              {creating ? '作成中...' : '会社を作成してファイルを置く'}
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  // ---- 所属あり: 会社カード ----
  const multi = companies.length > 1
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={multi ? '顧問先・管理中の会社' : 'あなたの会社'}
        description={
          multi
            ? `${companies.length}社を管理しています。セキュリティとプライバシーを第一として企業ごとに自社ルールと記憶が分かれているため、顧問先を切り替えても相談内容が混ざりません。`
            : '会社カードから、就業規則のファイルを置けます。'
        }
      />
      {error && <p className="mb-4 text-sm text-danger-600">{error}</p>}

      {/* ツール結果の持ち回りがある場合（既に会社所属あり）: 明示ボタンで保存する。
          自動保存しない（誤記憶防止・decision と同じ human-in-the-loop の流儀）。 */}
      {prefillNote && (
        <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 text-sm leading-relaxed text-neutral-700">
          {noteSaved ? (
            <p className="text-success-700">点検結果を「{companies[0].name}」の会社の記憶に保存しました。</p>
          ) : (
            <>
              <p>さきほどの無料ツールの点検結果を「会社の記憶」として保存できます。</p>
              <p className="mt-1 text-xs text-neutral-500">{prefillNote}</p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={noteSaving}
                onClick={async () => {
                  setNoteSaving(true)
                  const ok = await saveToolNote(companies[0].companyId)
                  setNoteSaving(false)
                  if (ok) setNoteSaved(true)
                  else setError('点検結果の保存に失敗しました。時間をおいてお試しください。')
                }}
              >
                {noteSaving ? '保存中...' : `「${companies[0].name}」に保存する`}
              </Button>
            </>
          )}
        </div>
      )}

      <div className="space-y-4">
        {companies.map(c => {
          const ruleCount = summaries[c.companyId]?.count
          return (
            <Card key={c.companyId} interactive>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-neutral-900">{c.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={c.role === 'admin' ? 'brand' : 'neutral'}>
                      {c.role === 'admin' ? '管理者' : 'メンバー'}
                    </Badge>
                    <StatPill label="席" value={c.seatsPurchased} icon={<Users className="h-3.5 w-3.5" />} />
                    {ruleCount !== undefined && (
                      <StatPill
                        label="自社ルール"
                        value={ruleCount}
                        icon={<BookOpenCheck className="h-3.5 w-3.5" />}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 情報設計(Vercel流): 主アクション(brand塗り・全幅)を1つ際立たせ、
                  二次アクションは均等タイルのグリッドで縦横に整列させ視線を直線化する。
                  主要導線は「会社のホーム」＝今週の能動フィード（戻る理由が届く起点）に倒す。 */}
              <Link
                href={`/company/documents?companyId=${c.companyId}`}
                className={buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' })}
              >
                <FileText className="h-4 w-4" aria-hidden />
                就業規則のファイルを置く
              </Link>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { href: '/company/home', label: '会社のホーム', icon: Home },
                  { href: '/company/chat', label: '相談（ファイルの後）', icon: MessageSquareText },
                  { href: '/company/memory', label: '会社の記憶', icon: History },
                  { href: '/company/documents', label: '書類作成・レビュー', icon: FileText },
                  { href: '/company/risk', label: '労務リスク・セルフ診断', icon: ShieldCheck },
                  { href: '/company/insights', label: '助成金・法改正', icon: Sparkles },
                  ...(c.role === 'admin'
                    ? [{ href: '/company/rules', label: '自社ルールを編集', icon: BookOpenCheck }]
                    : []),
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={`${href}?companyId=${c.companyId}`}
                    className={buttonClass({
                      variant: 'secondary',
                      className: 'h-auto flex-col items-start gap-2 px-3.5 py-3 text-left',
                    })}
                  >
                    <Icon className="h-4.5 w-4.5 text-brand-600" aria-hidden />
                    <span className="text-sm font-medium leading-tight">{label}</span>
                  </Link>
                ))}
              </div>

              {ruleCount === 0 && (
                <p className="mt-4 rounded-lg border border-warning-500/30 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                  相談の前に、就業規則のファイルを書類へ置いてください。
                </p>
              )}
            </Card>
          )
        })}

        {/* 顧問先を追加（社労士が複数クライアントを管理する導線）。
            収益ゲート: free/starter/standard は自社1社まで。2社目以降は士業プランが必要
            （サーバ側 POST /api/company が最終的な enforcement。ここは案内と誤操作抑止）。
            許容量の判定はサーバの canCreateAnotherCompany と同じ式（所属会社の最大 maxCompanies）。 */}
        <details className="rounded-2xl border border-neutral-200 bg-white p-5">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-neutral-700 transition-colors hover:text-brand-700">
            <Plus className="h-4 w-4" aria-hidden />
            別の会社（顧問先）を追加する
          </summary>
          {companies.length <
          Math.max(1, ...companies.map(c => resolvePlan(c.plan).maxCompanies)) ? (
            <>
              <p className="mb-3 mt-3 text-xs leading-relaxed text-neutral-500">
                追加した会社はあなたが管理者になり、独立した自社ルールと記憶を持ちます。
              </p>
              <form onSubmit={createCompany} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例：株式会社サンプル"
                  maxLength={100}
                  aria-label="追加する会社名"
                />
                <Button type="submit" disabled={creating || !name.trim()} className="sm:w-auto">
                  {creating ? '追加中...' : '会社を追加'}
                </Button>
              </form>
            </>
          ) : (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-3 text-xs leading-relaxed text-neutral-700">
              <p>
                複数の会社（顧問先）を切り替えて管理するには、士業プランが必要です。士業プランでは顧問先ごとに自社ルールと記憶が分かれ、切り替えても相談内容が混ざりません。
              </p>
              <Link
                href={`/company/billing?companyId=${companies[0].companyId}`}
                className={buttonClass({ variant: 'secondary', className: 'mt-3' })}
              >
                <CreditCard className="h-4 w-4" aria-hidden />
                プランを確認する
              </Link>
            </div>
          )}
        </details>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, MessageSquareText, FileText, ShieldCheck, Sparkles, BookOpenCheck, History, Plus, Users } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatPill } from '@/components/ui/StatPill'
import { Badge } from '@/components/ui/Badge'

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
  const [companies, setCompanies] = useState<Membership[] | null>(null)
  const [summaries, setSummaries] = useState<Record<string, ProfileSummary>>({})
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '会社の作成に失敗しました')
        return
      }
      setName('')
      // 作成直後は「5問 構造化ウィザード」へ誘導（集合知の正規化属性を取る入口）。
      //   スキップ可。companyId が取れない場合のみ一覧再読込にフォールバック。
      const newId = data.company?.companyId
      if (newId) {
        router.push(`/company/onboarding?companyId=${newId}`)
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
          description="会社を登録すると、自社の労務ルール（所定労働時間・36協定の状況など）をAIに覚えさせて、自社の前提に沿った相談が可能に。人事・労務の作業を圧倒的に効率化できます。"
        />
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
              {creating ? '作成中...' : '会社を作成して始める'}
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
            : '会社カードから相談・書類作成・診断に進めます。'
        }
      />
      {error && <p className="mb-4 text-sm text-danger-600">{error}</p>}

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

              {/* 主要アクション(brand塗り)を1つ際立たせ、他は二次アクション(outline)。
                  主要導線は「会社のホーム」＝今週の能動フィード（戻る理由が届く起点）に倒す。 */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/company/home?companyId=${c.companyId}`}
                  className={buttonClass({ variant: 'primary' })}
                >
                  <Home className="h-4 w-4" aria-hidden />
                  会社のホームを開く
                </Link>
                <Link
                  href={`/company/chat?companyId=${c.companyId}`}
                  className={buttonClass({ variant: 'secondary' })}
                >
                  <MessageSquareText className="h-4 w-4" aria-hidden />
                  AIに相談する
                </Link>
                <Link
                  href={`/company/memory?companyId=${c.companyId}`}
                  className={buttonClass({ variant: 'secondary' })}
                >
                  <History className="h-4 w-4" aria-hidden />
                  会社の記憶
                </Link>
                <Link
                  href={`/company/documents?companyId=${c.companyId}`}
                  className={buttonClass({ variant: 'secondary' })}
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  書類作成・レビュー
                </Link>
                <Link
                  href={`/company/risk?companyId=${c.companyId}`}
                  className={buttonClass({ variant: 'secondary' })}
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  労務リスク診断
                </Link>
                <Link
                  href={`/company/insights?companyId=${c.companyId}`}
                  className={buttonClass({ variant: 'secondary' })}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  助成金・法改正
                </Link>
                {c.role === 'admin' && (
                  <Link
                    href={`/company/rules?companyId=${c.companyId}`}
                    className={buttonClass({ variant: 'ghost' })}
                  >
                    <BookOpenCheck className="h-4 w-4" aria-hidden />
                    自社ルールを編集
                  </Link>
                )}
              </div>

              {ruleCount === 0 && (
                <p className="mt-4 rounded-lg border border-warning-500/30 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                  まだ自社ルールが未登録です。相談の精度を上げるため、まず「自社ルールを編集」から数件登録するのがおすすめです。
                </p>
              )}
            </Card>
          )
        })}

        {/* 顧問先を追加（社労士が複数クライアントを管理する導線） */}
        <details className="rounded-2xl border border-neutral-200 bg-white p-5">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-neutral-700 transition-colors hover:text-brand-700">
            <Plus className="h-4 w-4" aria-hidden />
            別の会社（顧問先）を追加する
          </summary>
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
        </details>
      </div>
    </div>
  )
}

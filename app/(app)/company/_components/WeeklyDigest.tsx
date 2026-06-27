'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'
import {
  Scale,
  Banknote,
  CalendarClock,
  ArrowRight,
  BookOpenCheck,
  RefreshCw,
  TrendingDown,
  Gavel,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'

// ============================================================================
// WeeklyDigest — 「今週、自社に関係する変更」アプリ内能動フィード（常設）。
//   /api/company/digest（会社×週キャッシュ・lazy生成）を起点に、自社プロファイルへ
//   照らして対象になりうる法改正・助成金カードを能動表示する（受け身→能動の起点）。
//
//   各カード = (1)見出し (2)自社の場合どうなるか (3)次のアクション (4)期日バッジ(あれば)
//   ＋確定度ラベル＋連結ボタン（規程ドラフト/相談/詳しく診断）。診断→起草の連結が独自価値。
//
//   空状態(TTV): profileEmpty なら「まず自社のことを教えてください」CTA一本に倒す。
//   デザイン: ライト基調・brandトークン・components/ui・生カラー不使用。
// ============================================================================

interface DigestCard {
  kind: 'lawChange' | 'subsidy' | 'riskAlert' | 'decisionReview'
  title: string
  selfImpact: string
  nextAction: string
  deadline?: string
  confidence: '参考情報' | '一次回答（要確認）'
  actionTo: 'document' | 'chat' | 'insights' | 'risk'
  actionLabel: string
  chatPrompt?: string
}

interface DigestResponse {
  profileEmpty: boolean
  profileCount?: number
  cards?: DigestCard[]
  cached?: boolean
  disclaimer?: string
  humanReview?: string
  error?: string
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | {
      status: 'ready'
      cards: DigestCard[]
      disclaimer: string
      humanReview: string
    }

export function WeeklyDigest({ companyId }: { companyId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  // 同一フィードの再描画で digest_card_shown を二重計上しないためのガード（companyId単位）。
  const shownRef = useRef<string | null>(null)

  // 実フェッチ。setState は await 後の解決時のみ行う（effect 同期setStateを避ける）。
  //   ignore: アンマウント/companyId変更時の遅延レスポンス取り込みを防ぐ。
  const fetchDigest = useCallback(
    async (ignore?: () => boolean) => {
      try {
        const res = await fetch('/api/company/digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId }),
        })
        const data: DigestResponse = await res.json().catch(() => ({ profileEmpty: false }))
        if (ignore?.()) return
        if (!res.ok) {
          setState({ status: 'error', message: data.error ?? '取得に失敗しました' })
          return
        }
        if (data.profileEmpty) {
          setState({ status: 'empty' })
          return
        }
        setState({
          status: 'ready',
          cards: data.cards ?? [],
          disclaimer: data.disclaimer ?? '',
          humanReview: data.humanReview ?? '',
        })
      } catch {
        if (ignore?.()) return
        setState({ status: 'error', message: '取得に失敗しました。通信を確認してください。' })
      }
    },
    [companyId],
  )

  // 手動再読込（エラー時）。ここではユーザー操作起点なので loading への遷移はOK。
  const reload = useCallback(() => {
    setState({ status: 'loading' })
    void fetchDigest()
  }, [fetchDigest])

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    // fetchDigest は setState を await 後（外部システム=API応答の同期）にのみ呼ぶ。
    // 同期的な setState ではないが react-hooks ルールが関数呼出しを一律警告するため抑止。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDigest(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [companyId, fetchDigest])

  // 計測: 能動アラート（riskAlert / decisionReview）が描画された時に kind 別で1回ずつ発火。
  //   props は kind の列挙値のみ＝非PII。同一 companyId のフィードでは一度だけ計上する。
  useEffect(() => {
    if (state.status !== 'ready') return
    if (shownRef.current === companyId) return
    shownRef.current = companyId
    for (const c of state.cards) {
      if (c.kind === 'riskAlert' || c.kind === 'decisionReview') {
        track('digest_card_shown', { kind: c.kind })
      }
    }
  }, [state, companyId])

  return (
    <section aria-label="今週、自社に関係する変更">
      <div className="mb-1 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-brand-600" aria-hidden />
        <h2 className="text-lg font-semibold text-neutral-900">今週、自社に関係する変更</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-neutral-500">
        登録済みの自社プロファイルに照らして、対象になりうる法改正・助成金だけを自動でお届けします。
      </p>

      {state.status === 'loading' && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map(i => (
            <Card key={i} className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-full animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
            </Card>
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <Card className="space-y-3 text-center">
          <p className="text-sm text-neutral-700">{state.message}</p>
          <button type="button" onClick={reload} className={buttonClass({ variant: 'secondary' })}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            再読み込み
          </button>
        </Card>
      )}

      {/* 空状態(TTV): 主要アクション1つ（自社ルール登録）に倒す。 */}
      {state.status === 'empty' && (
        <Card className="space-y-3 text-center">
          <BookOpenCheck className="mx-auto h-6 w-6 text-brand-600" aria-hidden />
          <p className="text-sm font-medium text-neutral-900">まず自社のことを教えてください</p>
          <p className="text-xs leading-relaxed text-neutral-500">
            業種や従業員数などの自社プロファイルを登録すると、自社に関係する変更だけを自動で抽出してお届けできます。
          </p>
          <Link
            href={`/company/rules?companyId=${companyId}`}
            className={buttonClass({ variant: 'primary' })}
          >
            自社ルールを登録する
          </Link>
        </Card>
      )}

      {state.status === 'ready' && state.cards.length === 0 && (
        <Card>
          <p className="text-sm text-neutral-600">
            今週、自社に直接関係しそうな新しい変更は見つかりませんでした。自社ルールを増やすと精度が上がります。
          </p>
        </Card>
      )}

      {state.status === 'ready' && state.cards.length > 0 && (
        <div className="space-y-3">
          {state.cards.map((c, i) => (
            <DigestCardItem key={i} card={c} companyId={companyId} />
          ))}
        </div>
      )}

      {state.status === 'ready' && (state.disclaimer || state.humanReview) && (
        <div className="mt-4 space-y-1 border-t border-neutral-200 pt-4">
          {state.humanReview && (
            <p className="text-xs leading-relaxed text-neutral-500">{state.humanReview}</p>
          )}
          {state.disclaimer && (
            <p className="text-xs leading-relaxed text-neutral-500">{state.disclaimer}</p>
          )}
        </div>
      )}
    </section>
  )
}

// カード種別ごとの表示メタ（アイコン・バッジ文言・バッジトーン）。
//   riskAlert/decisionReview は「自分ごと度が高い能動アラート」＝注意トーンで強調する。
const KIND_META: Record<
  DigestCard['kind'],
  { Icon: typeof Scale; label: string; tone: 'info' | 'brand' | 'warning' | 'danger' }
> = {
  lawChange: { Icon: Scale, label: '法改正', tone: 'info' },
  subsidy: { Icon: Banknote, label: '助成金', tone: 'brand' },
  riskAlert: { Icon: TrendingDown, label: 'リスク悪化', tone: 'danger' },
  decisionReview: { Icon: Gavel, label: '判断の確認', tone: 'warning' },
}

function DigestCardItem({ card, companyId }: { card: DigestCard; companyId: string }) {
  const meta = KIND_META[card.kind]
  const Icon = meta.Icon

  // 連結先 URL（companyId を必ず引き継ぐ。chat はプリフィル質問を q= で渡す＝診断→相談連結）。
  const path = card.actionTo === 'document' ? 'documents' : card.actionTo
  let href = `/company/${path}?companyId=${companyId}`
  if (card.actionTo === 'chat' && card.chatPrompt) {
    href += `&q=${encodeURIComponent(card.chatPrompt)}`
  }

  return (
    <Card interactive className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-600" aria-hidden />
          <p className="text-sm font-semibold text-neutral-900">{card.title}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {card.deadline && (
            <Badge tone="warning">
              <CalendarClock className="h-3 w-3" aria-hidden />
              {card.deadline}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-neutral-900">
        <span className="text-neutral-500">自社の場合：</span>
        {card.selfImpact}
      </p>

      {card.nextAction && (
        <p className="text-sm leading-relaxed text-neutral-600">
          <span className="text-neutral-500">次の一歩：</span>
          {card.nextAction}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <Badge tone="neutral">{card.confidence}</Badge>
        <Link href={href} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          {card.actionLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Card>
  )
}

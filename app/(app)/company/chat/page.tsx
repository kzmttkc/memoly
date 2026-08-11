'use client'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, Building2, Send, BookmarkPlus, Check, X, LogIn, MessageSquarePlus, FileText, ScrollText, History, CalendarClock, FileBarChart, CreditCard, Receipt, Mail } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { Toast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { MarkdownMessage } from '@/components/ui/MarkdownMessage'
import { Button, buttonClass } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { detectDecisionSignal } from '@/lib/decision-detect'
import type { RecalledMemory } from '@/lib/recall'
import type { CompanyAttributesRow } from '@/lib/company-attributes'
import { INDUSTRY_MAJORS } from '@/lib/company-attributes'
import { track } from '@/lib/analytics'
import { useLocale, t } from '@/lib/locale'
import { CompanySwitcher } from '../_components/CompanySwitcher'
import { CompanyGuard } from '../_components/CompanyGuard'
import { PLANS } from '@/lib/plans'

// ============================================================================
// /company/chat — 会社スコープのチャット
//   常時表示: 「この会社専用」バッジ + 「参照中の自社ルールn件」（混線しない安心感）。
//   ?q= で初期質問を受け取り自動送信（リスク診断からの「この内容で相談」導線）。
//   POST /api/company/chat に { messages, companyId } を投げ、ストリーム表示。
//   一定往復ごとに /api/company/memory で自社事実の抽出を起動。
// ============================================================================

interface Message {
  role: 'user' | 'assistant'
  content: string
  isTyping?: boolean
  // 記憶想起の可視化: この回答を作るのに番頭が参照した「自社の記憶」の非PIIサマリ。
  //   サーバの X-Recalled-Memory ヘッダ由来。assistant メッセージにだけ付く。
  recalled?: RecalledMemory
}

// 「この相談で参照した自社の記憶」パネル。番頭の核＝“覚えていて踏まえて答える”を、
//   回答のたびに可視化する（革新性の体感化）。氏名等は載せず分類ラベルと件数のみ。
//   D06(2026-07-23): 既定で開いた状態にする（「覚えている」実感を毎回目に入れる。
//   ユーザーは従来どおり折りたためる）。
function RecallPanel({ recalled, companyId }: { recalled: RecalledMemory; companyId: string }) {
  const kindMeta = {
    profile: { icon: BookOpenCheck, label: '自社ルール' },
    rule: { icon: ScrollText, label: '規程' },
    decision: { icon: History, label: '過去の判断' },
  } as const
  // D25: 同一トピックの再相談で過去の判断（decision）を参照したときは、
  //   「前回の結論」を冒頭に固定表示する（記憶検索の既存機構＝recalled をそのまま使う）。
  const decisionItems = recalled.items.filter(it => it.kind === 'decision')
  return (
    <details open className="mb-1.5 rounded-xl border border-brand-100 bg-brand-50/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <BantoMark className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
        この相談で参照した自社の記憶
        <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] tabular-nums text-brand-700">
          {recalled.profileCount + recalled.decisionCount + recalled.ruleDocCount + recalled.memoryCount}件
        </span>
        {recalled.semantic && (
          <span className="ml-auto rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-700">
            意味検索
          </span>
        )}
      </summary>
      <div className="space-y-2 px-3 pb-3 pt-1">
        {/* D25: 前回の結論の冒頭固定表示（過去の判断を参照した回答のときだけ）。 */}
        {decisionItems.length > 0 && (
          <p className="rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[11px] leading-relaxed text-neutral-800">
            <span className="font-semibold text-brand-700">前回の結論があります：</span>
            {decisionItems.map(it => it.label).join('／')}
            <Link
              href={`/company/memory?companyId=${companyId}`}
              className="ml-1.5 text-brand-600 underline-offset-2 hover:underline"
            >
              会社の記憶で確認
            </Link>
          </p>
        )}
        {recalled.items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recalled.items.map((it, idx) => {
              const meta = kindMeta[it.kind]
              const Icon = meta.icon
              const date = it.at ? new Date(it.at).toLocaleDateString('ja-JP') : null
              return (
                <span
                  key={`${it.kind}-${idx}`}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700"
                  title={meta.label}
                >
                  <Icon className="h-3 w-3 shrink-0 text-brand-500" aria-hidden />
                  <span className="max-w-[12rem] truncate">{it.label}</span>
                  {date && <span className="text-neutral-400 tabular-nums">{date}</span>}
                </span>
              )
            })}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-brand-700/80">
          自社ルール{recalled.profileCount}件・過去の相談{recalled.memoryCount}件・過去の判断
          {recalled.decisionCount}件
          {recalled.ruleDocCount > 0 ? `・規程${recalled.ruleDocCount}本` : ''}
          を踏まえて答えています。
        </p>
      </div>
    </details>
  )
}

const ONBOARDING_MESSAGE: Message = {
  role: 'assistant',
  content:
    'こんにちは。この会社専用の労務AIです。登録された自社ルール（所定労働時間・36協定の状況など）を前提に相談に答えます。\n\nまず、いま気になっている労務の疑問を教えてください。',
}

const SAMPLE_PROMPTS = [
  '残業代の割増率は自社だとどうなる？',
  '有給の付与日数を確認したい',
  '36協定が未締結だと何が問題？',
  '今月の給与計算で気をつける点は？',
]

// サンプル質問のオンボ回答連動（UX-2）: company_attributes（オンボ5問の回答）から
// 「この会社がいま一番つまずきやすい質問」を決定的に組み立てる。
//   LLM 非依存・分岐は attributes の値のみ＝毎回同じ入力なら同じ4問（チラつかない）。
//   attributes 未登録/取得失敗時は呼び出し側で固定4問（SAMPLE_PROMPTS）にフォールバック。
function buildSamplePrompts(attrs: CompanyAttributesRow): string[] {
  const prompts: string[] = []
  // 36協定が「ない/不明」は放置リスクが最大級 → 必ず先頭に置く。
  if (attrs.has_36kyotei !== true) {
    prompts.push('36協定を結んでいない場合、何が問題になりますか？')
  }
  if (attrs.has_fixed_ot === true) {
    prompts.push('固定残業代の運用で気をつける点は？')
  }
  // 10人未満なら「就業規則の作成義務はどこから？」が定番のつまずき。
  if (attrs.employee_band === '1-4' || attrs.employee_band === '5-9') {
    prompts.push('従業員10人未満でも就業規則は必要？')
  } else if (attrs.has_work_rules === false) {
    prompts.push('就業規則を作るには何から始めればいい？')
  }
  // 残り枠は固定4問から補充（36協定の重複だけ除外＝同テーマが2枚並ぶのを防ぐ）。
  for (const p of SAMPLE_PROMPTS) {
    if (prompts.length >= 4) break
    if (p.includes('36協定') && prompts.some(q => q.includes('36協定'))) continue
    prompts.push(p)
  }
  return prompts.slice(0, 4)
}

// 自社プロファイル要約ミニバー（G-c）: company_attributes（オンボ5問）を1行の要約にする。
//   「番頭はこの前提で答えます」の安心感＝混線しない・毎回説明し直さなくてよい、の可視化。
//   決定的（LLM非依存）・未回答(null)の項目は出さない（「不明」を並べて不安を煽らない）。
//   注: 締め日は company_attributes に存在しないため、業種・人数・制度3項目で構成する。
const EMPLOYEE_BAND_LABELS: Record<string, string> = {
  '1-4': '従業員1〜4人',
  '5-9': '従業員5〜9人',
  '10-29': '従業員10〜29人',
  '30-49': '従業員30〜49人',
  '50-99': '従業員50〜99人',
  '100+': '従業員100人以上',
}

function buildProfileSummary(attrs: CompanyAttributesRow): string[] {
  const parts: string[] = []
  const industry = INDUSTRY_MAJORS.find(i => i.code === attrs.industry_major)
  if (industry) parts.push(industry.label)
  if (attrs.employee_band && EMPLOYEE_BAND_LABELS[attrs.employee_band]) {
    parts.push(EMPLOYEE_BAND_LABELS[attrs.employee_band])
  }
  if (attrs.has_36kyotei !== null) parts.push(`36協定${attrs.has_36kyotei ? 'あり' : 'なし'}`)
  if (attrs.has_work_rules !== null) parts.push(`就業規則${attrs.has_work_rules ? 'あり' : 'なし'}`)
  if (attrs.has_fixed_ot !== null) parts.push(`固定残業代${attrs.has_fixed_ot ? 'あり' : 'なし'}`)
  return parts
}

// 文脈アクションチップ（UX-4）: 回答に規程系の語が含まれるときだけ「規程ドラフトの下書き」
// へ連結する判定。lib/digest.ts toCards の draftable 判定と同じ発想
// （あちらは非exportのローカル定義のため、こちらも指示された4語でローカル定義）。
const DRAFTABLE_RE = /就業規則|規程|36協定|労使協定/

// I08(2026-07-23): 回答が断定を避けている（AIだけでは判断しきれない）ときの検出。
//   このときは「社労士に相談する下準備メモ」への導線を強調して、次の一歩を標準化する。
//   Phase1コンプラ: 番頭が専門家を仲介する表現は使わない（メモを作って自分で相談に行く導線）。
const UNCERTAIN_RE =
  /断定できません|判断が分かれ|個別の事情|個別の判断|専門家|社労士[にへ]|労働基準監督署に確認|確認をおすすめ/

// P01/P07(2026-07-24): 回答が「自社の規程・情報が未登録なので分からない」と述べたとき、
//   その場から規程を覚えさせる入口（/company/rules）を出す。番頭の看板「会社を覚える」の
//   価値が、まさに情報が無い瞬間に一歩で回収できるようにする。system プロンプトが未登録時に
//   使う定型（「登録されていません」「番頭に伝えて登録」「取込済みの範囲では見当たりません」等）
//   に一致する語で検出する。
const TEACH_RULES_RE =
  /登録されていません|登録されていない|未登録|取込済みの範囲では見当たりません|番頭に(?:伝えて|覚え)|覚えさせ|登録していただく|登録すると次回/

// I2(2026-07-24): 課金/解約/退会など「番頭の労務スコープ外」の質問を検知する。
//   従来はチャットAIが「専用の労務AIなので案内できません」と導線ゼロで門前払いしていた
//   （答えは /tokushoho・/company/billing・サポート窓口に実在するのに製品外へ放り出す＝P05/P09）。
//   検知したらAPIを呼ばず、定型の敬体案内＋各ページ/窓口への導線カードを返す。
//   ★労務相談語（賃金の支払い・退職・保険の解約 等）と衝突しない語だけを対象にする。
//     「支払い方法」「月給」「退職」等は労務側なので入れない。誤検知時もカードに
//     「労務のご相談でしたら、もう一度具体的にご質問ください」を添えて回復可能にする。
const BILLING_INTENT_RE =
  /課金|解約|退会|無料期間|無料モニター|サブスク|サブスクリプション|トライアル|有料プラン|料金プラン|プラン変更|クレジットカード|請求書|いくらかかり|料金はいくら|月額料金|自動更新/

// 課金/解約の定型案内（敬体・実挙動どおり）。有料プランへの切り替えはご自身の操作で
//   申し込んだときのみ課金され、登録だけでは課金されないことは特商法ページ/billing で
//   実機確認済み（監査 保護リスト#8）。断定はこの範囲に留める。
//   I-1(P05・2026-07-24): 「料金を教えて」「士業プランとは」に対しカードへ丸投げせず、
//     本文で3プランの価格と士業プランの中身を inline で即答する（値は lib/plans.ts=SSOT
//     から生成し、LP/課金UIと構造的に一致）。
//   2026-07-25 CTO修正: 課金開始(BILLING_ENABLED=true)に伴い「予定価格・現在は無料モニター」
//     の表記を撤去。実際に課金される月額料金として案内する。
const BILLING_YEN = (n: number) => `${n.toLocaleString('ja-JP')}円`
const BILLING_PLAN_LINE =
  '月額料金は次のとおりです（登録するとまず無料プランでお使いいただけ、有料プランへの切り替えはご自身の操作で申し込んだときのみ課金されます）。' +
  `${PLANS.starter.displayName}＝月額${BILLING_YEN(PLANS.starter.monthlyJpy)}（1社を管理）、` +
  `${PLANS.standard.displayName}＝月額${BILLING_YEN(PLANS.standard.monthlyJpy)}（1社を管理・記憶フル/書類作成/能動通知）、` +
  `${PLANS.shigyo.displayName}プラン＝月額${BILLING_YEN(PLANS.shigyo.monthlyJpy)}（複数の会社／顧問先を切り替えて管理でき、会社ごとに記憶が分かれます）。`
const BILLING_FAQ_TEXT =
  'ご料金や解約についてのご質問ですね。番頭の労務相談とは別のご案内になりますが、こちらでお答えします。\n\n' +
  '番頭は無料プランでもご利用いただけます。有料プランへの切り替えは、会社ページの「プランの管理」からご自身で申し込んだときのみ課金され、登録しただけで自動的に料金が発生することはありません。\n\n' +
  BILLING_PLAN_LINE +
  '\n\n特定商取引法に基づく表記、プランの解約・退会のお手続き、お問い合わせ窓口は、下のご案内からもご確認いただけます。'

// 記憶抽出のトリガ間隔（ユーザー発話n回ごと）。4→2に短縮:
//   3往復未満で離脱した会話が一度も記憶化されない問題の暫定緩和
//   （サーバ側抽出への移行は別タスク。ここではクライアント起点のまま間隔だけ詰める）。
const MEMORY_TRIGGER_EVERY = 2

function CompanyChat() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const companyId = params.get('companyId') ?? ''
  const initialQ = params.get('q') ?? ''
  // 2026-07-29 CTO (L3 audit #2): minimum-scope chat UI localization (placeholder /
  //   send button / input aria-label), per the audit's own fallback instruction
  //   ("if full app-wide i18n is too large, start with just the chat UI text").
  //   Deliberately NOT touching the onboarding greeting / sample prompts / message
  //   history, which are entangled with the company-switch reset effect below and
  //   would need a separate, more careful pass to avoid resetting live conversations.
  const locale = useLocale(params.get('lang'))

  const [messages, setMessages] = useState<Message[]>([ONBOARDING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [ruleCount, setRuleCount] = useState<number | null>(null)
  // 本日の残り相談回数（P2・429の事前告知）。null=未取得/取得失敗（バッジ非表示）。
  //   plan: 2026-07-24 成長施策で追加。残りわずかバッジを課金導線にするかの判定に使う
  //   （士業プラン=最上位はアップグレード先が無いためリンクしない）。
  const [chatRemaining, setChatRemaining] = useState<{
    remaining: number
    limit: number
    plan?: string
  } | null>(null)
  // サンプル質問（UX-2）: 既定は固定4問。attributes が取れたら会社に合わせて出し分け。
  const [samplePrompts, setSamplePrompts] = useState<string[]>(SAMPLE_PROMPTS)
  // 自社プロファイル要約ミニバー（G-c）: attributes の1行要約。空配列=非表示（未登録/取得失敗）。
  const [profileSummary, setProfileSummary] = useState<string[]>([])
  // ミニバーの折りたたみ（1行のまま要約部分だけ隠せる）。
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)
  // 判断採取フック（TOP5 #1）: 番頭が「この方針を記録しますか？」と能動提案する状態。
  //   reason=提案理由ラベル / savingDecision=保存中 / dismissed=この往復では再提示しない。
  const [decisionPrompt, setDecisionPrompt] = useState<{ reason: string } | null>(null)
  const [savingDecision, setSavingDecision] = useState(false)
  // 401（セッション失効）の袋小路防止: 汎用エラーに潰さず、再ログイン導線を明示する。
  const [sessionExpired, setSessionExpired] = useState(false)
  // 2026-07-24 成長施策: 日次上限(429)で billingEnabled かつ最上位未満のときだけ、
  //   アップグレード導線カードを出す（無料/有料境界に来た最も購入意欲が高い瞬間）。
  const [rateLimitUpgrade, setRateLimitUpgrade] = useState(false)
  // I2: 課金/解約の質問を検知したときだけ、料金/特商法/サポートへの導線カードを出す。
  const [billingHelp, setBillingHelp] = useState(false)
  // 会話の継続性（P1-3）: マウント時に直近会話を復元中か / 復元した会話のタイトル。
  //   restoring 中はサンプル質問を出さない（復元結果で上書きされるチラつき防止）。
  const [restoring, setRestoring] = useState(false)
  const [resumedTitle, setResumedTitle] = useState<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const lastExtractedAtRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef(false)
  // 判断採取の対象となる「直近の確定済み会話」（保存時にこの内容をサーバへ送る）。
  const decisionMessagesRef = useRef<Message[]>([])
  // 離脱時の未抽出フラッシュ（F2）用: イベントハンドラから最新の会話を参照するための鏡。
  const messagesRef = useRef<Message[]>(messages)

  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 参照中の自社ルール件数を取得（常時表示の安心材料）。
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/company/profile?companyId=${companyId}`)
        if (!r.ok) {
          if (!cancelled) setRuleCount(null)
          return
        }
        const d = await r.json()
        if (!cancelled) setRuleCount((d.profiles ?? []).length)
      } catch {
        if (!cancelled) setRuleCount(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // 本日の残り相談回数を取得（P2・429の事前告知）。取得失敗時はバッジを出さない。
  const refreshUsage = useCallback(async () => {
    if (!companyId) return
    try {
      const r = await fetch(`/api/company/usage?companyId=${companyId}&kind=chat`)
      if (!r.ok) return
      const d = await r.json()
      if (typeof d.remaining === 'number' && typeof d.limit === 'number') {
        setChatRemaining({ remaining: d.remaining, limit: d.limit, plan: d.plan })
      }
    } catch {
      // 取得失敗はサイレント（残回数は補助情報。出せないだけで相談は妨げない）
    }
  }, [companyId])

  // 初回マウント時の残回数取得（ruleCount と同じ inline-IIFE パターン）。
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/company/usage?companyId=${companyId}&kind=chat`)
        if (!r.ok) return
        const d = await r.json()
        if (!cancelled && typeof d.remaining === 'number' && typeof d.limit === 'number') {
          setChatRemaining({ remaining: d.remaining, limit: d.limit, plan: d.plan })
        }
      } catch {
        // 取得失敗はサイレント（残回数は補助情報）
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // サンプル質問のオンボ回答連動（UX-2）: attributes から会社に合う4問を決定的に組み立てる。
  //   未登録（attributes: null）・取得失敗時は固定4問のまま＝現行挙動にフォールバック。
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/company/attributes?companyId=${companyId}`)
        if (!r.ok) return
        const d = await r.json()
        if (!cancelled && d.attributes) {
          setSamplePrompts(buildSamplePrompts(d.attributes as CompanyAttributesRow))
          // G-c: 同じ1回の取得からミニバー要約も組み立てる（追加リクエストなし）。
          setProfileSummary(buildProfileSummary(d.attributes as CompanyAttributesRow))
        }
      } catch {
        // フォールバック: 固定4問のまま（サンプル質問が出ないより出るほうが良い）
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // 離脱時フラッシュ（F2）用の鏡: messages の最新値を常に ref に写す。
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // 初回記憶の取りこぼしゼロ化（F2-b）: タブ非表示/ページ離脱の瞬間に、まだ記憶抽出して
  // いないユーザー発話が残っていれば navigator.sendBeacon で /api/company/memory へ送る。
  //   fetch は unload 中に打ち切られ得るが、sendBeacon はページ終了後も送信が継続される。
  //   payload は既存 extractFacts と同一形式（{ companyId, messages }）。sendBeacon は
  //   Content-Type を直接指定できないため、Blob に application/json を持たせて渡す。
  useEffect(() => {
    if (!companyId) return
    const flushPendingExtraction = () => {
      const msgs = messagesRef.current
      const userCount = msgs.filter(m => m.role === 'user').length
      if (userCount === 0 || userCount <= lastExtractedAtRef.current) return // 未抽出なし
      if (typeof navigator === 'undefined' || !navigator.sendBeacon) return
      const payload = new Blob(
        [
          JSON.stringify({
            companyId,
            messages: msgs.map(m => ({ role: m.role, content: m.content })),
          }),
        ],
        { type: 'application/json' },
      )
      // 送れたら抽出済み扱いにする（hidden→visible→hidden の往復で二重送信しない）。
      if (navigator.sendBeacon('/api/company/memory', payload)) {
        lastExtractedAtRef.current = userCount
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingExtraction()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flushPendingExtraction)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushPendingExtraction)
    }
  }, [companyId])

  // 顧問先を切り替えたら会話状態をリセット（記憶の混線防止）したうえで、
  // 当該会社の「直近の会話」を復元する（P1-3 会話の継続性）。
  //   保存自体は /api/company/chat が毎往復行っているのに参照UIが無く、
  //   リロード/再訪のたびにまっさらに戻っていた問題への対処。
  //   ?q= 付き遷移（リスク診断からの「この内容で相談」等）は“新しい相談”の意図なので
  //   復元せず、従来どおり自動送信で新規会話を始める。
  useEffect(() => {
    setMessages([ONBOARDING_MESSAGE])
    setInput('')
    setIsFirstMessage(true)
    setDecisionPrompt(null)
    setSessionExpired(false)
    setBillingHelp(false)
    setRateLimitUpgrade(false)
    setResumedTitle(null)
    conversationIdRef.current = null
    lastExtractedAtRef.current = 0
    autoSentRef.current = false

    if (!companyId || initialQ) return

    let cancelled = false
    setRestoring(true)
    ;(async () => {
      try {
        const r = await fetch(`/api/company/conversations?companyId=${companyId}&latest=1`)
        if (!r.ok) return // 復元失敗は新規状態のまま（エラー表示で相談開始を妨げない）
        const d = await r.json()
        if (cancelled || !d.conversation || !Array.isArray(d.messages) || d.messages.length === 0) return
        const history: Message[] = d.messages
          .filter((m: Message) => m.role === 'user' || m.role === 'assistant')
          .map((m: Message) => ({ role: m.role, content: String(m.content) }))
        if (history.length === 0) return
        conversationIdRef.current = d.conversation.id
        setMessages([ONBOARDING_MESSAGE, ...history])
        setIsFirstMessage(false)
        setResumedTitle(d.conversation.title ?? '前回の相談')
        // 復元分のユーザー発話は抽出済みとみなす（再抽出による記憶の重複を防ぐ）。
        lastExtractedAtRef.current = history.filter(m => m.role === 'user').length
      } catch {
        // 復元失敗はサイレント（新規状態で開始できることが最優先）
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId, initialQ])

  // 「新しい相談を始める」: 復元済み/進行中の会話を離れ、新規会話に切り替える。
  //   サーバ側は conversationId 未指定の送信で新規 company_conversations を作るため、
  //   クライアントは状態を初期化するだけでよい（過去の会話は消えず保存されたまま）。
  const startNewConversation = useCallback(() => {
    setMessages([ONBOARDING_MESSAGE])
    setInput('')
    setIsFirstMessage(true)
    setDecisionPrompt(null)
    setBillingHelp(false)
    setRateLimitUpgrade(false)
    setResumedTitle(null)
    conversationIdRef.current = null
    lastExtractedAtRef.current = 0
  }, [])

  const extractFacts = useCallback(
    async (msgs: Message[]) => {
      try {
        const res = await fetch('/api/company/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            messages: msgs.map(m => ({ role: m.role, content: m.content })),
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.savedRuleCandidates > 0) {
          showToast(`自社の事実を${data.savedRuleCandidates}件、覚える候補にしました`)
        }
      } catch {
        // 抽出失敗はサイレント
      }
    },
    [companyId, showToast],
  )

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = text ?? input
      if (!content.trim() || loading || !companyId) return

      setIsFirstMessage(false)
      const userMessage: Message = { role: 'user', content }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)
      setInput('')

      // I2: 課金/解約の質問は API を呼ばず、その場で定型案内＋導線カードを返す
      //   （労務スコープ外の門前払いをやめる）。労務の質問なら従来どおり API へ流す。
      if (BILLING_INTENT_RE.test(content)) {
        track('chat_billing_faq_shown')
        setMessages(prev => [...prev, { role: 'assistant', content: BILLING_FAQ_TEXT }])
        setBillingHelp(true)
        return
      }
      setBillingHelp(false)
      setRateLimitUpgrade(false)

      setLoading(true)

      // H08(エラーバジェット): 失敗「率」の分母。送信試行を1回ずつ数える（PIIなし・本文は送らない）。
      track('chat_message_sent')

      try {
        const res = await fetch('/api/company/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            companyId,
            conversationId: conversationIdRef.current,
          }),
        })

        if (res.status === 409) {
          setLoading(false)
          router.push('/company')
          return
        }
        if (res.status === 403) {
          // G-h: 権限エラーも突き放さない。原因の言い換え＋次の一手（会社の選び直し/管理者確認）。
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content:
                '申し訳ありません。この会社の相談を開く権限が確認できませんでした。会社の切り替えで自社を選び直すか、管理者の方にご確認いただけますか。',
            },
          ])
          setLoading(false)
          return
        }
        // 429: 本日の利用上限。API が返す上限メッセージをそのまま出し、再試行を促さない
        //   （「接続に失敗しました。もう一度」に潰すと、何度送っても失敗する袋小路になる）。
        if (res.status === 429) {
          // H08: 上限到達は「製品の故障」ではないが、体験としては失敗＝kind別に数える。
          track('chat_error', { kind: 'rate_limited' })
          const data = await res.json().catch(() => ({}))
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content:
                data.error ??
                '本日の相談枠を使い切りました。日本時間の午前9時に元に戻ります。急ぎの論点は「社労士に渡すメモ」に整理しておくと安心です。',
            },
          ])
          // 2026-07-24 成長施策: サーバが upgradeAvailable=true を返したときだけ
          //   アップグレード導線カードを出す（billing無効/最上位プランでは出さない）。
          if (data.upgradeAvailable) {
            track('chat_upgrade_prompt_shown')
            setRateLimitUpgrade(true)
          }
          setLoading(false)
          return
        }
        // 401: セッション失効。汎用エラーでなく再ログイン導線（下部バナー）を出す。
        if (res.status === 401) {
          setSessionExpired(true)
          setLoading(false)
          return
        }
        // H08: サーバー側失敗（5xx等）。network(catch)と二重計上しないよう throw せず inline 処理。
        if (!res.ok) {
          track('chat_error', { kind: 'server', status: res.status })
          // G-h: 「接続に失敗しました」で突き放さない。番頭側の不調と認め、次の一手を添える。
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content:
                '申し訳ありません。番頭がうまく答えを返せませんでした。少し時間をおいて、同じ内容をもう一度送っていただけますか。ここまでのやり取りは画面に残っています。',
            },
          ])
          return
        }

        const convId = res.headers.get('X-Conversation-Id')
        if (convId) conversationIdRef.current = convId

        // 記憶想起の可視化: 本文ストリームより先に届くヘッダから、この回答で参照した
        //   自社の記憶（非PIIサマリ）を取り出し、assistant メッセージに添える。
        let recalled: RecalledMemory | undefined
        const recalledRaw = res.headers.get('X-Recalled-Memory')
        if (recalledRaw) {
          try {
            recalled = JSON.parse(decodeURIComponent(recalledRaw)) as RecalledMemory
          } catch {
            recalled = undefined
          }
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let assistantContent = ''

        setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true, recalled }])

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            assistantContent += decoder.decode(value)
            setMessages(prev => [
              ...prev.slice(0, -1),
              { role: 'assistant', content: assistantContent, isTyping: false, recalled },
            ])
          }
        }

        const finalMessages: Message[] = [
          ...newMessages,
          { role: 'assistant', content: assistantContent },
        ]
        const userCount = finalMessages.filter(m => m.role === 'user').length
        // 初回記憶の取りこぼしゼロ化（F2-a）: この会話でまだ一度も抽出していなければ
        // 1往復目から先行発火する（1往復で離脱した会話が記憶ゼロになる穴を塞ぐ）。
        // 2回目以降は従来どおり MEMORY_TRIGGER_EVERY 間隔。
        const firstExtraction = lastExtractedAtRef.current === 0 && userCount >= 1
        if (
          firstExtraction ||
          (userCount >= MEMORY_TRIGGER_EVERY &&
            userCount - lastExtractedAtRef.current >= MEMORY_TRIGGER_EVERY)
        ) {
          lastExtractedAtRef.current = userCount
          extractFacts(finalMessages)
        }

        // --- 判断採取フック（TOP5 #1）: 番頭側から能動的に「記録しますか？」を提案 ---
        //   追加のLLM呼び出しはせず、軽量ヒューリスティックで“出すか”だけ判定する。
        //   出すと決めたら、保存対象としてこの確定会話を控える（human-in-the-loop）。
        const signal = detectDecisionSignal(
          finalMessages.map(m => ({ role: m.role, content: m.content })),
        )
        if (signal.suggest) {
          decisionMessagesRef.current = finalMessages
          setDecisionPrompt({ reason: signal.reason })
        }
      } catch {
        // H08: 通信断・ストリーム中断など（サーバーに届かなかった/途中で切れた失敗）。
        track('chat_error', { kind: 'network' })
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content:
              '通信が途中で切れてしまったようです。電波やネットワークの状態を確かめて、もう一度送っていただけますか。ここまでのやり取りは画面に残っています。',
          },
        ])
      } finally {
        setLoading(false)
        // 送信のたびに残回数を更新（次の送信前に最新の残りが出る）。
        refreshUsage()
      }
    },
    [input, loading, companyId, messages, router, extractFacts, refreshUsage],
  )

  // 判断採取の確定保存（ユーザーが「記録する」を押したときだけ呼ぶ＝human-in-the-loop）。
  //   サーバは既存 extractCompanyMemory（1パス）で topic/subject を構造化し decision 保存。
  const saveDecision = useCallback(async () => {
    if (savingDecision || !companyId) return
    const msgs = decisionMessagesRef.current
    if (!msgs.length) {
      setDecisionPrompt(null)
      return
    }
    setSavingDecision(true)
    try {
      const res = await fetch('/api/company/memory?action=decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          messages: msgs.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.saved) {
        // 計測: 判断採取の保存成功＝蓄積の核イベント。生本文/氏名/topicラベルは送らず、
        // topicが付いたか(非PIIのbool)だけ記録する。
        track('judgment_captured', { has_topic: Boolean(data.decision?.topic) })
        // 記憶が増えた瞬間の実感強化（UX-5）: 保存直後に記憶残高を取り、件数入りで伝える。
        //   stats が取れない時は現行文言のまま（トーストを遅らせない/失敗で壊さない）。
        let toastMessage = 'この方針を会社の記憶に残しました'
        try {
          const statsRes = await fetch(`/api/company/memory/stats?companyId=${companyId}`)
          if (statsRes.ok) {
            const stats = await statsRes.json()
            if (typeof stats.total === 'number' && stats.total > 0) {
              toastMessage = `この方針を記録しました。会社の記憶が${stats.total}件になりました`
            }
          }
        } catch {
          // 件数取得失敗はサイレント（保存自体は成功している）
        }
        showToast(toastMessage)
      } else {
        showToast(data.error ?? '記録できませんでした')
      }
    } catch {
      showToast('記録できませんでした。通信の状態を確かめて、もう一度お試しいただけますか')
    } finally {
      setSavingDecision(false)
      setDecisionPrompt(null)
    }
  }, [savingDecision, companyId, showToast])

  // D05: 「記憶に保存」アクションチップ。直近の確定済み会話を既存の判断採取フロー
  //   （/api/company/memory?action=decision・human-in-the-loop）でそのまま保存する。
  //   新規機構は作らない＝decisionMessagesRef に現在の会話を控えて saveDecision を呼ぶ。
  const saveLatestAsDecision = useCallback(() => {
    if (savingDecision) return
    decisionMessagesRef.current = messagesRef.current
    track('chat_action_chip', { chip: 'save_memory' })
    void saveDecision()
  }, [savingDecision, saveDecision])

  // ?q= の初回自動送信（リスク診断などからの誘導）。1回だけ。
  useEffect(() => {
    if (initialQ && !autoSentRef.current && companyId) {
      autoSentRef.current = true
      sendMessage(initialQ)
    }
  }, [initialQ, companyId, sendMessage])

  return (
    /* height（min-height ではない）で親の高さを固定する。
       min-height だと子の flex-1 が内容ぶん伸び続け、メッセージ枠の overflow-y-auto が
       一度も発火しない。結果、回答が長いほど入力欄が画面外へ押し出され、
       「次を聞く」たびにスクロールが必要だった（2026-07-30 UX監査 A-2）。
       高さを固定すればメッセージ枠だけがスクロールし、入力欄は常に見える。 */
    <div className="mx-auto flex max-w-3xl flex-col" style={{ height: 'calc(100dvh - 8rem)' }}>
      {/* この会社専用 / 参照ルール件数（常時表示） */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="brand">
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          この会社専用
        </Badge>
        {/* 参照ルールバッジのリンク化（UX-3）: 「何を前提に答えているか」を1タップで確認できる透明性 */}
        {ruleCount !== null && (
          <Link
            href={`/company/rules?companyId=${companyId}`}
            aria-label={`参照中の自社ルール${ruleCount}件を確認する`}
            className="rounded-full transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Badge tone="neutral">
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden />
              参照中の自社ルール {ruleCount}件
            </Badge>
          </Link>
        )}
        {/* 本日の残り相談回数（P2・429の事前告知）。残りわずかは warning で早めに気づかせる。
            2026-07-24: 残りわずか(<=3)かつ最上位プラン未満のときは、429で止まる前に
            バッジ自体をプラン確認への導線にする（低弾数警告→ショップの定石）。 */}
        {chatRemaining !== null && (
          <>
            {chatRemaining.remaining <= 3 && chatRemaining.plan && chatRemaining.plan !== 'shigyo' ? (
              <Link
                href={`/company/billing?companyId=${companyId}`}
                onClick={() => track('chat_low_remaining_badge_click')}
                aria-label={`本日の残り相談${chatRemaining.remaining}回。プランを見る`}
                className="rounded-full transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Badge tone="warning">
                  本日の残り相談 {chatRemaining.remaining}/{chatRemaining.limit}回・プランを見る
                </Badge>
              </Link>
            ) : (
              <Badge tone={chatRemaining.remaining <= 3 ? 'warning' : 'neutral'}>
                本日の残り相談 {chatRemaining.remaining}/{chatRemaining.limit}回
              </Badge>
            )}
          </>
        )}
        {/* 会話が始まっている（復元 or 送信済み）ときだけ「新しい相談」への切替を出す */}
        {messages.length > 1 && !loading && (
          <button
            onClick={startNewConversation}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-500 bg-white px-2.5 py-1 text-xs text-neutral-600 transition-colors hover:border-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            新しい相談を始める
          </button>
        )}
        <div className="ml-auto sm:hidden">
          <CompanySwitcher companyId={companyId} variant="header" />
        </div>
      </div>

      {/* 自社プロファイル要約ミニバー（G-c）: 「番頭はこの前提で答えます」を1行で常時表示。
          折りたたむと要約部分だけ隠れる（バー自体は残す＝再展開の足がかり）。 */}
      {profileSummary.length > 0 && (
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
          <span className="shrink-0 text-xs font-medium text-neutral-700">
            番頭はこの前提で答えます
          </span>
          {!summaryCollapsed && (
            <span className="min-w-0 truncate text-xs text-neutral-600" title={profileSummary.join('・')}>
              {profileSummary.join('・')}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSummaryCollapsed(v => !v)}
            aria-expanded={!summaryCollapsed}
            className="ml-auto shrink-0 text-[11px] text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {summaryCollapsed ? '前提を表示' : '隠す'}
          </button>
        </div>
      )}

      {/* 会話の継続性（P1-3）: 直近会話を復元したことを明示（黙って続きにしない） */}
      {resumedTitle && (
        <p className="mb-2 truncate text-xs text-neutral-500">
          前回の相談「{resumedTitle}」の続きから再開しています
        </p>
      )}

      <div
        className="flex-1 space-y-5 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4"
        role="log"
        aria-live="polite"
        aria-label="チャット履歴"
      >
        {messages.map((msg, i) => {
          // 直近の確定済み assistant 回答にだけ「次の一歩」を添える（全回答に出すとノイズ）。
          //   i > 0 でオンボーディング挨拶を除外。ストリーミング中(loading/isTyping)は出さない。
          const isLatestAnswer =
            msg.role === 'assistant' && i === messages.length - 1 && i > 0 && !msg.isTyping && !loading
          // UX-4: 回答が規程系の話題のときだけ、起草（documents）への連結チップを出す。
          const showDraftChip = isLatestAnswer && DRAFTABLE_RE.test(msg.content)
          // F3: 【根拠】で自社ルールを引いた回答には「前提の修正」導線（誤前提の自己修復路）。
          const showFixPremise = isLatestAnswer && msg.content.includes('【根拠】')
          // I08: 断定を避けた回答には「社労士に相談する下準備」への次アクションを標準提示。
          const showUncertainNext = isLatestAnswer && UNCERTAIN_RE.test(msg.content)
          // P01/P07: 自社情報が未登録で答えられなかった回答には「規程を覚えさせる」入口を出す。
          const showTeachRules = isLatestAnswer && TEACH_RULES_RE.test(msg.content)
          return (
            <div key={i}>
              {/* 記憶想起の可視化: assistant 回答の直前に「参照した自社の記憶」を提示する。 */}
              {msg.role === 'assistant' && msg.recalled && (
                <div className="mb-1 max-w-[85%]">
                  <RecallPanel recalled={msg.recalled} companyId={companyId} />
                </div>
              )}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'whitespace-pre-wrap rounded-br-sm bg-brand-600 text-white'
                      : 'rounded-bl-sm bg-neutral-100 text-neutral-900'
                  }`}
                >
                  {msg.isTyping ? (
                    <span className="flex h-4 items-center gap-1" aria-label="入力中">
                      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : msg.role === 'assistant' ? (
                    // D04: assistant 回答は Markdown レンダラで描画（プロンプト抑制が
                    // 漏れた **太字**・##見出し・表も正しく整形。raw HTML は無効＝XSS安全）。
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
              {isLatestAnswer && (
                <div className="mt-1.5 space-y-1.5 pl-1">
                  {/* I08: 断定を避けた回答の次アクション標準化（社労士相談の下準備）。 */}
                  {showUncertainNext && (
                    <p className="text-[11px] leading-relaxed text-neutral-500">
                      AIだけでは判断しきれない内容です。番頭が覚えている自社情報を、社労士に相談するときの下準備メモに整理できます。
                    </p>
                  )}
                  {/* D05: 回答末尾のアクションチップ（すべて既存機能への導線）。 */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <button
                      type="button"
                      onClick={saveLatestAsDecision}
                      disabled={savingDecision}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
                      {savingDecision ? '記憶に保存中...' : '記憶に保存'}
                    </button>
                    <Link
                      href={`/company/deadlines?companyId=${companyId}`}
                      onClick={() => track('chat_action_chip', { chip: 'deadline' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                      期限を作る
                    </Link>
                    <Link
                      href={`/company/reports?companyId=${companyId}&mode=sharoushi`}
                      onClick={() => track('chat_action_chip', { chip: 'sharoushi_memo' })}
                      className={
                        showUncertainNext
                          ? 'inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                          : 'inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                      }
                    >
                      <FileBarChart className="h-3.5 w-3.5" aria-hidden />
                      社労士に渡すメモを作る
                    </Link>
                    {showDraftChip && (
                      <Link
                        href={`/company/documents?companyId=${companyId}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        この内容で規程ドラフトの下書きを作る
                      </Link>
                    )}
                    {showTeachRules && (
                      <Link
                        href={`/company/rules?companyId=${companyId}`}
                        onClick={() => track('chat_action_chip', { chip: 'teach_rules' })}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <ScrollText className="h-3.5 w-3.5" aria-hidden />
                        番頭に規程を覚えさせる
                      </Link>
                    )}
                    {showFixPremise && (
                      <Link
                        href={`/company/rules?companyId=${companyId}`}
                        className="text-xs text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        前提が違う場合は修正する
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* restoring 中はサンプル質問を出さない（復元結果で上書きされるチラつき防止） */}
        {isFirstMessage && !restoring && messages.length === 1 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="相談の始め方の例">
            {samplePrompts.map(prompt => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="rounded-xl border border-neutral-500 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 transition-colors hover:border-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* セッション失効（401）: 現在のパスへ戻れる next 付きで再ログインへ誘導する。 */}
      {sessionExpired && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-center">
          <p className="min-w-0 text-sm text-neutral-900">
            ログインの有効期限が切れました。ログインし直すと、この画面に戻れます。相談の記録は消えていません。
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(
              `${pathname}${params.toString() ? `?${params.toString()}` : ''}`,
            )}`}
            className={buttonClass({ variant: 'primary', size: 'sm' })}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            ログインし直す
          </Link>
        </div>
      )}

      {/* I2: 課金/解約の質問に対する導線カード（門前払いをやめる）。料金・特商法/プラン/窓口へ。 */}
      {billingHelp && (
        <div className="mt-3 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tokushoho"
              onClick={() => track('chat_billing_link', { target: 'tokushoho' })}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              <Receipt className="h-4 w-4" aria-hidden />
              料金・特定商取引法の表記
            </Link>
            <Link
              href={`/company/billing?companyId=${companyId}`}
              onClick={() => track('chat_billing_link', { target: 'billing' })}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              <CreditCard className="h-4 w-4" aria-hidden />
              プラン・解約のお手続き
            </Link>
            <a
              href="mailto:support@banto-roumu.com"
              onClick={() => track('chat_billing_link', { target: 'support' })}
              className={buttonClass({ variant: 'ghost', size: 'sm' })}
            >
              <Mail className="h-4 w-4" aria-hidden />
              お問い合わせ窓口
            </a>
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            労務のご相談でしたら、もう一度具体的にご質問ください。この会社の前提を踏まえてお答えします。
          </p>
        </div>
      )}

      {/* 2026-07-24 成長施策: 日次上限(429)到達時のアップグレード導線。
          最も購入意欲が高い瞬間（能動的に使い切った）に「明日まで待つ」以外の一歩を出す。 */}
      {rateLimitUpgrade && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900">
              もっと相談したい方へ
            </p>
            <p className="text-xs text-neutral-600">
              上位プランに切り替えると、1日あたりの相談回数がすぐに増えます。
            </p>
          </div>
          <Link
            href={`/company/billing?companyId=${companyId}`}
            onClick={() => track('chat_upgrade_prompt_click')}
            className={buttonClass({ variant: 'primary', size: 'sm', className: 'sm:ml-auto sm:shrink-0' })}
          >
            <CreditCard className="h-4 w-4" aria-hidden />
            プランを見る
          </Link>
        </div>
      )}

      {/* 判断採取フック（TOP5 #1）: 番頭が能動的に「この方針を記録しますか？」と促す。
          押したときだけサーバが decision として構造化保存する（自動保存しない＝誤記憶防止）。 */}
      {decisionPrompt && !loading && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-2">
            <BookmarkPlus className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900">
                この方針を会社の記憶に残しますか？
              </p>
              <p className="text-xs text-neutral-600">
                {decisionPrompt.reason}。担当者が代わっても番頭が覚えています。
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto sm:shrink-0">
            <Button size="sm" onClick={saveDecision} disabled={savingDecision}>
              <Check className="h-4 w-4" aria-hidden />
              {savingDecision ? '記録中...' : '記録する'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDecisionPrompt(null)}
              disabled={savingDecision}
              aria-label="記録しない"
            >
              <X className="h-4 w-4" aria-hidden />
              いいえ
            </Button>
          </div>
        </div>
      )}

      <p className="px-1 pb-1 pt-2 text-center text-xs text-neutral-400">
        AIの回答は参考情報です。重要な判断は社会保険労務士など専門家にご相談ください。
      </p>

      <div className="flex gap-2 pt-1">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder={t(locale, '自社の労務について相談', "Ask about your company's labor rules")}
          rows={1}
          aria-label={t(locale, 'メッセージを入力', 'Type a message')}
          className="flex-1 resize-none rounded-xl border border-neutral-500 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <Button
          size="lg"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          aria-label={t(locale, '送信', 'Send')}
        >
          <Send className="h-4 w-4" aria-hidden />
          {loading ? '...' : t(locale, '送信', 'Send')}
        </Button>
      </div>

      {/* 操作説明は placeholder から分離（相談内容の誘い文句と混ぜない）。
          キーボード前提の説明のためモバイルでは出さない。 */}
      <p className="hidden pt-1 text-right text-[11px] text-neutral-400 sm:block">
        {t(locale, 'Enterで送信 / Shift+Enterで改行', 'Enter to send / Shift+Enter for a new line')}
      </p>

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}

export default function CompanyChatPage() {
  return (
    // I07: フォールバックは文字列でなく画面の骨格（チャット欄+入力欄）を出す。
    <Suspense
      fallback={
        <div
          className="mx-auto flex max-w-3xl flex-col"
          style={{ minHeight: 'calc(100dvh - 8rem)' }}
          aria-busy="true"
          aria-label="読み込み中"
        >
          <div className="mb-3 flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-40 rounded-full" />
          </div>
          <div className="flex-1 space-y-5 rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex justify-start">
              <Skeleton className="h-16 w-3/4 max-w-md rounded-2xl rounded-bl-sm" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-1/2 max-w-xs rounded-2xl rounded-br-sm" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-24 w-4/5 max-w-lg rounded-2xl rounded-bl-sm" />
            </div>
          </div>
          <div className="flex gap-2 pt-3">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 w-20 rounded-xl" />
          </div>
        </div>
      }
    >
      <CompanyGuard>
        <CompanyChat />
      </CompanyGuard>
    </Suspense>
  )
}

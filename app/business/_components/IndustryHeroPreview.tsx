'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2 } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { trackV as track } from '../_lib/variant'
import {
  INDUSTRIES,
  DEFAULT_INDUSTRY,
  getIndustry,
  type IndustryKey,
} from '../_lib/industries'
import { setSharedIndustry } from '../_lib/industry-selection'

// ============================================================================
// IndustryHeroPreview — ヒーロー右側の製品プレビュー。
//   2026-07-23 FV01（Takeshi承認ブランド）: 初期表示を「チャット継続モック」へ
//   置換した（output/0723/banto_brand_final/fv/fv01-spec.md 準拠）。
//     - 初期表示 = FV01: 昨日の相談の続きから今日の会話が始まる様子。文言は
//       Takeshi承認済みコピー（fv01-spec.md）。無断で変種を作らない。
//     - 業種タブ（Wave2a A14+B13）は維持。タブを選ぶと従来どおり業種別の
//       1往復プレビューに切り替わる（FV01の会話文言は承認済みのため業種別の
//       変種は作らず、「タブ選択で業種パネルへ切替」の形で統合した）。
//     - G10: FV01直下に「記憶が積み上がる」可視化ミニパネル（モック描画）。
//     - G07: FV01のstaggerフェード＝サイト全体2〜3箇所のうちの1箇所。
//       transform/opacityのみ・IntersectionObserverで1回だけ・
//       prefers-reduced-motion対応（スタイルは globals.css の .fv-*）。
//   SSR: 初期表示はFV01でA/B両変種共通＝変種間のFV体験差は作らない。
//   計測: 新イベント名は増やさない。タブ切替は既存語彙 demo_question_clicked に
//   source='hero_tab' と industry を載せる（従来と同一）。
// ============================================================================

/** 「積み上がっている記憶」モックの行（G10・表示イメージ。実データではない）
 *  2026-07-24 P07: 旧「就業規則（第1〜52条）」は"全文まるごと取り込み"を想起させ、
 *  実装（要点を1件ずつ or 対話で覚える・ファイル取込なし）との期待ギャップを生んだ。
 *  「要点を覚える」表現へ調整し、直下の橋渡しコピーで期待を正す。 */
const MEMORY_ROWS = [
  { label: '就業規則の要点（試用期間・休職 ほか）', kind: '規程の要点' },
  { label: '36協定 未締結という前提', kind: 'プロファイル' },
  { label: '昨日の相談: 試用期間の延長', kind: '相談の経緯' },
]

export default function IndustryHeroPreview() {
  // null = FV01（初期表示）。業種タブを押すと該当業種のプレビューへ。
  const [selected, setSelected] = useState<IndustryKey | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const memoryRef = useRef<HTMLDivElement>(null)

  // FV01のアニメ発火: 可視到達で .is-inview を1回だけ付与（threshold 0.4）。
  // 記憶パネル（G10）も同じ仕組みで積み上がりを1回だけ見せる。
  useEffect(() => {
    const targets = [chatRef.current, memoryRef.current].filter(
      (el): el is HTMLDivElement => el !== null,
    )
    if (targets.length === 0) return
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-inview')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.4 },
    )
    targets.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [selected])

  const select = (next: IndustryKey) => {
    // 選択中タブの再クリックは解除＝FV01（初期表示）へ戻す。計測は発火しない。
    if (next === selected) {
      setSelected(null)
      // 2026-07-28 CTO修正（L1監査#11）: 解除時は下の体験デモとの引き継ぎ状態も
      // 既定（製造）に戻す（ヒーロー自身の表示はFV01のまま・不変）。
      setSharedIndustry(DEFAULT_INDUSTRY)
      return
    }
    setSelected(next)
    // 下の体験デモ(TryDemo)が同じ業種から始まるよう共有ストアへ反映する
    // （ヒーロー自身の初期表示=FV01は不変。書き込みのみ・読み出しはしない）。
    setSharedIndustry(next)
    track('demo_question_clicked', { source: 'hero_tab', industry: next })
  }

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* 業種タブ（A14）: 「自分の業種の前提で答える」を切替で見せる */}
      <div
        role="tablist"
        aria-label="業種を選んで答え方の例を見る"
        className="mb-2 flex flex-wrap items-center gap-1"
      >
        <span className="mr-1 text-[11px] font-medium text-neutral-400">業種の例</span>
        {INDUSTRIES.map(i => (
          <button
            key={i.key}
            id={`hero-tab-${i.key}`}
            type="button"
            role="tab"
            aria-selected={i.key === selected}
            aria-controls="hero-tabpanel"
            tabIndex={selected === null ? (i.key === INDUSTRIES[0].key ? 0 : -1) : i.key === selected ? 0 : -1}
            onClick={() => select(i.key)}
            className={
              i.key === selected
                ? 'rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white'
                : 'rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] text-neutral-500 transition-colors hover:border-brand-300 hover:text-brand-700'
            }
          >
            {i.label}
          </button>
        ))}
      </div>

      {/* 2026-07-28 CTO修正（L2監査#12）: role="tab"に対応するrole="tabpanel"が
          存在しなかった（ペルソナ8指摘）。選択中パネル全体をtabpanelとして結線する。
          未選択(FV01)時はどのタブにも属さない読み上げ専用の説明のため、
          aria-labelledbyは付けない（tablist自体のaria-labelで文脈は伝わる）。 */}
      <div id="hero-tabpanel" role="tabpanel" aria-labelledby={selected ? `hero-tab-${selected}` : undefined}>
      {selected === null ? (
        <>
          {/* ===== FV01: チャット継続モック（承認済みコピー・変えない） ===== */}
          <div
            ref={chatRef}
            className="fv-chat"
            role="img"
            aria-label="番頭との会話例。昨日の相談の続きから今日の会話が始まる様子"
          >
            <div className="fv-chat__header">番頭</div>
            <div className="fv-chat__body">
              <div className="fv-divider fv-anim">─&ensp;昨日 17:24&ensp;─</div>
              <div className="fv-msg fv-msg--user fv-anim">試用期間は延長できますか？</div>
              <div className="fv-msg fv-msg--banto fv-anim">
                就業規則第12条では試用期間は3か月です。延長には規定の根拠が必要になります。
              </div>
              <div className="fv-divider fv-anim">─&ensp;今日&ensp;─</div>
              <div className="fv-msg fv-msg--user fv-anim">昨日の件、続きをお願いします</div>
              <div className="fv-msg fv-msg--banto fv-anim">
                はい、試用期間延長の件ですね。昨日の続きから進めましょう。規定案の下書きを用意しています。
              </div>
            </div>
          </div>

          {/* ===== G10: 記憶の可視化ミニパネル（記憶残高のモック描画） ===== */}
          <div
            ref={memoryRef}
            className="fv-memory mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
            role="img"
            aria-label="記憶残高の表示イメージ。規程・前提・相談の経緯が番頭に積み上がっていく様子"
          >
            <div className="flex items-center gap-2 px-4 pt-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
                <BantoMark className="h-3 w-3" aria-hidden />
              </span>
              <span className="text-xs font-semibold text-neutral-700">会社の記憶</span>
              <span className="ml-auto text-[11px] text-neutral-400">表示イメージ</span>
            </div>
            <ul className="space-y-1.5 px-4 py-3">
              {MEMORY_ROWS.map(row => (
                <li
                  key={row.label}
                  className="fv-anim flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                  <span className="truncate text-[12px] text-neutral-700">{row.label}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-neutral-400">{row.kind}</span>
                </li>
              ))}
            </ul>
            {/* P07 橋渡しコピー: 期待値を実装に一致させる。
                2026-07-30 修正: 実装は「本文を貼り付ければ全文記憶（最大10万字）＋条文引用」
                （app/api/company/document/ingest/route.ts）なのに、ここは「要点を1件ずつ」と
                実態より小さく書いており、検討者が最初に払う初期投入コストを自ら重く
                見せていた。未対応なのは「ファイル添付」であって「全文取込」ではない。 */}
            <p className="border-t border-neutral-100 px-4 py-2.5 text-[11px] leading-snug text-neutral-600">
              就業規則は本文を貼り付ければ全文を覚えます（ファイル添付は未対応）。
            </p>
          </div>
        </>
      ) : (
        <IndustryPanel industry={selected} />
      )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// IndustryPanel — Wave2a の業種別1往復プレビュー（内容は従来と同一・不変）。
// ---------------------------------------------------------------------------
function IndustryPanel({ industry }: { industry: IndustryKey }) {
  const ind = getIndustry(industry ?? DEFAULT_INDUSTRY)
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* ウィンドウバー */}
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
          <BantoMark className="h-3 w-3" aria-hidden />
        </span>
        <span className="text-xs font-semibold text-neutral-700">番頭</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden />
          記憶あり
        </span>
      </div>

      <div className="space-y-3 px-4 py-4">
        {/* 覚えている会社プロファイル */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            覚えている自社プロファイル
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ind.tags.map(tag => (
              <span
                key={tag}
                className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 tabular-nums"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* ユーザーの質問（右寄せ吹き出し） */}
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-[13px] leading-relaxed text-white">
            {ind.hero.q}
          </p>
        </div>

        {/* 番頭の回答（左寄せ・自社前提の一句を強調） */}
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <BantoMark className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
            {ind.hero.aPre}
            <span className="font-semibold text-neutral-900">{ind.hero.aEm}</span>
            {ind.hero.aPost}
          </div>
        </div>
      </div>
    </div>
  )
}

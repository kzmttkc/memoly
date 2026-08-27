'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { TOOL_NEXT, zureHref, OFFER } from '@/lib/offer'
import { track } from '@/lib/analytics'

// ============================================================================
// 無料セルフ点検ツール 共通シャーシ（クライアント計装・共通文言部）
//   実在2ツールの Calculator.tsx で文字どおり同一だった部分を抽出:
//     - tool_open 計装（初回マウントで1回）
//     - 「ブラウザ内計算・非送信」の共通注記
//     - 結果の免責（先頭文が共通・確認先だけツールごとに差し替え）
//     - 就業規則AI 登録CTA（結果末尾に1本・高痛点/低痛点で文言を出し分ける枠）
//   計測イベントの語彙は既存のまま: tool_open / tool_completed / signup_cta_clicked。
//   tool_completed の status 分岐は計算仕様に密結合のため各ツール側に残す。
// ============================================================================

/** tool_open 計装。初回マウントで1回だけ発火（既存2ツールと同一挙動）。 */
export function useToolOpen(tool: string) {
  useEffect(() => {
    track('tool_open', { tool })
  }, [tool])
}

/**
 * ハイドレーション完了までは false、マウント後の effect で true になる。
 *   SSR と初回クライアントレンダはともに false を返すため hydration mismatch を起こさない。
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}

/**
 * ハイドレーション前にユーザーがネイティブ入力した値を、controlled state の
 * 初期値として復元する（P08・2026-07-24 恒久対策）。
 *
 *   背景: 各ツールの入力は controlled（value={state}）で state 初期値は ''。
 *   ユーザーが JS ロード前（SSR HTML はネイティブに操作可能）に日付や数値を入れると、
 *   React がハイドレーションのコミットで「state='' と DOM値の不一致」を検知し、
 *   DOM 値を '' に巻き戻す＝入力が無言で消える（描画後~300ms 未満の反射タップで再現・
 *   3/3）。送信ボタンは既に hydration 前 disabled なので、これはネイティブ送信でも
 *   再読込でもなく、controlled 入力のリコンサイルによる消失。
 *
 *   対策: useState の遅延初期化子で、サーバー生成 DOM に残っている実値を読む。
 *   遅延初期化子はクライアントの初回（ハイドレーション）レンダの「レンダ段階」で走り、
 *   この時点ではサーバー HTML がまだ DOM 上にありユーザーの入力値を保持している。
 *   これを state の初期値に採れば、React が描画する value と DOM 値が一致し、巻き戻りが
 *   起きない。value/checked は React のハイドレーション差分検査の対象外（user-mutable）
 *   なので mismatch 警告も出ない。SSR では document 不在＝fallback('') を返す。
 *
 *   使い方: const [d, setD] = useState(() => preHydrationValue('kijunbi'))
 */
export function preHydrationValue(id: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null
  const v = el?.value
  return typeof v === 'string' && v !== '' ? v : fallback
}

/**
 * 点検フォームの送信ボタン（全ツール共通シャーシ）。
 *   離脱級バグ対策（P08 C-0）: ハイドレーション前は type="button" で描画する。
 *   送信ハンドラ（form の onSubmit）が装着される前にタップされても、ネイティブ
 *   form 送信（action 無し＝GET でページ再読込）が走らず、入力が全消えしない。
 *   ハイドレーション後に type="submit" へ切り替わり、各ツールの handleCheck
 *   （冒頭で e.preventDefault()）が正しく発火する。SSR と初回クライアントレンダは
 *   ともに type="button" で一致するため mismatch は出ない。
 *   低速回線 × 超速タップ（283ms のハンドラ装着を待たずに押す経路）を恒久的に殺す。
 *
 *   押下フィードバック（P08・2026-07-24）: Loop2でデータ消失は解消したが、
 *   「hydration前タップは値は残るが送信が無反応→再タップ要」でユーザーが戸惑った。
 *   → hydration前は disabled + スピナー + 「読み込み中です…」を出し、
 *   「押しても無反応」ではなく「まだ押せない（準備中）」だと視覚的に伝える。
 *   disabled により native form 送信も走らず、Loop2の消失対策はより強固になる。
 *   SSR と初回クライアントレンダはともに !hydrated（＝同じ「読み込み中」ラベル）で
 *   一致するため hydration mismatch は出ない。マウント後の effect で hydrated=true に
 *   なり children（例:「点検する」）へ切り替わる＝通常のクライアント状態遷移。
 */
export function ToolSubmitButton({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated()
  const ref = useRef<HTMLButtonElement>(null)
  // 所属 <form> の制約検証メッセージを日本語化する（2026-07-30 UX監査 #3）。
  useJapaneseValidationMessages(ref)
  return (
    <button
      ref={ref}
      type={hydrated ? 'submit' : 'button'}
      disabled={!hydrated}
      aria-busy={!hydrated}
      title={hydrated ? undefined : '読み込み中です。少しお待ちください'}
      className={buttonClass({
        variant: 'primary',
        size: 'lg',
        // 2026-07-30 UX監査 #1: base の whitespace-nowrap のままだと 320px 幅で
        //   「読み込み中です。少しお待ちください」がカード外へはみ出す。
        className: hydrated
          ? 'w-full whitespace-normal text-center'
          : 'w-full whitespace-normal text-center cursor-wait',
      })}
    >
      {!hydrated && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {hydrated ? children : '読み込み中です。少しお待ちください'}
    </button>
  )
}

// ============================================================================
// 制約検証メッセージの日本語化（2026-07-30 UX監査 #3）
//   実測: 空のまま「点検する」を押すと、日本語ページの上に Chrome 既定の
//   "Please fill out this field." が出ていた（/signup は日本語化済みで、
//   無料ツール6本だけが取り残されていた）。
//
//   方針: noValidate にして自前エラーを描くと、ネイティブが無料でやっている
//   「最初の不正入力へフォーカス＋スクロール」を全ツールぶん再実装することになる。
//   ネイティブ検証は残したまま setCustomValidity でメッセージだけ日本語に差し替える。
//
//   実装上の注意:
//     - invalid イベントはバブルしない。フォームに **capture** で付けて子孫を拾う。
//     - customValidity を立てたままだと、値を直しても customError で不正のままに
//       なる。input / change で必ず空に戻す。
//     - メッセージ生成の冒頭でも一度空に戻してから validity を読む（customError に
//         隠れた本当の違反理由—valueMissing か rangeOverflow か—を判別するため）。
// ============================================================================

type ValidatableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

function isValidatable(el: EventTarget | null): el is ValidatableElement {
  return !!el && typeof (el as ValidatableElement).setCustomValidity === 'function'
}

function japaneseValidationMessage(el: ValidatableElement): string {
  el.setCustomValidity('')
  const v = el.validity
  const isSelect = el.tagName === 'SELECT'
  const type = isSelect ? 'select' : (el as HTMLInputElement).type

  if (v.valueMissing) {
    if (type === 'select' || type === 'radio' || type === 'checkbox') return '選択してください。'
    if (type === 'date') return '日付を入力してください。'
    if (type === 'number') return '数値を入力してください。'
    return 'この項目を入力してください。'
  }
  if (v.badInput || v.typeMismatch) {
    if (type === 'date') return '日付を「年/月/日」の形式で入力してください。'
    return '数値で入力してください。'
  }
  if (v.rangeUnderflow) return `${(el as HTMLInputElement).min}以上の値を入力してください。`
  if (v.rangeOverflow) return `${(el as HTMLInputElement).max}以下の値を入力してください。`
  if (v.stepMismatch) return '入力できる刻みに合っていません。'
  if (v.tooShort || v.tooLong || v.patternMismatch) return '入力内容の形式をご確認ください。'
  return '入力内容をご確認ください。'
}

/**
 * 送信ボタンの ref から所属 <form> を辿り、その配下すべての入力の検証メッセージを
 * 日本語にする。全ツールが 1フォーム1 ToolSubmitButton の構成（実測で確認）のため、
 * 各 Calculator.tsx に手を入れずに6ツール一括で効く。
 */
export function useJapaneseValidationMessages(ref: React.RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    const form = ref.current?.form
    if (!form) return
    const onInvalid = (e: Event) => {
      if (!isValidatable(e.target)) return
      e.target.setCustomValidity(japaneseValidationMessage(e.target))
    }
    const clear = (e: Event) => {
      if (isValidatable(e.target)) e.target.setCustomValidity('')
    }
    form.addEventListener('invalid', onInvalid, true)
    form.addEventListener('input', clear)
    form.addEventListener('change', clear)
    return () => {
      form.removeEventListener('invalid', onInvalid, true)
      form.removeEventListener('input', clear)
      form.removeEventListener('change', clear)
    }
  }, [ref])
}

/** 入力フォーム末尾の共通注記（ブラウザ内計算・非送信）。 */
export function LocalOnlyNote() {
  return (
    <p className="mt-4 border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-500">
      入力した内容はこのブラウザの中だけで計算します。会社や社員のデータをサーバーに送ることはありません。
    </p>
  )
}

/** 結果末尾の免責。先頭文は共通・2文目（確認先）だけツールごとに渡す。 */
export function ResultDisclaimer({ detail }: { detail: string }) {
  return (
    <p className="mt-4 border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-500">
      {`この点検は、入力内容をもとにした一般的な目安の整理で、合否や適法性を判定するものではありません。 ${detail}`}
    </p>
  )
}

// 結果末尾の就業規則AI登録CTA（枠）。
//   高痛点/低痛点の文言出し分け・status はツール側で決めて渡す（1変数のみ変更の流儀）。
//   Phase1/景表法厳守: 「違反判定/解消」「社労士監修」は書かず、実挙動どおりの約束に留める。
export function ToolSignupCta({
  location,
  status,
}: {
  href?: string
  location: string
  status: string
  title?: string
  body?: string
  label?: string
}) {
  const href = zureHref('banto_tool', location)
  return (
    <>
      <div className="mt-5 rounded-2xl bg-brand-50 p-5">
        <p className="text-sm font-semibold text-neutral-900">
          {TOOL_NEXT.title}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          {TOOL_NEXT.body}
        </p>
        <Link
          href={href}
          onClick={() => track('signup_cta_clicked', { location, status })}
          className={buttonClass({
            variant: 'primary',
            size: 'lg',
            className: 'mt-4 w-full whitespace-normal text-center',
          })}
        >
          {OFFER.cta}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <VoiceInvite location={location} />
    </>
  )
}

// 感想リンク(KoeWall収集リンク)。
//   ツール結果＝利用者が実際に点検結果を受け取った直後にだけ、登録CTAの下へ控えめに置く。
//   iframe埋め込みはしない(next.config.ts の frame-src に koewall.jp が無く default-src 'self' に落ちる)
//   ＝外部リンク先へ飛ばすプレーンな <a>(next/link)のみ＝CSP適合。
//   全製品で1つのWall(KIZUNA Creation)を共有し、utm で流入元を判別する。
export function VoiceInvite({ location }: { location: string }) {
  const href =
    'https://koewall.jp/submit/u/f2ed973b495255f3827c73858a4dcffe' +
    '?utm_source=banto&utm_medium=tool_completed&utm_campaign=voice_collect' +
    `&utm_content=${encodeURIComponent(location)}`
  return (
    <p className="mt-4 text-center text-sm text-neutral-500">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('voice_invite_click', { product: 'banto', location })}
        className="underline underline-offset-4 hover:text-neutral-700"
      >
        この点検は役に立ちましたか？ ひとこと感想を送る
      </a>
    </p>
  )
}

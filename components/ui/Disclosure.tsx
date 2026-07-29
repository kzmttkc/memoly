'use client'

import { useId, useState, type ReactNode } from 'react'

// ============================================================================
// Disclosure — 開閉トリガー(<details>/<summary>相当の見た目・挙動)。
//
//   2026-07-29 CTO修正（UX監査Round6#1・最重要・全面書き直し）: 従来実装は
//   ネイティブ<details open={open}>にReact stateを被せる方式だった。コード上は
//   正しく見え、当セッションのPlaywright実測（本番banto-roumu.comに対し
//   スクロール込みの現実的なクリック・キーボード操作を多数回試行）でも問題を
//   再現できなかった一方、Round4〜6の複数ペルソナが独立にスクリーンショット
//   証拠付きで機能不全を報告し続けている。「再現できないから変更なし」という
//   Round5の判定を繰り返さないという方針のとおり、原因の特定に固執せず、
//   <details>のネイティブトグル・preventDefault・React state反映の三者が絡む
//   複雑さそのものを解体する。
//
//   新方式: <button aria-expanded>とコンテンツ<div>だけで完結させる。
//   - トリガーはネイティブ<button>。クリックはReactの唯一のイベントソースで、
//     ブラウザ側の競合するデフォルト動作（<summary>の暗黙トグル）が一切ない。
//   - Enter/Spaceでの活性化は<button>のネイティブ挙動そのもの（ブラウザ実装に
//     以前から組み込まれている、ハンドラの自作・保証が一切不要）。
//   - 開閉状態はReactのuseStateのみが真実（DOM側の"open"属性という二重の
//     状態源を持たない）。
//   - コンテンツは常にDOM上に存在し、閉じている間は`hidden`属性で視覚的に
//     隠すだけ（クローラは開閉に関わらず全文を読める＝旧実装のGEO/SEO特性を
//     維持）。
//   - 開閉に応じたインジケータ（chevron回転など）は、当初render-prop
//     （summaryを`(open: boolean) => ReactNode`にする案）で実装したが、
//     呼び出し側(app/business/page.tsx・app/faq/page.tsx)はServer
//     Componentのため、関数propをClient Component(このファイル)へ渡すと
//     RSCのシリアライズ制約に反し実行時500エラーになることが実装直後の
//     実機確認（dev server）で判明した。関数を一切propとして受け取らず、
//     ラッパー<div>にdata-state="open|closed"を持たせ、呼び出し側は
//     Tailwindの`group-data-[state=open]:`で回転させる（CSS属性セレクタ
//     だが、対象はReact stateと一体のこのコンポーネント内のdiv自身であり、
//     旧実装が抱えていた「ネイティブ<details>のopen属性とReact stateの
//     二重管理」とは異なる）。
// ============================================================================

export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  contentClassName,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  className?: string
  summaryClassName?: string
  contentClassName?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div className={className} data-state={open ? 'open' : 'closed'}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        className={summaryClassName}
        onClick={() => setOpen(v => !v)}
      >
        {summary}
      </button>
      <div id={contentId} className={contentClassName} hidden={!open}>
        {children}
      </div>
    </div>
  )
}

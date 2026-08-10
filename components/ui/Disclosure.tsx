'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'

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
  id,
  summary,
  children,
  className,
  summaryClassName,
  contentClassName,
  defaultOpen = false,
}: {
  /**
   * 2026-08-11 UI監査#1（a11y）: ページ内アンカーの着地点にする場合に指定する。
   * 指定すると、URLハッシュがこのidと一致した状態で読み込まれた／ハッシュが
   * このidへ変化したときに自動で開く。アンカーで飛んできた読者が「閉じた
   * 見出し」に着地して、目的の本文にもう1タップ必要になるのを防ぐ。
   * 既に #id にいる状態で自分で閉じ、同じリンクをもう一度踏んだ場合は
   * hashchange が発火しないため開かない（この経路は既に本文の直上にいるため実害なし）。
   */
  id?: string
  summary: ReactNode
  children: ReactNode
  className?: string
  summaryClassName?: string
  contentClassName?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  useEffect(() => {
    if (!id) return
    const syncFromHash = () => {
      if (window.location.hash === `#${id}`) setOpen(true)
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [id])

  return (
    <div id={id} className={className} data-state={open ? 'open' : 'closed'}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        className={summaryClassName}
        // 2026-07-29 CTO修正（Round6直後の実測確定バグ）: 実OSキーボードでフォーカス→Enterを
        // 押してもaria-expandedがfalseのまま変化しない事象をCEOが実機で確定させた。原因は
        // 「<button>への差し替え」自体ではなく、Safari(WebKit)がデフォルト設定
        // （システム環境設定「フルキーボードアクセス」オフ、多くのMacの初期値）では
        // ボタン等のフォームコントロールをTabキーのフォーカス移動対象から除外する既知の
        // 挙動にある。マウスクリックは正常に動く（クリックはTab移動を経由しないため）一方、
        // 実際のTabキー操作ではこの<button>にフォーカスが到達しない＝Enterを押しても
        // 何も起きないまま、という症状に一致する。明示的なtabIndex属性を付与すると、
        // WebKitはこのフォームコントロール除外ルールより著者の明示指定を優先し、
        // Full Keyboard Access設定に関わらずTabキーでの到達を保証する（他ブラウザは
        // native buttonが既定でtabIndex=0相当のため実害なし）。
        tabIndex={0}
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

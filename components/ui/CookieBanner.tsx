'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'

// ============================================================================
// Cookie同意バナー（2026-07-22 CTO監査で position:fixed の重なり不具合を修正）
//   このバナーは fixed で画面最下部に張り付く。従来は body側に余白を確保しておらず、
//   未同意の初回訪問者には「/company のモバイル下部タブナビ」「/signup のログイン導線・
//   同意テキスト」「/blog のカード末尾」など、各ページの最下部コンテンツがバナーの
//   裏に隠れて操作/閲覧できなくなっていた（本番スクリーンショットで実測確認）。
//   ResizeObserver でバナー自身の実高さを測り、<body> に同じ分だけ padding-bottom を
//   確保することで、常にバナーの上に本来のコンテンツが見える状態を保証する。
//   同意後（show=false）は padding を確実に解除する。
// ============================================================================
export function CookieBanner() {
  const [show, setShow] = useState(false)
  const [tabbarOffset, setTabbarOffset] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const acceptRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // 2026-07-23 ブランド移行: 旧キー memoly_cookie_accepted → banto_cookie_accepted。
    // 旧キーで同意済みの既存訪問者にバナーを再表示しないよう、旧キーがあれば
    // 新キーへ移行してから判定する（移行後は旧キーを削除）。
    let accepted = localStorage.getItem('banto_cookie_accepted')
    if (!accepted) {
      const legacy = localStorage.getItem('memoly_cookie_accepted')
      if (legacy) {
        localStorage.setItem('banto_cookie_accepted', legacy)
        localStorage.removeItem('memoly_cookie_accepted')
        accepted = legacy
      }
    }
    if (!accepted) setShow(true)
  }, [])

  // 2026-07-28 CTO修正（L1監査#14）: useEffect（コミット後・描画後に非同期実行）だと、
  //   バナー出現の初回フレームで body の padding-bottom がまだ反映されず、その一瞬
  //   バナーがCTA/下部コンテンツに重なって見えることがあった（ペルソナ1指摘）。
  //   useLayoutEffect（ブラウザが描画を確定する前に同期実行）に切り替え、
  //   paddingの確保とバナー表示を同じフレームで揃える（ロジック・キー・挙動は不変）。
  useLayoutEffect(() => {
    if (!show || !ref.current) {
      document.body.style.paddingBottom = ''
      return
    }
    const el = ref.current
    // /company のモバイル下部タブバー（id="banto-mobile-tabbar"）が同じ画面にある場合、
    // タブバーが lg 未満でのみ描画される（lg 以上では display:none で offsetHeight=0）ため、
    // このオフセットは自動的にブレークポイントへ追従する。無ければ 0（従来通り最下部に張り付く）。
    const measure = () => {
      const tabbar = document.getElementById('banto-mobile-tabbar')
      setTabbarOffset(tabbar?.offsetHeight ?? 0)
      document.body.style.paddingBottom = `${el.offsetHeight + (tabbar?.offsetHeight ?? 0)}px`
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const tabbarEl = document.getElementById('banto-mobile-tabbar')
    if (tabbarEl) ro.observe(tabbarEl)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      document.body.style.paddingBottom = ''
    }
  }, [show])

  // 2026-08-08 UXペルソナ監査: バナーはDOM上ページ本文の後に配置されており、
  //   キーボード利用者が「OK」に到達するには本文の全リンク・ボタンを
  //   Tabで通過する必要があった（約20回）。バナー表示時に「OK」へ直接
  //   フォーカスし、Tab移動なしで即座に同意操作できるようにする。
  useEffect(() => {
    if (show) acceptRef.current?.focus()
  }, [show])

  function accept() {
    localStorage.setItem('banto_cookie_accepted', '1')
    setShow(false)
  }

  if (!show) return null

  // 2026-07-23 A11: 初回表示を最小化（1行テキスト + ボタンの単一行）。
  //   従来はモバイルで2〜3行に折り返し、FV下端の占有が大きかった。文言を短縮し、
  //   縦paddingを詰め、常に横一列（テキストは truncate せず折返し許容だが短文で
  //   実質1行）にする。同意キー(banto_cookie_accepted・旧キー移行込み)と
  //   padding-bottom 確保の仕組みは従来のまま触らない。
  return (
    <div
      ref={ref}
      style={{ bottom: tabbarOffset }}
      // 2026-08-13 UXペルソナ監査 1-5 の是正。
      //   監査は「常時61px（667px画面の19%を常時占有）」としていたが、375x667 の
      //   本番実測では **61px＝9.1%**、かつ同意後は DOM ごと消えて body の
      //   padding-bottom も 0 に戻る（＝「常時」ではない）。数字と常時性は誤りだった。
      //   ただし初回訪問者の第1画面を 9.1% 削っているのは事実なので、44px の
      //   タップ標的（WCAG 2.5.5）を保ったまま器の縦paddingだけを詰める。
      //   py-2(8px×2) → py-0.5(2px×2) で 61px → 49px（7.3%）。
      //   タップ標的を縮めて数字を作らないこと（ボタンの min-h-11 は触らない）。
      className="fixed left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] px-4 py-0.5"
      role="banner"
      aria-label="Cookie使用の通知"
    >
      <div className="max-w-3xl mx-auto flex flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-neutral-600 leading-snug">
          ログイン維持にCookieを使用します（解析はCookie不使用の匿名計測です）。
          {/* 2026-08-12 UXペルソナ監査 R-8 で「h:14 で44px未満」と挙がったが、これは
              文中のインラインリンクで WCAG 2.5.8 の Inline 例外に当たる。ここを44pxにすると
              1行バナーの行ボックスが崩れ、R-16（バナーの占有を減らす）とも逆行するため
              意図的に据え置く。
              2026-08-19 UXペルソナ監査 I-2 再指摘への対応: 上記の判断（見た目の1行を
              崩さない）は維持しつつ、::beforeで不可視のタップ領域だけ広げる。このバナーの
              行はモバイルではOKボタンのmin-h-11(44px)で高さが44pxに決まっており、14pxの
              このリンクは既にその中で上下センタリングされている＝上下15pxずつは
              バナー自体の外へはみ出さない範囲。右は隣のOKボタンまでgap-3(12px)あるため
              6pxまでに抑え、左は隣接する非リンクの文中テキストへ4pxだけ広げる
              （そちらにも他のリンクは無い）。 */}
          <Link
            href="/privacy"
            className="relative text-brand-600 underline ml-1 before:absolute before:-top-[15px] before:-bottom-[15px] before:-left-1 before:-right-1.5 before:content-['']"
          >
            詳細
          </Link>
        </p>
        <button
          ref={acceptRef}
          onClick={accept}
          // 2026-07-30 UX監査 #8: 28x41 で推奨44px未満だった。バナーは全ページの
          //   最下部に常駐し、これを押さない限り画面下端が塞がったままになるため、
          //   「押しにくい閉じるボタン」の実害が最も大きい。モバイルのみ44x44にする。
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 sm:min-h-0 sm:min-w-0"
        >
          OK
        </button>
      </div>
    </div>
  )
}

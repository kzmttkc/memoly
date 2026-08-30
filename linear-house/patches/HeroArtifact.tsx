'use client'

import type { ReactNode } from 'react'
import { FileUp, LoaderCircle } from 'lucide-react'
import { LegalFold } from '../components/LegalFold'

type HeroArtifactProps = {
  days: number
  headline: ReactNode
  lead?: string
  busy: boolean
  drag: boolean
  legalOpen: boolean
  /** ドロップ面の hidden file input */
  fileInput: ReactNode
  onPick: () => void
  onSample: () => void
  onOpenPaste: () => void
  onDropFile: (file: File | undefined, many: boolean) => void
  onPasteClipboard: (data: DataTransfer | null) => boolean
  setDrag: (v: boolean) => void
  dragDepth: React.MutableRefObject<number>
  status?: ReactNode
  /** 枠の外・下線テキストの下に置く貼り付け UI */
  pastePanel: ReactNode
}

/**
 * 約束の下に、ドロップと見本を同じ12px枠へ入れる。
 * 規約はドロップと見本の間（選択前は閉じたまま）。
 * 本文を貼るは枠の外。
 */
export function HeroArtifact({
  days,
  headline,
  lead,
  busy,
  drag,
  legalOpen,
  fileInput,
  onPick,
  onSample,
  onOpenPaste,
  onDropFile,
  onPasteClipboard,
  setDrag,
  dragDepth,
  status,
  pastePanel,
}: HeroArtifactProps) {
  return (
    <div className="zure-hero zure-hero-enter">
      <h1 className="text-[2rem] font-semibold leading-[1.3] tracking-tight text-[#171717] sm:text-4xl">
        {headline}
      </h1>
      {lead ? <p className="mt-3 text-sm leading-relaxed text-[var(--lh-muted)]">{lead}</p> : null}
      {status}

      <div className="lh-frame zure-drop-chrome mt-8">
        <div
          data-drop
          role="group"
          aria-labelledby="zure-drop-label"
          aria-busy={busy}
          tabIndex={0}
          onDragEnter={e => {
            e.preventDefault()
            dragDepth.current += 1
            setDrag(true)
          }}
          onDragOver={e => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1)
            if (dragDepth.current === 0) setDrag(false)
          }}
          onClick={e => {
            if ((e.target as HTMLElement).closest('button,a,summary')) return
            onPick()
          }}
          onKeyDown={e => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            if ((e.target as HTMLElement).closest('button')) return
            e.preventDefault()
            onPick()
          }}
          onPaste={e => {
            if (onPasteClipboard(e.clipboardData)) e.preventDefault()
          }}
          onDrop={e => {
            e.preventDefault()
            dragDepth.current = 0
            setDrag(false)
            const files = e.dataTransfer.files
            onDropFile(files[0], files.length > 1)
          }}
          className={`flex min-h-52 cursor-pointer flex-col items-center justify-center border border-solid border-transparent px-6 text-center outline-none transition-colors focus-visible:border-[var(--lh-ink)] focus-visible:ring-2 focus-visible:ring-[var(--lh-ink)]/10 ${
            drag ? 'bg-[var(--lh-fill)]' : 'bg-[var(--lh-canvas)]'
          }`}
        >
          <FileUp className="h-7 w-7 text-[var(--lh-ink)]" aria-hidden />
          <p id="zure-drop-label" className="mt-3 text-sm font-semibold text-[var(--lh-ink)]">
            {busy ? '読んでいます…' : '就業規則のファイルをここに置く'}
          </p>
          <p className="mt-1 text-xs text-[var(--lh-muted)]">PDF・Word（.docx）・テキスト。8MBまで。</p>
          {fileInput}
          <button
            id="zure-file-pick"
            type="button"
            data-cta="place"
            className="lh-btn lh-btn-ink mt-4 h-10 rounded-[12px] px-3.5"
            disabled={busy}
            onClick={onPick}
          >
            ファイルを選ぶ
          </button>
          {busy && <LoaderCircle className="mt-3 h-5 w-5 animate-spin text-[var(--lh-ink)]" aria-hidden />}
        </div>

        <LegalFold open={legalOpen} />

        <div className="mt-6 border-t border-[var(--lh-line)] pt-6">
          <p className="text-xs text-[var(--lh-muted)]">
            ずれ1枚の見本 · 施行まで <strong className="font-semibold tabular-nums text-[var(--lh-ink)]">{days}</strong>
            日 · 表示の例です
          </p>
          <ol className="mt-3 divide-y divide-[var(--lh-line)] border border-[var(--lh-line)]">
            <li className="px-3 py-2.5 text-sm text-[var(--lh-ink)]">
              <span className="zure-lp-tag">触れていない</span>
              カスタマーハラスメントの方針
            </li>
            <li className="px-3 py-2.5 text-sm text-[var(--lh-ink)]">
              <span className="zure-lp-tag">規程にある</span>
              始業・終業の時刻
            </li>
            <li className="px-3 py-2.5 text-sm text-[var(--lh-ink)]">
              <span className="zure-lp-tag">運用不足</span>
              年5日の有給取得
            </li>
          </ol>
          <p className="mt-3">
            <button
              type="button"
              data-sample-link
              className="text-sm text-[var(--lh-ink)] underline underline-offset-2 hover:opacity-80"
              disabled={busy}
              onClick={onSample}
            >
              サンプルで見え方だけ確かめる
            </button>
          </p>
        </div>
      </div>

      <p className="zure-drop-chrome mt-4">
        <button
          type="button"
          className="text-sm text-[var(--lh-ink)] underline underline-offset-2"
          onClick={onOpenPaste}
        >
          本文を貼る
        </button>
      </p>
      {pastePanel}
    </div>
  )
}

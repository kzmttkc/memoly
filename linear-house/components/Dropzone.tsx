'use client'

import type { ReactNode } from 'react'

type DropzoneProps = {
  busy: boolean
  drag: boolean
  hasSheet: boolean
  children?: ReactNode
  onPick: () => void
  onDropFile: (file: File | undefined, many: boolean) => void
  onPasteClipboard: (data: DataTransfer | null) => boolean
  fileInput: ReactNode
}

/** 置く面 — Linear 枠内のドロップ */
export function Dropzone({
  busy,
  drag,
  hasSheet,
  children,
  onPick,
  onDropFile,
  onPasteClipboard,
  fileInput,
}: DropzoneProps) {
  return (
    <div
      role="group"
      aria-labelledby="zure-drop-label"
      aria-busy={busy}
      tabIndex={0}
      onClick={e => {
        if ((e.target as HTMLElement).closest('button,a,summary,textarea,input')) return
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
      onDragOver={e => {
        e.preventDefault()
      }}
      onDrop={e => {
        e.preventDefault()
        const files = e.dataTransfer.files
        onDropFile(files[0], files.length > 1)
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-[var(--lh-radius)] border border-dashed px-6 text-center outline-none transition-colors focus-visible:border-[var(--lh-ink)] focus-visible:ring-2 focus-visible:ring-[var(--lh-ink)]/10 ${
        hasSheet ? 'min-h-0 py-6' : 'min-h-52'
      } ${drag ? 'border-[var(--lh-ink)] bg-[var(--lh-fill)]' : 'border-[var(--lh-line)] bg-[var(--lh-canvas)]'}`}
    >
      <p id="zure-drop-label" className="text-sm font-semibold text-[var(--lh-ink)]">
        {busy ? '読んでいます…' : hasSheet ? '別のファイルを置く' : '就業規則のファイルをここに置く'}
      </p>
      <p className="mt-1 text-xs text-[var(--lh-muted)]">
        PDF・Word（.docx）・テキスト。8MBまで。画像やPagesは置けません。
      </p>
      {fileInput}
      <button
        id="zure-file-pick"
        type="button"
        className="lh-btn lh-btn-ink mt-4"
        disabled={busy}
        onClick={onPick}
      >
        ファイルを選ぶ
      </button>
      {children}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FileUp, LoaderCircle } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { track, trackOncePerVisit } from '@/lib/analytics'
import { KasuharaGap } from './KasuharaGap'
import {
  HERO,
  HERO_EN,
  KABAU_LINE,
  OFFER,
  ZURE_LEAD,
} from '@/lib/offer'
import { createClient } from '@/lib/supabase'
import {
  fileFromPastedText,
  sniffKind,
  unreadNoteForUnsupported,
  plainTextFromClipboardData,
  emptyOrFolderNote,
} from '@/lib/document-extract'
import {
  savePendingZure,
  readPendingZure,
  clearPendingZure,
  pendingRemainingHours,
} from '@/lib/zure-pending'
import { retryUntilMs, retryWaitMessage } from '@/lib/zure-rate-limit'
import { ZURE_SAMPLE_FILENAME, ZURE_SAMPLE_TEXT, isZureSampleFilename } from '@/lib/zure-sample'
import { DISCLAIMER } from '@/lib/gap-engine/taxonomy/items'
import { heuristicGapSheet } from '@/lib/gap-engine/fallback'
import { sortBlocks, blockLine } from '@/lib/gap-engine/ui/renderSheet'
import type { GapSheet } from '@/lib/gap-engine/engine/types'
import type { LpVariant } from '@/app/business/_lib/variant-shared'
import { ZureLpBelow } from './ZureLpBelow'
import { LegalFold } from '@/linear-house/components/LegalFold'
import { GapSheetView } from '@/linear-house/components/GapSheet'
import { HeroArtifact } from '@/linear-house/patches/HeroArtifact'

const ACCEPT =
  '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

function isGapSheet(v: unknown): v is GapSheet {
  return !!v && typeof v === 'object' && Array.isArray((v as GapSheet).blocks)
}

function sheetTitle(sheet: GapSheet): string {
  const guess = sheet.document?.title_guess?.trim()
  if (guess) return `${guess.replace(/\.[^.]+$/, '')}のずれ1枚`
  return sheet.summary?.headline || 'ずれ1枚'
}

function sheetPlainText(sheet: GapSheet): string {
  const lines = sortBlocks(sheet)
    .map(b => {
      const body = [b.what_found, b.what_not_found, b.next_step].filter(Boolean).join('\n')
      return `・${blockLine(b.status, b.title)}\n${body}`
    })
    .join('\n\n')
  const unread = sheet.summary?.unread_note ? `\n\n未読: ${sheet.summary.unread_note}` : ''
  return `${sheetTitle(sheet)}\n\n${lines}${unread}\n\n${DISCLAIMER}\n`
}

function trackSheetEvents(
  sheet: GapSheet,
  source: string,
  extra?: { ms?: number; engine?: string },
) {
  track('zure_sheet_shown', {
    rows: sheet.blocks.length,
    source,
    engine: extra?.engine ?? 'unknown',
  })
  const p0 = sheet.blocks.filter(b => b.priority === 'p0_deadline' && b.status !== 'written')
  const p1 = sheet.blocks.filter(b => b.priority === 'p1_absolute' && b.status !== 'written')
  track('zure_sheet_generated', {
    ms: extra?.ms ?? 0,
    pages_read: sheet.document?.pages_read ?? 0,
    pages_unread: sheet.document?.pages_unread?.length ?? 0,
    p0_unwritten: p0.length,
    p1_unwritten: p1.length,
  })
  const kasu = sheet.blocks.filter(
    b => b.group === 'kasuhara_2026_10' && b.status !== 'written' && b.status !== 'not_applicable',
  )
  track('zure_kasuhara_block_shown', { unwritten_count: kasu.length })
}

export function ZureDrop({ variant, days }: { variant: LpVariant; days: number }) {
  const params = useSearchParams()
  const fromKabau = params.get('utm_source') === 'kabau'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageWarn, setStorageWarn] = useState(false)
  const [sheet, setSheet] = useState<GapSheet | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [drag, setDrag] = useState(false)
  const [manyFiles, setManyFiles] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [restored, setRestored] = useState(false)
  const [paste, setPaste] = useState('')
  const [pasteNote, setPasteNote] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [remainHours, setRemainHours] = useState<number | null>(null)
  const [clearAsk, setClearAsk] = useState(false)
  const [picked, setPicked] = useState(false)
  const sheetRef = useRef<HTMLElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const pasteBoxRef = useRef<HTMLDetailsElement>(null)
  const dragDepth = useRef(0)
  const retryUntilRef = useRef(0)

  const isEn = params.get('lang') === 'en'
  const headline = isEn
    ? variant === 'B'
      ? HERO_EN.B
      : HERO_EN.A
    : variant === 'B'
      ? HERO.B
      : HERO.A

  useEffect(() => {
    void createClient()
      .auth.getSession()
      .then(({ data }) => setAuthed(!!data.session))
      .catch(() => setAuthed(false))
  }, [])

  useEffect(() => {
    const pending = readPendingZure()
    if (!pending) return
    setPendingText(pending.text)
    if (isGapSheet(pending.gapSheet)) {
      setSheet(pending.gapSheet)
    } else {
      setSheet(
        heuristicGapSheet({
          text: pending.text,
          titleGuess: pending.filename,
        }),
      )
    }
    setRestored(true)
    setRemainHours(pendingRemainingHours(pending))
  }, [])

  const utmSource = params.get('utm_source') ?? ''
  const utmMedium = params.get('utm_medium') ?? ''
  const fromReferral = !!utmSource || utmMedium === 'cta'

  useEffect(() => {
    const props: Record<string, string> = {}
    if (utmSource) props.source = utmSource.slice(0, 60)
    if (utmMedium) props.medium = utmMedium.slice(0, 60)
    trackOncePerVisit('zure_landing', Object.keys(props).length ? props : undefined)
  }, [utmSource, utmMedium])

  useEffect(() => {
    if (sheet || restored || busy) return
    if (!fromReferral) return
    const box = pasteBoxRef.current
    if (box) box.open = true
  }, [sheet, restored, busy, fromReferral])

  useEffect(() => {
    if (!sheet || restored) return
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sheetRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    sheetRef.current?.focus({ preventScroll: true })
  }, [sheet, restored])

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file || busy) return
      const waitMsg = retryWaitMessage(retryUntilRef.current, Date.now())
      if (waitMsg) {
        setError(waitMsg)
        return
      }
      const emptyNote = emptyOrFolderNote(file)
      if (emptyNote) {
        setError(emptyNote)
        return
      }
      if (sniffKind(file.name, file.type) === 'unsupported') {
        setError(unreadNoteForUnsupported(file.name))
        return
      }
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
        setError(unreadNoteForUnsupported(file.name))
        return
      }
      if (file.size > 8 * 1024 * 1024) {
        setError('ファイルは8MBまでです。圧縮するか、テキストに書き出してください。')
        return
      }
      setBusy(true)
      setPicked(true)
      setError(null)
      setStorageWarn(false)
      setRestored(false)
      setCopied(false)
      setClearAsk(false)
      setRemainHours(null)
      if (file.name !== 'pasted.txt' && !isZureSampleFilename(file.name)) setPasteNote(null)
      try {
        const form = new FormData()
        form.set('file', file)
        const res = await fetch('/api/zure/extract', { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (res.status === 429) {
          const until = retryUntilMs(res.headers.get('Retry-After'), Date.now())
          if (until) retryUntilRef.current = until
        }
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'ファイルを読めませんでした。')
          return
        }
        const nextSheet = isGapSheet(data.gapSheet)
          ? data.gapSheet
          : heuristicGapSheet({
              text: String(data.text ?? ''),
              titleGuess: String(data.filename ?? file.name),
            })
        setSheet(nextSheet)
        setPendingText(String(data.text ?? ''))
        const saved = savePendingZure({
          filename: String(data.filename ?? file.name),
          text: String(data.text ?? ''),
          unreadNote: typeof data.unreadNote === 'string' ? data.unreadNote : null,
          gapSheet: nextSheet,
        })
        setStorageWarn(!saved)
        if (saved) setRemainHours(pendingRemainingHours({ savedAt: Date.now() }))
        const source = isZureSampleFilename(file.name)
          ? 'sample'
          : file.name === 'pasted.txt'
            ? 'paste'
            : 'file'
        trackSheetEvents(nextSheet, source, {
          ms: typeof data.ms === 'number' ? data.ms : 0,
          engine: typeof data.engine === 'string' ? data.engine : undefined,
        })
      } catch {
        setError('通信を確認してください。同じファイルをもう一度置くか、本文を貼ってください。')
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )

  function submitPaste(raw: string, filename = 'pasted.txt') {
    const result = fileFromPastedText(raw)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPasteNote(
      isZureSampleFilename(filename)
        ? 'これは架空のサンプル本文です。自社のファイルや本文に差し替えられます。'
        : result.truncated
          ? '先頭10万字まで使いました。'
          : null,
    )
    setPaste('')
    const file = isZureSampleFilename(filename)
      ? new File([raw.replace(/^\uFEFF/, '').trim()], filename, { type: 'text/plain' })
      : result.file
    void onFile(file)
  }

  function runSample() {
    track('zure_sample_clicked')
    submitPaste(ZURE_SAMPLE_TEXT, ZURE_SAMPLE_FILENAME)
  }

  function ingestClipboard(data: DataTransfer | null): boolean {
    if (!data || busy) return false
    const pastedFile = data.files?.[0]
    if (pastedFile) {
      setManyFiles(data.files.length > 1)
      void onFile(pastedFile)
      return true
    }
    const text = plainTextFromClipboardData(t => data.getData(t))
    if (!text.trim()) return false
    submitPaste(text)
    return true
  }

  useEffect(() => {
    function onWinPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null
      if (t?.closest('textarea, input, [contenteditable="true"]')) return
      if (ingestClipboard(e.clipboardData)) e.preventDefault()
    }
    window.addEventListener('paste', onWinPaste)
    return () => window.removeEventListener('paste', onWinPaste)
  }, [busy])

  function openPaste() {
    const box = pasteBoxRef.current
    if (box) box.open = true
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    box?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    pasteRef.current?.focus({ preventScroll: true })
  }

  const saveHref = useMemo(() => {
    if (authed) return '/company'
    const q = new URLSearchParams(params.toString())
    q.set('next', '/company')
    q.set('intent', 'zure')
    return `${OFFER.signupPath.split('?')[0]}?${q.toString()}`
  }, [params, authed])

  function onSaveClick() {
    track('signup_cta_clicked', { location: 'zure_save' })
    track('zure_save_clicked', { authed: authed ? '1' : '0' })
    if (sheet && pendingText) {
      void fetch('/api/zure/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet, text: pendingText }),
      }).catch(() => {})
    }
  }

  function downloadSheet() {
    if (!sheet) return
    const blob = new Blob([sheetPlainText(sheet)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sheetTitle(sheet).replace(/[/\\?%*:|"<>]/g, '').slice(0, 40)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    track('zure_sheet_downloaded')
  }

  function printSheet() {
    window.print()
    track('zure_sheet_printed')
  }

  async function shareSheet() {
    if (!sheet) return
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: sheetTitle(sheet), text: sheetPlainText(sheet) })
        track('zure_sheet_shared')
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    await copySheet()
  }

  async function copySheet() {
    if (!sheet) return
    try {
      await navigator.clipboard.writeText(sheetPlainText(sheet))
      setCopied(true)
      track('zure_sheet_copied')
      window.setTimeout(() => setCopied(false), 4000)
    } catch {
      setCopied(false)
      setError('コピーできませんでした。1枚を保存からテキストで残してください。')
    }
  }

  const legalOpen = picked || busy || !!sheet

  const headlineNode = headline.includes('。') ? (
    <>
      {headline.replace(/。$/, '').split('、')[0]}、
      <br />
      {headline.replace(/。$/, '').split('、').slice(1).join('、') || 'ずれが1枚になる'}
      。
    </>
  ) : (
    headline
  )

  const fileInput = (
    <input
      id="zure-file"
      ref={fileRef}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      disabled={busy}
      onChange={e => {
        setManyFiles(false)
        void onFile(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  const pastePanel = (
    <details ref={pasteBoxRef} className="zure-drop-chrome mt-3 text-sm leading-relaxed text-[var(--lh-muted)]">
      <summary className="sr-only">本文の貼り付け欄</summary>
      <label htmlFor="zure-paste" className="mt-2 block text-sm font-medium text-[var(--lh-ink)]">
        就業規則の本文
      </label>
      <textarea
        id="zure-paste"
        ref={pasteRef}
        value={paste}
        rows={8}
        disabled={busy}
        onChange={e => setPaste(e.target.value)}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            submitPaste(paste)
          }
        }}
        className="mt-2 w-full rounded-[var(--lh-radius)] border border-[var(--lh-line)] bg-[var(--lh-canvas)] px-3 py-2 text-sm leading-relaxed text-[var(--lh-ink)] outline-none focus-visible:border-[var(--lh-ink)] focus-visible:ring-2 focus-visible:ring-[var(--lh-ink)]/10 disabled:opacity-60"
        placeholder="ここに本文を貼る"
      />
      <p className="mt-1 text-xs text-[var(--lh-muted)]">
        {paste.length.toLocaleString('ja-JP')}字。先頭10万字まで使います。
      </p>
      <button
        type="button"
        className="lh-btn lh-btn-ghost mt-3"
        disabled={busy}
        onClick={() => submitPaste(paste)}
      >
        このテキストから1枚にする
      </button>
      <p className="mt-2 text-xs text-[var(--lh-muted)]">⌘Enter または Ctrl+Enter でも進めます。</p>
    </details>
  )

  const statusBits = (
    <>
      {fromKabau && (
        <p className="mt-4 text-sm leading-relaxed text-[var(--lh-muted)]">{KABAU_LINE}</p>
      )}
      {isEn && (
        <p className="mt-4 rounded-[var(--lh-radius)] border border-[var(--lh-line)] bg-[var(--lh-fill)] px-4 py-3 text-sm leading-relaxed text-[var(--lh-muted)]">
          The form below is in Japanese. You can still place a PDF, Word (.docx), or text file, or paste
          the text. Sign-up comes after the one-page sheet.
        </p>
      )}
      {restored && sheet && (
        <p
          className="mt-4 rounded-[var(--lh-radius)] border border-[var(--lh-line)] bg-[var(--lh-fill)] px-4 py-3 text-sm leading-relaxed text-[var(--lh-ink)]"
          role="status"
        >
          このブラウザに控えていた1枚です。
          {remainHours != null
            ? `あと約${remainHours}時間、この端末に残ります。`
            : '24時間を過ぎた場合は、もう一度ファイルを置いてください。'}
          確認メールのリンクは、同じブラウザで開いてください。別の端末では、もう一度ファイルを置いてください。
        </p>
      )}
      {manyFiles && (
        <p className="mt-4 text-sm text-[var(--lh-muted)]" role="status">
          一度に置けるのは1ファイルです。先頭のファイルを読みました。
        </p>
      )}
      {pasteNote && (
        <p className="mt-4 text-sm text-[var(--lh-muted)]" role="status">
          {pasteNote}
        </p>
      )}
      {error && !sheet && (
        <p className="mt-4 text-sm text-[var(--lh-danger)]" role="alert">
          {error}
        </p>
      )}
      {storageWarn && !sheet && (
        <p className="mt-4 text-sm text-[var(--lh-muted)]" role="alert">
          この端末では一時控えを持てませんでした。画面の1枚は残っています。登録のあとに、同じファイルを書類へ置いてください。
        </p>
      )}
    </>
  )

  return (
    <div className="zure-lp">
      <div className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
        <a
          href="#zure-file-pick"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--lh-radius)] focus:bg-[var(--lh-ink)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          ファイルを置く場所へ
        </a>
        <a
          href="#zure-paste"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-16 focus:z-50 focus:rounded-[var(--lh-radius)] focus:bg-[var(--lh-ink)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
          onClick={e => {
            e.preventDefault()
            openPaste()
          }}
        >
          本文を貼る場所へ
        </a>

        {!sheet ? (
          <HeroArtifact
            days={days}
            headline={headlineNode}
            lead={ZURE_LEAD}
            busy={busy}
            drag={drag}
            legalOpen={legalOpen}
            fileInput={fileInput}
            onPick={() => fileRef.current?.click()}
            onSample={runSample}
            onOpenPaste={openPaste}
            onDropFile={(file, many) => {
              setManyFiles(many)
              void onFile(file)
            }}
            onPasteClipboard={ingestClipboard}
            setDrag={setDrag}
            dragDepth={dragDepth}
            status={statusBits}
            pastePanel={pastePanel}
          />
        ) : (
          <>
            <h1 className="text-[2rem] font-semibold leading-[1.3] tracking-tight text-[var(--lh-ink)] sm:text-4xl">
              {headlineNode}
            </h1>
            {statusBits}
            <div className="lh-frame zure-drop-chrome mt-8">
              <div
                role="group"
                aria-labelledby="zure-drop-label"
                aria-busy={busy}
                tabIndex={0}
                onClick={e => {
                  if ((e.target as HTMLElement).closest('button')) return
                  fileRef.current?.click()
                }}
                onKeyDown={e => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  fileRef.current?.click()
                }}
                onDrop={e => {
                  e.preventDefault()
                  const files = e.dataTransfer.files
                  setManyFiles(files.length > 1)
                  void onFile(files[0])
                }}
                onDragOver={e => e.preventDefault()}
                className="flex min-h-0 cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--lh-line)] px-6 py-6 text-center"
              >
                <p id="zure-drop-label" className="text-sm font-semibold text-[var(--lh-ink)]">
                  {busy ? '読んでいます…' : '別のファイルを置く'}
                </p>
                {fileInput}
                <button
                  id="zure-file-pick"
                  type="button"
                  data-cta="place"
                  className="lh-btn lh-btn-ink mt-4"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  ファイルを選ぶ
                </button>
              </div>
              <LegalFold open={legalOpen} />
              <div className="mt-8 border-t border-[var(--lh-line)] pt-8">
                <section ref={sheetRef}>
                  <GapSheetView
                    sheet={sheet}
                    days={days}
                    footer={
                      <>
                        {busy && (
                          <p className="zure-drop-chrome mt-4 text-sm text-[var(--lh-muted)]" role="status">
                            読んでいます…
                          </p>
                        )}
                        {error && (
                          <p className="zure-drop-chrome mt-4 text-sm text-[var(--lh-danger)]" role="alert">
                            {error}
                          </p>
                        )}
                        <div className="zure-drop-chrome mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <Link
                            href={saveHref}
                            className={buttonClass({
                              variant: 'primary',
                              size: 'lg',
                              className: 'w-full whitespace-normal text-center sm:flex-1 !rounded-[12px]',
                            })}
                            onClick={onSaveClick}
                          >
                            {authed ? 'この1枚を会社に残す' : OFFER.saveCta}
                          </Link>
                          <button
                            type="button"
                            className={buttonClass({
                              variant: 'secondary',
                              size: 'lg',
                              className: 'w-full sm:w-auto !rounded-[12px]',
                            })}
                            onClick={downloadSheet}
                          >
                            1枚を保存
                          </button>
                          <button
                            type="button"
                            className={buttonClass({
                              variant: 'secondary',
                              size: 'lg',
                              className: 'w-full sm:w-auto !rounded-[12px]',
                            })}
                            onClick={() => void copySheet()}
                          >
                            1枚をコピー
                          </button>
                          <button
                            type="button"
                            className={buttonClass({
                              variant: 'secondary',
                              size: 'lg',
                              className: 'w-full sm:w-auto !rounded-[12px]',
                            })}
                            onClick={printSheet}
                          >
                            印刷する
                          </button>
                        </div>
                        {copied && (
                          <p className="zure-drop-chrome mt-2 text-center text-sm text-[var(--lh-muted)]" role="status">
                            コピーしました。メールやチャットに貼れます。
                          </p>
                        )}
                        <p className="zure-drop-chrome mt-2 text-center text-xs text-[var(--lh-muted)]">
                          {authed
                            ? '会社の書類台帳の最初の1枚として残します。'
                            : '残すときに登録します。台帳が始まります。チャットはまだ開きません。'}
                        </p>
                        <p className="zure-drop-chrome mt-3 text-center text-xs text-[var(--lh-muted)]">
                          <Link
                            href="/offer"
                            className="underline underline-offset-2"
                            onClick={() => track('offer_nav_clicked', { location: 'zure_after_sheet' })}
                          >
                            無料と有料の違い
                          </Link>
                        </p>
                        <div className="zure-drop-chrome">
                          <button
                            type="button"
                            className="mt-4 text-sm text-[var(--lh-ink)] underline underline-offset-2"
                            onClick={() => fileRef.current?.click()}
                          >
                            別のファイルを置く
                          </button>
                          <button
                            type="button"
                            className="mt-4 ml-4 text-sm text-[var(--lh-ink)] underline underline-offset-2"
                            onClick={openPaste}
                          >
                            本文を貼り直す
                          </button>
                          <button
                            type="button"
                            className="mt-4 ml-4 text-sm text-[var(--lh-ink)] underline underline-offset-2"
                            onClick={() => void shareSheet()}
                          >
                            共有する
                          </button>
                          {clearAsk ? (
                            <p className="mt-4 text-sm text-[var(--lh-ink)]">
                              この控えを消しますか。消すと、この画面の1枚も消えます。
                              <button
                                type="button"
                                className="ml-3 text-sm text-[var(--lh-danger)] underline underline-offset-2"
                                onClick={() => {
                                  clearPendingZure()
                                  setSheet(null)
                                  setPendingText('')
                                  setRestored(false)
                                  setError(null)
                                  setClearAsk(false)
                                  setRemainHours(null)
                                  setPicked(false)
                                }}
                              >
                                消す
                              </button>
                              <button
                                type="button"
                                className="ml-3 text-sm text-[var(--lh-muted)] underline underline-offset-2"
                                onClick={() => setClearAsk(false)}
                              >
                                やめる
                              </button>
                            </p>
                          ) : (
                            <button
                              type="button"
                              className="mt-4 ml-4 text-sm text-[var(--lh-muted)] underline underline-offset-2"
                              onClick={() => setClearAsk(true)}
                            >
                              この控えを消す
                            </button>
                          )}
                        </div>
                        <KasuharaGap />
                      </>
                    }
                  />
                </section>
              </div>
            </div>
            {pastePanel}
          </>
        )}
      </div>

      {!sheet && <ZureLpBelow />}

      {!sheet && (
        <div className="zure-sticky-cta zure-drop-chrome">
          <button
            type="button"
            data-cta="place"
            className="lh-btn lh-btn-ink w-full"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            ファイルを置く
          </button>
        </div>
      )}
    </div>
  )
}

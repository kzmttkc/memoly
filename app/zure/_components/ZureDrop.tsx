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

const ACCEPT =
  '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

const STATUS_CLASS: Record<string, string> = {
  written: 'bg-neutral-100 text-neutral-700',
  ops_missing: 'bg-brand-50 text-brand-800',
  unmentioned: 'bg-neutral-100 text-neutral-600',
  unread: 'bg-warning-50 text-warning-700',
  not_applicable: 'bg-neutral-50 text-neutral-500',
}

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

export function ZureDrop({ variant }: { variant: LpVariant }) {
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

  const sortedBlocks = useMemo(() => (sheet ? sortBlocks(sheet) : []), [sheet])

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

  return (
    <div className="zure-lp">
    <div className="mx-auto max-w-2xl px-6 py-8 sm:py-12">
      <div className="zure-drop-chrome zure-hero-enter">
        <a
          href="#zure-file-pick"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--zure-vermilion)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          ファイルを置く場所へ
        </a>
        <a
          href="#zure-paste"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-16 focus:z-50 focus:rounded-lg focus:bg-[var(--zure-vermilion)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
          onClick={e => {
            e.preventDefault()
            openPaste()
          }}
        >
          本文を貼る場所へ
        </a>
        <p className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--zure-ink)] sm:text-xl">
          <span className="zure-lp-serif flex h-8 w-8 items-center justify-center rounded-md bg-[var(--zure-ink)] text-sm text-[var(--zure-paper)]">
            就
          </span>
          就業規則AI
        </p>
        <p className="mt-5 text-sm tracking-wide text-[var(--zure-ink-soft)]">登録不要 · クレジットカード不要</p>
        <h1 className="zure-lp-serif mt-3 text-[2rem] font-semibold leading-[1.25] tracking-tight text-[var(--zure-ink)] sm:text-4xl">
          {headline.includes('。') ? (
            <>
              {headline.replace(/。$/, '').split('、')[0]}、
              <br />
              {headline.replace(/。$/, '').split('、').slice(1).join('、') || 'ずれが1枚になる'}
              。
            </>
          ) : (
            headline
          )}
        </h1>
        {fromKabau && (
          <p className="mt-4 text-sm leading-relaxed text-[var(--zure-ink-soft)]">{KABAU_LINE}</p>
        )}
        {isEn && (
          <p className="mt-4 border border-[var(--zure-line)] bg-[var(--zure-paper-card)] px-4 py-3 text-sm leading-relaxed text-[var(--zure-ink-soft)]">
            The form below is in Japanese. You can still place a PDF, Word (.docx), or text file, or paste
            the text. Sign-up comes after the one-page sheet.
          </p>
        )}
        {restored && sheet && (
          <p
            className="mt-4 border border-[var(--zure-line)] bg-[var(--zure-paper-card)] px-4 py-3 text-sm leading-relaxed text-[var(--zure-ink)]"
            role="status"
          >
            このブラウザに控えていた1枚です。
            {remainHours != null
              ? `あと約${remainHours}時間、この端末に残ります。`
              : '24時間を過ぎた場合は、もう一度ファイルを置いてください。'}
            確認メールのリンクは、同じブラウザで開いてください。別の端末では、もう一度ファイルを置いてください。
          </p>
        )}
        {!sheet && (
          <>
            <p className="mt-4 text-base leading-relaxed text-[var(--zure-ink-soft)]">{ZURE_LEAD}</p>
            <p className="mt-3">
              <button
                type="button"
                className="text-sm font-medium text-[var(--zure-vermilion)] underline underline-offset-2 hover:opacity-90"
                disabled={busy}
                onClick={runSample}
              >
                手元にファイルが無いときは、サンプルで見え方だけ確かめる
              </button>
            </p>
            <details className="mt-4 text-sm text-[var(--zure-ink-soft)]">
              <summary className="cursor-pointer font-medium text-[var(--zure-ink)]">
                置くときの扱い（保存のタイミング）
              </summary>
              <p className="mt-2 leading-relaxed">
                置いたファイルは、残す操作の前にサーバへ保存しません。このブラウザに24時間だけ控え、残す操作のあとで会社の書類へ移します。同じ回線から1時間に8回まで置けます。共有のパソコンでは、残す操作までこの画面を閉じないでください。読めなかったページは未読として残します。
              </p>
            </details>
          </>
        )}
        {!sheet && manyFiles && (
          <p className="mt-4 text-sm text-[var(--zure-ink-soft)]" role="status">
            一度に置けるのは1ファイルです。先頭のファイルを読みました。
          </p>
        )}
        {!sheet && pasteNote && (
          <p className="mt-4 text-sm text-[var(--zure-ink-soft)]" role="status">
            {pasteNote}
          </p>
        )}
        {!sheet && error && (
          <p className="mt-4 text-sm text-danger-700" role="alert">
            {error}
          </p>
        )}
        {!sheet && storageWarn && (
          <p className="mt-4 text-sm text-warning-700" role="alert">
            この端末では一時控えを持てませんでした。画面の1枚は残っています。登録のあとに、同じファイルを書類へ置いてください。
          </p>
        )}
      </div>

      {sheet && (
        <section
          ref={sheetRef}
          tabIndex={-1}
          className="zure-sheet mt-10 border-t border-neutral-200 pt-8 outline-none"
          aria-live="polite"
        >
          <h2 className="text-lg font-semibold text-neutral-900">{sheetTitle(sheet)}</h2>
          {sheet.summary?.unread_note && (
            <p className="mt-2 text-sm text-warning-800">{sheet.summary.unread_note}</p>
          )}
          <ol className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
            {sortedBlocks.map(block => (
              <li
                key={block.id}
                className={block.priority === 'p0_deadline' ? 'bg-brand-50/40 py-3' : 'py-3'}
              >
                <p className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-neutral-900">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[block.status] ?? STATUS_CLASS.unmentioned}`}
                  >
                    {blockLine(block.status, '').trim() || block.status}
                  </span>
                  {block.title}
                  {block.deadline && (
                    <span className="text-xs font-normal text-brand-700">期限 {block.deadline}</span>
                  )}
                </p>
                {block.what_found ? (
                  <p className="mt-1 text-sm leading-relaxed text-neutral-700">{block.what_found}</p>
                ) : null}
                {block.what_not_found ? (
                  <p className="mt-1 text-sm leading-relaxed text-neutral-700">{block.what_not_found}</p>
                ) : null}
                {block.next_step ? (
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">次: {block.next_step}</p>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-neutral-500">{DISCLAIMER}</p>
          {busy && (
            <p className="zure-drop-chrome mt-4 text-sm text-neutral-700" role="status">
              読んでいます…
            </p>
          )}
          {error && (
            <p className="zure-drop-chrome mt-4 text-sm text-danger-700" role="alert">
              {error}
            </p>
          )}
          <div className="zure-drop-chrome mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={saveHref}
              className={buttonClass({
                variant: 'primary',
                size: 'lg',
                className: 'w-full whitespace-normal text-center sm:flex-1',
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
                className: 'w-full sm:w-auto',
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
                className: 'w-full sm:w-auto',
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
                className: 'w-full sm:w-auto',
              })}
              onClick={printSheet}
            >
              印刷する
            </button>
          </div>
          {copied && (
            <p className="zure-drop-chrome mt-2 text-center text-sm text-neutral-700" role="status">
              コピーしました。メールやチャットに貼れます。
            </p>
          )}
          <p className="zure-drop-chrome mt-2 text-center text-xs text-neutral-500">
            {authed
              ? '会社の書類台帳の最初の1枚として残します。'
              : '残すときに登録します。台帳が始まります。チャットはまだ開きません。'}
          </p>
          <p className="zure-drop-chrome mt-3 text-center text-xs text-neutral-500">
            <Link
              href="/offer"
              className="text-brand-700 underline underline-offset-2"
              onClick={() => track('offer_nav_clicked', { location: 'zure_after_sheet' })}
            >
              無料と有料の違い
            </Link>
          </p>
          <div className="zure-drop-chrome">
            <button
              type="button"
              className="mt-4 text-sm text-brand-700 underline underline-offset-2"
              onClick={() => fileRef.current?.click()}
            >
              別のファイルを置く
            </button>
            <button
              type="button"
              className="mt-4 ml-4 text-sm text-brand-700 underline underline-offset-2"
              onClick={openPaste}
            >
              本文を貼り直す
            </button>
            <button
              type="button"
              className="mt-4 ml-4 text-sm text-brand-700 underline underline-offset-2"
              onClick={() => void shareSheet()}
            >
              共有する
            </button>
            {clearAsk ? (
              <p className="mt-4 text-sm text-neutral-700">
                この控えを消しますか。消すと、この画面の1枚も消えます。
                <button
                  type="button"
                  className="ml-3 text-sm text-danger-700 underline underline-offset-2"
                  onClick={() => {
                    clearPendingZure()
                    setSheet(null)
                    setPendingText('')
                    setRestored(false)
                    setError(null)
                    setClearAsk(false)
                    setRemainHours(null)
                  }}
                >
                  消す
                </button>
                <button
                  type="button"
                  className="ml-3 text-sm text-neutral-600 underline underline-offset-2"
                  onClick={() => setClearAsk(false)}
                >
                  やめる
                </button>
              </p>
            ) : (
              <button
                type="button"
                className="mt-4 ml-4 text-sm text-neutral-600 underline underline-offset-2"
                onClick={() => setClearAsk(true)}
              >
                この控えを消す
              </button>
            )}
          </div>
          <KasuharaGap />
        </section>
      )}

      <div className="zure-drop-chrome">
        {fromReferral && !sheet && (
          <p className="mt-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-neutral-800">
            ファイルが手元にない場合は、下の「テキストを貼る」から始められます。PDF・Wordがあれば、ここに置いてください。
          </p>
        )}

        <div
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
            if ((e.target as HTMLElement).closest('button')) return
            fileRef.current?.click()
          }}
          onKeyDown={e => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            if ((e.target as HTMLElement).closest('button')) return
            e.preventDefault()
            fileRef.current?.click()
          }}
          onPaste={e => {
            if (ingestClipboard(e.clipboardData)) e.preventDefault()
          }}
          onDrop={e => {
            e.preventDefault()
            dragDepth.current = 0
            setDrag(false)
            const files = e.dataTransfer.files
            setManyFiles(files.length > 1)
            void onFile(files[0])
          }}
          className={`mt-8 flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 text-center outline-none transition-colors focus-visible:border-[var(--zure-vermilion)] focus-visible:ring-2 focus-visible:ring-[var(--zure-vermilion)]/25 ${
            sheet ? 'min-h-0 py-6' : 'min-h-52'
          } ${drag ? 'border-[var(--zure-vermilion)] bg-[var(--zure-paper-card)]' : 'border-[#9a9080] bg-[var(--zure-paper-card)]/80'}`}
        >
          <FileUp className="h-8 w-8 text-[var(--zure-vermilion)]" aria-hidden />
          <p id="zure-drop-label" className="mt-3 text-sm font-semibold text-[var(--zure-ink)]">
            {busy ? '読んでいます…' : sheet ? '別のファイルを置く' : '就業規則のファイルをここに置く'}
          </p>
          <p className="mt-1 text-xs text-[var(--zure-ink-soft)]">
            PDF・Word（.docx）・テキスト。8MBまで。画像やPagesは置けません。本文の貼り付けでも1枚にできます。
          </p>
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
          <button
            id="zure-file-pick"
            type="button"
            className="mt-4 inline-flex min-h-11 items-center justify-center bg-[var(--zure-vermilion)] px-5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            ファイルを選ぶ
          </button>
          {busy && <LoaderCircle className="mt-3 h-5 w-5 animate-spin text-[var(--zure-vermilion)]" aria-hidden />}
        </div>

        <details ref={pasteBoxRef} className="mt-6 text-sm leading-relaxed text-[var(--zure-ink-soft)]">
          <summary className="cursor-pointer text-[var(--zure-vermilion)] underline-offset-2 hover:underline">
            テキストを貼る
          </summary>
          <p className="mt-3 text-sm text-[var(--zure-ink-soft)]">
            Googleドキュメントや社内ポータルから、本文を貼れます。ファイルが手元にないときも、1枚にできます。
          </p>
          <label htmlFor="zure-paste" className="mt-4 block text-sm font-medium text-[var(--zure-ink)]">
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
            className="mt-2 w-full border border-[#9a9080] bg-[var(--zure-paper-card)] px-3 py-2 text-sm leading-relaxed text-[var(--zure-ink)] outline-none focus-visible:border-[var(--zure-vermilion)] focus-visible:ring-2 focus-visible:ring-[var(--zure-vermilion)]/25 disabled:opacity-60"
            placeholder="ここに本文を貼る"
          />
          <p className="mt-1 text-xs text-[var(--zure-ink-soft)]">
            {paste.length.toLocaleString('ja-JP')}字。先頭10万字まで使います。
          </p>
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center border border-[var(--zure-line)] px-4 text-sm font-medium text-[var(--zure-ink)] hover:bg-[var(--zure-paper-card)] disabled:opacity-60"
            disabled={busy}
            onClick={() => submitPaste(paste)}
          >
            このテキストから1枚にする
          </button>
          <p className="mt-2 text-xs text-[var(--zure-ink-soft)]">⌘Enter または Ctrl+Enter でも進めます。</p>
        </details>
      </div>
      </div>

      {!sheet && <ZureLpBelow />}

      {!sheet && (
        <div className="zure-sticky-cta zure-drop-chrome">
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center bg-[var(--zure-vermilion)] px-5 text-sm font-semibold text-white"
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

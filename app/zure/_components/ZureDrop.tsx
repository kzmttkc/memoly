'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FileUp, LoaderCircle } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { track, trackOncePerVisit } from '@/lib/analytics'
import { KasuharaGap } from './KasuharaGap'
import { HERO, HERO_EN, KABAU_LINE, OFFER } from '@/lib/offer'
import { createClient } from '@/lib/supabase'
import { fileFromPastedText, sniffKind, unreadNoteForUnsupported, plainTextFromClipboardData, emptyOrFolderNote } from '@/lib/document-extract'
import { savePendingZure, readPendingZure, clearPendingZure, pendingRemainingHours } from '@/lib/zure-pending'
import { retryUntilMs, retryWaitMessage } from '@/lib/zure-rate-limit'
import { ZURE_SAMPLE_FILENAME, ZURE_SAMPLE_TEXT, isZureSampleFilename } from '@/lib/zure-sample'
import { buildZureSheet, zureKindLabel, type ZureSheet } from '@/lib/zure-sheet'
import type { LpVariant } from '@/app/business/_lib/variant-shared'

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

const KIND_CLASS: Record<ZureSheet['rows'][number]['kind'], string> = {
  unread: 'bg-warning-50 text-warning-700',
  conflict: 'bg-brand-50 text-brand-800',
  rule_only: 'bg-neutral-100 text-neutral-700',
  absent: 'bg-neutral-100 text-neutral-600',
}

function sheetPlainText(sheet: ZureSheet): string {
  const rows = sheet.rows
    .map(r => `・${zureKindLabel(r.kind)} ${r.topic}\n${r.detail}`)
    .join('\n\n')
  return `${sheet.title}\n\n${rows}\n\n${sheet.disclaimer}\n`
}

export function ZureDrop({ variant }: { variant: LpVariant }) {
  const params = useSearchParams()
  const fromKabau = params.get('utm_source') === 'kabau'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageWarn, setStorageWarn] = useState(false)
  const [sheet, setSheet] = useState<ZureSheet | null>(null)
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

  useEffect(() => {
    void createClient()
      .auth.getSession()
      .then(({ data }) => setAuthed(!!data.session))
      .catch(() => setAuthed(false))
  }, [])

  useEffect(() => {
    const pending = readPendingZure()
    if (!pending) return
    setSheet(buildZureSheet(pending))
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

  const onFile = useCallback(async (file: File | undefined) => {
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
      const nextSheet = data.sheet as ZureSheet
      setSheet(nextSheet)
      const saved = savePendingZure({
        filename: String(data.filename ?? file.name),
        text: String(data.text ?? ''),
        unreadNote: typeof data.unreadNote === 'string' ? data.unreadNote : null,
      })
      setStorageWarn(!saved)
      if (saved) setRemainHours(pendingRemainingHours({ savedAt: Date.now() }))
      const source = isZureSampleFilename(file.name)
        ? 'sample'
        : file.name === 'pasted.txt'
          ? 'paste'
          : 'file'
      track('zure_sheet_shown', { rows: nextSheet.rows.length, source })
    } catch {
      setError('通信を確認してください。同じファイルをもう一度置くか、本文を貼ってください。')
    } finally {
      setBusy(false)
    }
  }, [busy])

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

  function downloadSheet() {
    if (!sheet) return
    const blob = new Blob([sheetPlainText(sheet)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(sheet.title || 'zure').replace(/[/\\?%*:|"<>]/g, '').slice(0, 40)}.txt`
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
        await navigator.share({ title: sheet.title, text: sheetPlainText(sheet) })
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
    <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
      <div className="zure-drop-chrome zure-hero-enter">
      <a
        href="#zure-file-pick"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        ファイルを置く場所へ
      </a>
      <a
        href="#zure-paste"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-16 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        onClick={e => {
          e.preventDefault()
          openPaste()
        }}
      >
        本文を貼る場所へ
      </a>
      {/* 2026-08-29 LPトップ性: ブランドをヒーロー級に（navだけにしない）。 */}
      <p className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/25">
          <BantoMark className="h-5 w-5" aria-hidden />
        </span>
        就業規則AI
      </p>
      <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-neutral-900 sm:text-4xl">
        {headline}
      </h1>
      {fromKabau && (
        <p className="mt-4 text-sm leading-relaxed text-neutral-700">{KABAU_LINE}</p>
      )}
      {isEn && (
        <p className="mt-4 rounded-xl border border-neutral-200 bg-white/70 px-4 py-3 text-sm leading-relaxed text-neutral-700">
          The form below is in Japanese. You can still place a PDF, Word (.docx), or text file, or paste the text. Sign-up comes after the one-page sheet.
        </p>
      )}
      {restored && sheet && (
        <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-neutral-800" role="status">
          このブラウザに控えていた1枚です。
          {remainHours != null ? `あと約${remainHours}時間、この端末に残ります。` : '24時間を過ぎた場合は、もう一度ファイルを置いてください。'}
          確認メールのリンクは、同じブラウザで開いてください。別の端末では、もう一度ファイルを置いてください。
        </p>
      )}
      {!sheet && (
        <>
          <p className="mt-4 text-base leading-relaxed text-neutral-700">
            PDF・Word・テキストを置くか、本文を貼ると、約30秒で1枚になります。登録・クレジットカードは不要です。
          </p>
          <p className="mt-3">
            <button
              type="button"
              className="text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
              disabled={busy}
              onClick={runSample}
            >
              手元にファイルが無いときは、サンプルで見え方だけ確かめる
            </button>
          </p>
          <details className="mt-4 text-sm text-neutral-600">
            <summary className="cursor-pointer font-medium text-neutral-700">置くときの扱い（保存のタイミング）</summary>
            <p className="mt-2 leading-relaxed">
              置いたファイルは、残す操作の前にサーバへ保存しません。このブラウザに24時間だけ控え、残す操作のあとで会社の書類へ移します。同じ回線から1時間に8回まで置けます。共有のパソコンでは、残す操作までこの画面を閉じないでください。読めなかったページは未読として残します。
            </p>
          </details>
        </>
      )}
      {!sheet && manyFiles && (
        <p className="mt-4 text-sm text-neutral-700" role="status">
          一度に置けるのは1ファイルです。先頭のファイルを読みました。
        </p>
      )}
      {!sheet && pasteNote && (
        <p className="mt-4 text-sm text-neutral-700" role="status">
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
          <h2 className="text-lg font-semibold text-neutral-900">{sheet.title}</h2>
          <ol className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
            {sheet.rows.map((row, i) => (
              <li key={`${row.topic}-${i}`} className="py-3">
                <p className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-neutral-900">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_CLASS[row.kind]}`}>
                    {zureKindLabel(row.kind)}
                  </span>
                  {row.topic}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-700">{row.detail}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-neutral-500">{sheet.disclaimer}</p>
          {busy && (
            <p className="zure-drop-chrome mt-4 text-sm text-neutral-700" role="status">
              読んでいます…
            </p>
          )}
          {manyFiles && (
            <p className="zure-drop-chrome mt-4 text-sm text-neutral-700" role="status">
              一度に置けるのは1ファイルです。先頭のファイルを読みました。
            </p>
          )}
          {pasteNote && (
            <p className="zure-drop-chrome mt-4 text-sm text-neutral-700" role="status">
              {pasteNote}
            </p>
          )}
          {error && (
            <p className="zure-drop-chrome mt-4 text-sm text-danger-700" role="alert">
              {error}
            </p>
          )}
          {storageWarn && (
            <p className="zure-drop-chrome mt-4 text-sm text-warning-700" role="alert">
              この端末では一時控えを持てませんでした。画面の1枚は残っています。登録のあとに、同じファイルを書類へ置いてください。
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
              onClick={() => track('signup_cta_clicked', { location: 'zure_save' })}
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
            <Link href="/offer" className="text-brand-700 underline underline-offset-2" onClick={() => track('offer_nav_clicked', { location: 'zure_after_sheet' })}>
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
          {/* Kabau×番頭 1本化 Phase 2: 1枚の下段に10措置照合を置く（V2 §3・chrome外＝印刷にも出る） */}
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
        className={`mt-10 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center outline-none transition-colors focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 ${
          sheet ? 'min-h-0 py-6' : 'min-h-64'
        } ${drag ? 'border-brand-600 bg-brand-50' : 'border-neutral-400 bg-white'}`}
      >
        <FileUp className="h-8 w-8 text-brand-600" aria-hidden />
        <p id="zure-drop-label" className="mt-3 text-sm font-medium text-neutral-900">
          {busy ? '読んでいます…' : sheet ? '別のファイルを置く' : '就業規則のファイルをここに置く'}
        </p>
        <p className="mt-1 text-xs text-neutral-600">PDF・Word（.docx）・テキスト。8MBまで。画像やPagesは置けません。本文の貼り付けでも1枚にできます。古いWord（.doc）は.docxへ。パスワード付きPDFは解除してから。</p>
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
          className={buttonClass({ variant: 'secondary', size: 'sm', className: 'mt-4' })}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          ファイルを選ぶ
        </button>
        {busy && <LoaderCircle className="mt-3 h-5 w-5 animate-spin text-brand-600" aria-hidden />}
      </div>

      <details ref={pasteBoxRef} className="mt-6 text-sm leading-relaxed text-neutral-700">
        <summary className="cursor-pointer text-brand-700 underline-offset-2 hover:underline">
          テキストを貼る
        </summary>
        <p className="mt-3 text-sm text-neutral-600">
          Googleドキュメントや社内ポータルから、本文を貼れます。ファイルが手元にないときも、1枚にできます。
        </p>
        <label htmlFor="zure-paste" className="mt-4 block text-sm font-medium text-neutral-900">
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
          className="mt-2 w-full rounded-xl border border-neutral-500 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-60"
          placeholder="ここに本文を貼る"
        />
        <p className="mt-1 text-xs text-neutral-500">{paste.length.toLocaleString('ja-JP')}字。先頭10万字まで使います。</p>
        <button
          type="button"
          className={buttonClass({ variant: 'secondary', size: 'sm', className: 'mt-3' })}
          disabled={busy}
          onClick={() => submitPaste(paste)}
        >
          このテキストから1枚にする
        </button>
        <p className="mt-2 text-xs text-neutral-500">⌘Enter または Ctrl+Enter でも進めます。</p>
      </details>

      {!sheet && (
        <>
          <details className="mt-6 text-sm leading-relaxed text-neutral-700">
            <summary className="cursor-pointer text-brand-700 underline-offset-2 hover:underline">
              1枚の例を見る
            </summary>
            <p className="mt-3 text-xs text-neutral-500">これは表示の例です。置いたファイルの内容ではありません。</p>
            <ol className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
              <li className="py-3">
                <p className="text-sm font-medium text-neutral-900">規程にある 年次有給休暇</p>
                <p className="mt-1 text-sm text-neutral-600">規程には記載があります。運用の書き方は、このファイルからはまだありません。</p>
              </li>
              <li className="py-3">
                <p className="text-sm font-medium text-neutral-900">触れていない このファイルでは触れていない論点</p>
                <p className="mt-1 text-sm text-neutral-600">カスタマーハラスメントは、このファイルからは読み取れませんでした。不足の断定ではありません。</p>
              </li>
            </ol>
          </details>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600">
            就業規則がまだ無いときは、下書きの本文を貼るか、
            <Link href="/tools" className="text-brand-700 underline underline-offset-2">
              無料の点検
            </Link>
            から数字を確認できます。
          </p>
        </>
      )}
      </div>
    </div>
  )
}

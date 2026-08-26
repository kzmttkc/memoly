'use client'

import { useMemo, useState } from 'react'
import { track } from '@/lib/analytics'
import { readPendingZure } from '@/lib/zure-pending'
import { buildPolicyDraft } from '@/lib/kasuhara/policy'
import type { MeasureVerdict } from '@/lib/kasuhara/measures'

// ============================================================================
// KasuharaGap — 1枚の下段に置く「カスハラ10措置との照合」（Kabau×番頭 1本化 Phase 2）
// ----------------------------------------------------------------------------
// 体験（V2 §3）: 置いた規則をそのまま10措置と照合 → ○△×表 → ×/△だけを埋める
//   規程追補案を**その場で全文表示**（後送を約束しない・隠さない）。
//   メール欄は「同じ内容の控え」を送るためのもの（段2）。会社名は差し込みにだけ
//   使い、サーバへ保存しない（kasuhara-mail 側も保存しない設計）。
// 語り口: ×は「違法」ではなく「該当する定めが見つからない」。適法性の断定をしない。
// ============================================================================

interface GapRow {
  n: number
  title: string
  verdict: MeasureVerdict
  evidence: string
  note: string
  guideHref: string
}

const MARK: Record<MeasureVerdict, string> = { ok: '○', weak: '△', missing: '×' }
const MARK_LABEL: Record<MeasureVerdict, string> = {
  ok: '定めあり',
  weak: '部分的',
  missing: '見つからない',
}

export function KasuharaGap() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<GapRow[] | null>(null)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [mailState, setMailState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [mailMsg, setMailMsg] = useState('')

  const missingCount = useMemo(
    () => (rows ?? []).filter(r => r.verdict !== 'ok').length,
    [rows],
  )
  const draft = useMemo(
    () => (rows ? buildPolicyDraft({ companyName, verdicts: rows }) : ''),
    [rows, companyName],
  )

  async function run() {
    if (busy) return
    const pending = readPendingZure()
    const text = pending?.text ?? ''
    if (text.trim().length < 50) {
      setError('照合できる本文がありません。先にファイルを置くか、本文を貼ってください。')
      return
    }
    setBusy(true)
    setError(null)
    track('kasuhara_gap_run', {})
    try {
      const res = await fetch('/api/zure/kasuhara-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '照合を完了できませんでした。')
        return
      }
      setRows(data.measures as GapRow[])
      setAssessmentId(typeof data.assessmentId === 'string' ? data.assessmentId : null)
      track('kasuhara_gap_shown', { missing: (data.measures as GapRow[]).filter((r) => r.verdict !== 'ok').length })
    } catch {
      setError('通信を確認して、もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  async function sendMail() {
    if (mailState === 'busy' || !assessmentId) return
    setMailState('busy')
    setMailMsg('')
    try {
      const res = await fetch('/api/zure/kasuhara-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, email, companyName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMailState('error')
        setMailMsg(typeof data.error === 'string' ? data.error : '送信できませんでした。')
        return
      }
      setMailState('done')
      setMailMsg(data.sent ? '控えを送りました。この画面の内容と同じものです。' : '受け付けました。')
      track('kasuhara_gap_mail_ok', {})
    } catch {
      setMailState('error')
      setMailMsg('通信を確認して、もう一度お試しください。')
    }
  }

  return (
    <section aria-label="カスハラ10措置との照合" className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
      <h3 className="text-base font-semibold text-neutral-900">
        この規則を、カスハラ10措置（2026年10月1日義務化）と照合する
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-neutral-600">
        置いたファイルの本文を、義務化で求められる10の措置と突き合わせ、定めの有無を○△×で出します。
        結果はこの画面に出ます（登録不要・無料）。
      </p>

      {!rows && (
        <div className="mt-3">
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? '照合中…（30秒ほどかかります）' : '10措置と照合する'}
          </button>
          {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
        </div>
      )}

      {rows && (
        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-900">
            定めあり {rows.filter(r => r.verdict === 'ok').length} / 10。
            {missingCount > 0
              ? `「見つからない」「部分的」が ${missingCount} 件あります。`
              : '10措置すべてに対応する定めが見つかりました。'}
          </p>
          <ul className="mt-3 space-y-2">
            {rows.map(r => (
              <li key={r.n} className="rounded-lg border border-neutral-200 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <span
                    className={
                      'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                      (r.verdict === 'ok'
                        ? 'bg-emerald-100 text-emerald-700'
                        : r.verdict === 'weak'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700')
                    }
                    aria-hidden
                  >
                    {MARK[r.verdict]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">
                      措置{r.n} {r.title}
                      <span className="ml-2 text-xs font-normal text-neutral-500">{MARK_LABEL[r.verdict]}</span>
                    </p>
                    {r.evidence && <p className="mt-0.5 text-xs text-neutral-500">根拠: {r.evidence}</p>}
                    {r.note && <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{r.note}</p>}
                    {r.verdict !== 'ok' && (
                      <a
                        href={`${r.guideHref}?utm_source=banto_zure&utm_medium=kasuhara_gap`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-brand-600 underline underline-offset-2 hover:text-brand-700"
                      >
                        この措置の無料解説を読む
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            ×は「違法」ではなく「該当する定めが本文から見つからない」の意味です。判定はAIによる照合で、
            適法性の判断ではありません。
          </p>

          {/* 規程追補案（その場で全文・会社名は画面内でだけ使う） */}
          <div className="mt-5 border-t border-neutral-200 pt-4">
            <h4 className="text-sm font-semibold text-neutral-900">×・△だけを埋める規程追補案（無料・この画面で完結）</h4>
            <label className="mt-2 block text-xs text-neutral-600">
              会社名（この画面の中だけで使います。送信・保存しません）
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="株式会社◯◯"
                autoComplete="organization"
                className="mt-1 block w-full max-w-sm rounded-lg border border-neutral-500 px-3 py-2 text-sm text-neutral-900"
              />
            </label>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-800">
              {draft}
            </pre>

            {/* 段2: 控えの送付（画面に出し切ったものと同一の内容） */}
            <div className="mt-4 rounded-lg bg-neutral-50 p-4">
              <p className="text-sm font-medium text-neutral-900">この結果と追補案の控えをメールで受け取る</p>
              <p className="mt-0.5 text-xs text-neutral-600">
                画面に出ている内容と同じものを1通送ります。受け取るのはメールアドレス1つだけです。
              </p>
              {mailState !== 'done' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="min-h-11 w-full max-w-sm rounded-lg border border-neutral-500 px-3 py-2 text-sm text-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={sendMail}
                    disabled={mailState === 'busy'}
                    className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {mailState === 'busy' ? '送信中…' : '控えを受け取る'}
                  </button>
                </div>
              ) : null}
              {mailMsg && (
                <p className={`mt-2 text-xs ${mailState === 'error' ? 'text-danger-600' : 'text-neutral-600'}`}>{mailMsg}</p>
              )}
            </div>

            {/* 次の一手（重い順に2つだけ） */}
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <a
                href="https://sharoushi-agent.com/kasuhara-pack.html?utm_source=banto_zure&utm_medium=kasuhara_gap"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                onClick={() => track('kasuhara_gap_pack_click', {})}
              >
                掲示文・対応マニュアル・記録様式までWord一式で揃える（実務パック ¥19,800）→
              </a>
              <p className="text-xs text-neutral-500">
                この規則を覚えさせて、以後この規則前提で相談を続けるには、上の「残す」からアカウントを作れます。
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

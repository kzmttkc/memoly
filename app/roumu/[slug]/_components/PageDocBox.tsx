'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { track } from '@/lib/analytics'
import PageDocEngine from '@/lib/page-doc-engine.js'

// ============================================================================
// PageDocBox — /roumu のカスハラ記事に置く段2の枠（2026-09-15）
//
//   就業規則AI(サイト)の規定例ページで名前が取れている交換を、そのまま置く。
//   3つ選ぶ → 足す条文と10月1日までの順番が**押したその場で全文**出る → メール1つで届出の書類（Word）をその場でダウンロード（2026-09-15 から）。
//   対価はメールと引き換えにしない（本文は先に出す）。文言はサイト側の箱と同じ（新しいコピーを作らない）。
//
//   計測（サイト側と同じ名前・source で面を分ける）:
//     free_cta_section_view は使わない（サイト側の到達と混ざる）。
//     page_doc_revealed / page_doc_submit / lead_captured に source=app_roumu と slug を付ける。
// ============================================================================

const SOURCE = 'app_roumu'
// 2026-09-15（WO「記事2本の引き換え物を直す」をサイトと同じ形で）: メール1つと交換に、届出の書類（Word）をその場でダウンロードさせる
const OFFER = 'todoke3'
type Val = { size: string; union: string; rules: string }
const Q: Array<[keyof Val, string]> = [['size', 'Q1 従業員数'], ['union', 'Q2 過半数労働組合'], ['rules', 'Q3 就業規則']]

export default function PageDocBox({ slug }: { slug: string }) {
  const L = PageDocEngine.LABELS.kitei
  const [v, setV] = useState<Val>({ size: '', union: '', rules: '' })
  const [out, setOut] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  function reveal() {
    if (!v.size || !v.union || !v.rules) { setMsg('上の選択をすべて選んでから押してください。'); return }
    const text = PageDocEngine.build('kitei', v)
    if (!text) { setMsg('選択を読み取れませんでした。もう一度選んでください。'); return }
    setOut(text)
    setMsg('この画面に全文が出ています。印刷もできます。')
    track('page_doc_revealed', { doc: 'kitei', source: SOURCE, slug, ...v })
  }

  // 書類は画面に出さずファイルで渡す。失敗しても同じ書類はメールにも添付されるので、ここは握って計測だけ残す。
  async function downloadForms(addr: string, files: string) {
    try {
      const res = await fetch('/api/roumu/page-doc/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addr, slug, values: v }),
      })
      if (!res.ok) throw new Error('forms')
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = '届出の書類.docx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      track('page_doc_file_downloaded', { doc: 'kitei', source: SOURCE, slug, offer: OFFER, files })
    } catch {
      track('page_doc_failed', { doc: 'kitei', source: SOURCE, slug, reason: 'forms_download' })
    }
  }

  async function send() {
    const normalized = email.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s/g, '')
    if (normalized !== email) setEmail(normalized)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setMsg('メールアドレスを半角で入れ直してください。全角の＠は通りません。'); return }
    setState('sending')
    const files = PageDocEngine.forms('kitei', v).map(f => f.id).join(',')
    track('page_doc_submit', { doc: 'kitei', source: SOURCE, slug, offer: OFFER })
    downloadForms(normalized, files)
    try {
      const res = await fetch('/api/roumu/page-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, slug, values: v, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || '送れませんでした。時間をおいて試してください。画面の本文はそのまま残ります。')
      setState('done')
      setMsg('届出の書類（Word）をダウンロードしました。同じ書類と、条文と順番の Word を、入力された宛先にも送りました。')
      track('lead_captured', { source: SOURCE, doc: 'kitei', slug, offer: OFFER, files })
    } catch (e) {
      setState('error')
      setMsg((e as Error).message)
    }
  }

  return (
    <Card className="mt-7 border-[#165E83] p-5 sm:p-6">
      <p className="text-lg font-bold leading-snug text-neutral-900">自社の就業規則に、10月1日のカスハラ条項があるか。</p>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700">
        人数と、組合の有無と、就業規則があるかを選ぶと、御社の場合に足す条文と、10月1日までの順番が出ます。
        アカウントは不要です。
      </p>
      {Q.map(([key, legend]) => (
        <fieldset key={key} className="mt-4">
          <legend className="text-sm font-bold text-neutral-900">{legend}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(L[key]).map(([val, label]) => (
              <label key={val} className={`cursor-pointer rounded border px-3 py-2 text-sm ${v[key] === val ? 'border-[#165E83] bg-[#EDF3F6] text-neutral-900' : 'border-[#9A9078] bg-white text-neutral-800'}`}>
                <input type="radio" name={`pd-${key}`} value={val} checked={v[key] === val} onChange={() => setV({ ...v, [key]: val })} className="mr-1.5" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="button" onClick={reveal} disabled={!!out} className={buttonClass({ variant: 'primary', size: 'lg' }) + ' mt-5 w-full sm:w-auto'}>
        {out ? '出しました' : '足す条文と、届出までの順番を出す'}
      </button>
      {msg && <p className={`mt-3 text-sm ${state === 'error' ? 'text-[#B94047]' : 'text-[#10714C]'}`} role="status">{msg}</p>}
      {out && (
        <>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded border border-[#E2DCCE] bg-white p-4 font-mono text-[13px] leading-7 text-neutral-900">{out}</pre>
          {state !== 'done' && (
            <div className="mt-4">
              <p className="mb-3 rounded bg-[#EDF3F6] px-3 py-2 text-sm leading-relaxed text-neutral-900">
                メールアドレスを入れると、届出に使う書類をこの場でダウンロードできます（Word・{PageDocEngine.forms('kitei', v).length}枚・御社の答えを差し込み済み）:{' '}
                {PageDocEngine.forms('kitei', v).map(f => f.title).join('・')}
              </p>
              <label htmlFor={`pd-email-${slug}`} className="block text-sm font-bold text-neutral-900">届出に使う書類を Word でダウンロードする</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input id={`pd-email-${slug}`} type="email" inputMode="email" autoComplete="email" placeholder="メールアドレス"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="min-h-[46px] flex-1 rounded border border-[#9A9078] bg-white px-3 text-base" />
                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={e => setWebsite(e.target.value)} className="hidden" />
                <button type="button" onClick={send} disabled={state === 'sending'} className={buttonClass({ variant: 'primary', size: 'lg' })}>
                  {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : '書類（Word）をダウンロードする'}
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                お聞きするのはメールアドレスだけです。会社名・電話・役職は要りません。取り扱いは<a href="/privacy" className="underline">プライバシーポリシー</a>のとおりです。
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

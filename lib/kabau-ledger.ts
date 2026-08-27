// ============================================================================
// kabau-ledger.ts — 就業規則AI 公開台帳（世の中の日付）の読み取り
//   取れなければ空。就業規則AIが法令の確定日を独自に持たないための受け口。
//   取得は KABAU_METHOD_JSON_URL があるときだけ（無いのに毎チャット叩かない）。
// ============================================================================

export interface KabauFact {
  key: string
  value: string
  retrieved_on: string
  source_url: string
  source_name?: string
  status: string
}

export const KABAU_METHOD_URL = process.env.KABAU_METHOD_JSON_URL ?? ''

export function parseKabauLedger(raw: string): KabauFact[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []
  const facts = (parsed as { facts?: unknown }).facts
  if (!Array.isArray(facts)) return []
  const out: KabauFact[] = []
  for (const row of facts) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (
      typeof r.key !== 'string' ||
      typeof r.value !== 'string' ||
      typeof r.retrieved_on !== 'string' ||
      typeof r.source_url !== 'string' ||
      typeof r.status !== 'string'
    ) {
      continue
    }
    if (r.status !== '確定') continue
    out.push({
      key: r.key,
      value: r.value,
      retrieved_on: r.retrieved_on,
      source_url: r.source_url,
      source_name: typeof r.source_name === 'string' ? r.source_name : undefined,
      status: r.status,
    })
  }
  return out
}

export function formatKabauFactsBlock(facts: KabauFact[]): string {
  if (!facts.length) return ''
  const lines = facts.map(f => {
    const src = f.source_name ? `${f.source_name} ${f.source_url}` : f.source_url
    return `- ${f.key}: ${f.value}（確認日 ${f.retrieved_on} / ${src}）`
  })
  return `\n\n【就業規則AI公開台帳（世の中の確定事実。自社の決定ではない）】
${lines.join('\n')}
ここに無い施行日は確定扱いにしないでください。`
}

export async function loadKabauLedger(timeoutMs = 1500): Promise<KabauFact[]> {
  if (!KABAU_METHOD_URL) return []
  try {
    const res = await fetch(KABAU_METHOD_URL, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    return parseKabauLedger(await res.text())
  } catch {
    return []
  }
}

// ============================================================================
// lib/kasuhara/measures.ts — カスハラ10措置の正典（Kabau×番頭 1本化 Phase 2）
// ----------------------------------------------------------------------------
// 出典: 厚生労働省リーフレット「令和８年10月１日からハラスメント対策が強化されます！」
//   https://www.mhlw.go.jp/content/11900000/001662576.pdf（一次情報確認 2026-08-20）
// 同一の10項目が静的サイト側の正典 sharoushi-agent.com/kasuhara-measures.json にあり、
// n と title は完全一致させる（tests/unit/kasuhara-measures.test.ts が機械検査する）。
//
// 義務の性質（誤報是正ゲート 2026-08-25 の水準）:
//   改正労働施策総合推進法（令和7年法律第63号）による**措置義務**（2026-10-01施行）。
//   「努力義務」ではない。直接の刑事罰は無く、是正指導・勧告・企業名公表の行政措置による。
//   この記述を変えるときは steering/trend-calendar.md（一次情報つき正典）を先に見る。
// ============================================================================

export type MeasureVerdict = 'ok' | 'weak' | 'missing'

export interface KasuharaMeasure {
  /** 措置番号（1〜10・リーフレットの並び）。 */
  n: number
  /** 措置の名称（kasuhara-measures.json と一致必須）。 */
  title: string
  /** 就業規則・社内規程に何が書いてあれば充足かの判定基準（LLM判定と画面表示の両方で使う）。 */
  criteria: string
  /** 無料解説（sharoushi-agent.com のガイド）。×の行から案内する。 */
  guideHref: string
}

const GUIDE_BASE = 'https://sharoushi-agent.com'

export const KASUHARA_MEASURES: readonly KasuharaMeasure[] = [
  { n: 1, title: '方針の明確化・周知',
    criteria: 'カスタマーハラスメント（顧客等からの著しい迷惑行為）から従業員を守る会社方針が定められ、周知の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-manual-kihonhoshin-guide.html` },
  { n: 2, title: 'あらかじめ定めた対処の周知',
    criteria: 'カスハラが起きたときに会社がどう対処するか（対応の中身）があらかじめ定められ、従業員に示されているか',
    guideHref: `${GUIDE_BASE}/kasuhara-manual-kihonhoshin-guide.html` },
  { n: 3, title: '相談窓口の設置と周知',
    criteria: 'カスハラについて従業員が相談できる窓口（担当者・部署）の定めと周知の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-soudan-madoguchi-guide.html` },
  { n: 4, title: '担当者が対応できる手順',
    criteria: '相談を受けた担当者が内容や状況に応じて適切に対応できる手順・体制の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-soudan-madoguchi-guide.html` },
  { n: 5, title: '事実確認',
    criteria: 'カスハラの相談・報告があったときに事実関係を確認する旨の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-shodo-flow-guide.html` },
  { n: 6, title: '被害者への配慮',
    criteria: '被害を受けた従業員への配慮の措置（一人で対応させない・対応者の交代・メンタル面のケア等）の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-shodo-flow-guide.html` },
  { n: 7, title: '再発防止',
    criteria: '同種の事案の再発防止に取り組む旨の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-shodo-flow-guide.html` },
  { n: 8, title: '悪質事案への対処方針',
    criteria: '悪質な事案（犯罪に該当し得る言動等）への対処方針（警察への通報・取引停止等の判断を含む）の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-kuremu-senbiki-guide.html` },
  { n: 9, title: 'プライバシー保護',
    criteria: '相談者・関係者のプライバシーを保護する旨の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-soudan-madoguchi-guide.html` },
  { n: 10, title: '不利益取扱いの禁止',
    criteria: '相談したこと・事実確認に協力したことを理由とする解雇その他不利益な取扱いを行わない旨の定めがあるか',
    guideHref: `${GUIDE_BASE}/kasuhara-shugyokisoku-kitei-guide.html` },
] as const

/** LLMの出力（未検証）を安全な形へ正規化する。未知の値・欠けた措置は 'missing' に倒さず 'weak' にもせず、
 *  「判定できなかった」ことが分かるよう missing 扱いにせず null を返して呼び出し側で落とす……のではなく、
 *  10行そろっていない応答は**全体を不採用**にする（部分的な表は誤読を生む）。 */
export function normalizeVerdicts(raw: unknown): {
  n: number
  verdict: MeasureVerdict
  evidence: string
  note: string
}[] | null {
  if (!raw || typeof raw !== 'object') return null
  const arr = (raw as { measures?: unknown }).measures
  if (!Array.isArray(arr)) return null
  const byN = new Map<number, { n: number; verdict: MeasureVerdict; evidence: string; note: string }>()
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const n = typeof o.n === 'number' ? o.n : Number.parseInt(String(o.n), 10)
    const v = o.verdict
    if (!Number.isInteger(n) || n < 1 || n > 10) continue
    if (v !== 'ok' && v !== 'weak' && v !== 'missing') continue
    byN.set(n, {
      n,
      verdict: v,
      evidence: typeof o.evidence === 'string' ? o.evidence.slice(0, 120) : '',
      note: typeof o.note === 'string' ? o.note.slice(0, 200) : '',
    })
  }
  if (byN.size !== 10) return null
  return [...byN.values()].sort((a, b) => a.n - b.n)
}

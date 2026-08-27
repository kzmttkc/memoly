import type { UseCase } from './usecase'

// ============================================================================
// article-checksheet — 記事別「確認シート」の項目を、記事自身の文から組み立てる
//
//   なぜ要るか（gtm-doctrine.md §2・2026-08-25）:
//     「流入 → **名前** → 関係 → 販売」の段2（名前を取る）が存在しなかった。
//     就業規則AIの /roumu/ は GSC 28日で imp 1,879 / clk 107 と6製品中で最強の検索資産
//     なのに、Plausible 実測で lead_captured は **90日で0件**（hostname=
//     banto-roumu.com）。枠が無かったのではなく、置いてあった対価が
//     「労務引き継ぎチェックシート（PDF）」1種類で、58記事すべてに同じものを
//     出していた。カスハラ義務化を読んだ人に引き継ぎのPDFを出していたことになる。
//
//     正典 §2 の要件は「対価は**その場で完結する実用物**」。だから確認シートは
//     読み終わった記事の論点そのもので作り、画面上で完結させる。
//
//   捏造しないための決めごと（ここが一番大事）:
//     項目文も確認材料も、**記事が自分で書いている文をそのまま使う**。
//     法令の要件をこちらで書き起こさない・要約し直さない（Phase1: 社労士監修/
//     AI社労士/法的精度は使わない、断定的な個別助言をしない、に一致させる）。
//     選び方は決定的（同じ記事なら毎回同じ結果）で、乱数も日付も使わない。
//
//   項目の出どころ（上から順に、取れたところで打ち切る）:
//     1. 本文にチェックリストが実在する記事は、その項目（EXPLICIT_ITEMS）
//     2. 製品名を含まないFAQの質問（58記事中54記事はここで2件以上取れる）
//     3. 製品名を含まない見出し（FAQが製品の質問で埋まっている比較記事向け）
// ============================================================================

/** 確認シートの1行。topic=自社で確認する論点 / detail=記事側の確認材料。 */
export interface CheckSheetItem {
  /** 点検する論点。記事の文そのまま。 */
  topic: string
  /** その論点について記事が書いていること。未確認だったときに読む材料。 */
  detail: string
}

/** /api/company/leads の ALLOWED_SOURCES と一致させる（不一致だと 'unknown' に丸められる）。 */
export const CHECKSHEET_SOURCE = 'article_checksheet'

/** 読み終わりの位置に置ける上限。これを超えると点検自体が負担になり離脱する。 */
const MAX_ITEMS = 6
/** これを下回る記事は、次の出どころへ落とす。 */
const MIN_ITEMS = 2

/** 自社の点検ではなく製品の説明になっている文を落とすための判定。
    旧名（番頭/ばんとう/Banto）も残す — 過去データや再生成で旧名が混入しても落とせるように。 */
function mentionsProduct(text: string): boolean {
  // 「かばう」は動詞として本文に普通に出る（カスハラ文脈）ので入れない。
  return /就業規則AI|カバウ|番頭|ばんとう|Banto/i.test(text)
}

/**
 * /roumu/kasuhara-gimuka-2026 本文の「社内対応チェックリスト」5項目。
 *
 * 出典は lib/usecase.ts の同記事 sections 内の箇条書きで、行頭の「・」を
 * 取り除いただけ（新規に書き起こしたものではない）。
 *
 * この記事は Plausible 30日実測で 258 visitors ＝ banto-roumu.com 全 417 visitors
 * の62%を1本で占める。ここの項目がずれると段2の件数がそのまま落ちるため、
 * FAQ からの自動生成に任せず本文の実物を使う。
 *
 * 同じ5項目をヒーローのセルフ点検（KasuharaSelfCheck）も使う。2箇所にベタ書き
 * すると片方だけ直って食い違うので、出所はこの定数1つに寄せる。
 */
export const KASUHARA_SOCHI_ITEMS = [
  'カスハラに対する会社の方針を文書で明示しているか（就業規則・社内通知など）',
  '従業員向けの相談窓口を決め、周知しているか（担当・連絡方法・記録の残し方）',
  '迷惑行為があったときの対応手順を決めているか（一次対応・記録・引き継ぎ・外部連絡の判断）',
  '被害を受けた従業員への配慮（安全確保・メンタル面のフォロー）を用意しているか',
  '現場の担当者が方針と手順を理解しているか（周知・簡単な研修）',
] as const

/** 本文にチェックリストが実在する記事だけをここに置く（無理に増やさない）。 */
const EXPLICIT_ITEMS: Record<string, readonly string[]> = {
  'kasuhara-gimuka-2026': KASUHARA_SOCHI_ITEMS,
}

// --- 確認材料を「記事の中から」決定的に選ぶ ---------------------------------

/**
 * 日本語は語の区切りが無いので、文字bigramの集合で重なりを測る。
 * 形態素解析を持ち込まずに、決定的で説明できる選び方にするため。
 */
function bigrams(text: string): Set<string> {
  const s = text.replace(/[\s、。（）()「」・]/g, '')
  const out = new Set<string>()
  for (let i = 0; i + 1 < s.length; i++) out.add(s.slice(i, i + 2))
  return out
}

/** 重なりの割合（0〜1）。分母は短いほうに合わせ、長文が有利になりすぎないようにする。 */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let hit = 0
  for (const g of a) if (b.has(g)) hit++
  return hit / Math.min(a.size, b.size)
}

/**
 * その論点を最もよく説明している段落を、記事本文とFAQの答えから選ぶ。
 * 同点なら記事に現れる順で先のものを採る（決定的にするため）。
 */
function evidenceFor(u: UseCase, topic: string): string {
  const candidates: string[] = [
    ...u.sections.flatMap((s) => s.body),
    ...u.faqs.map((f) => f.a),
  ]
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    // 箇条書きの行そのものは確認材料にならない（別のチェック項目を材料として
    // 出してしまい、「確認するために確認項目を読む」になる）。
    .filter((t) => !t.startsWith('・'))

  const target = bigrams(topic)
  let best = ''
  let bestScore = -1
  for (const c of candidates) {
    // 項目文そのものを含む段落（箇条書きの元）は確認材料にならない。
    if (c.includes(topic)) continue
    const score = overlap(target, bigrams(c))
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  // どれとも重ならない場合でも空にしない（未確認と出すだけで何も渡せない状態を避ける）。
  return best || candidates[0] || ''
}

// --- 項目の組み立て ---------------------------------------------------------

/** 製品名を含まないFAQを、記事の掲載順のまま項目にする。 */
function fromFaqs(u: UseCase): CheckSheetItem[] {
  return u.faqs
    .filter((f) => !mentionsProduct(f.q))
    .map((f) => ({ topic: f.q.trim(), detail: f.a.trim() }))
}

/** 製品名を含まない見出しを、記事の掲載順のまま項目にする。 */
function fromHeadings(u: UseCase): CheckSheetItem[] {
  return u.sections
    .filter((s) => !mentionsProduct(s.heading))
    .map((s) => ({
      topic: s.heading.trim(),
      detail: (s.body.find((b) => b.trim().length > 0) ?? '').trim(),
    }))
    .filter((i) => i.detail.length > 0)
}

/**
 * この記事の確認シートに載せる論点を返す。
 *
 * 同じ記事なら毎回同じ結果になる（乱数・日付・A/Bを持ち込まない）。
 * 返す文はすべて記事本文かFAQに実在する（tests/unit/article-checksheet.test.ts が
 * 58記事すべてについて機械で確認している）。
 */
export function checkSheetItems(u: UseCase): CheckSheetItem[] {
  const explicit = EXPLICIT_ITEMS[u.slug]
  if (explicit && explicit.length >= MIN_ITEMS) {
    return explicit
      .slice(0, MAX_ITEMS)
      .map((topic) => ({ topic, detail: evidenceFor(u, topic) }))
  }

  const faqs = fromFaqs(u)
  if (faqs.length >= MIN_ITEMS) return faqs.slice(0, MAX_ITEMS)

  // FAQが製品への質問で埋まっている比較記事など。この場合は残ったFAQを混ぜず、
  // 見出しだけで組む。1本だけ残ったFAQは「小規模な会社でも使えますか？」のような
  // 製品への問い（製品名を書いていないので上の判定をすり抜ける）で、自社を点検する
  // 項目として並べると意味をなさないため。
  const headings = fromHeadings(u)
  if (headings.length >= MIN_ITEMS) return headings.slice(0, MAX_ITEMS)

  // どちらも足りない記事だけ、最後の手段として混ぜる。
  const merged = [...faqs, ...headings]
  const seen = new Set<string>()
  const deduped = merged.filter((i) => {
    if (seen.has(i.topic)) return false
    seen.add(i.topic)
    return true
  })
  return deduped.slice(0, MAX_ITEMS)
}

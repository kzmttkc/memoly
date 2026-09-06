import { test } from 'node:test'
import assert from 'node:assert/strict'
import { USECASE_LIST } from '../../lib/usecase.ts'
import { SEIDO_POSTS } from '../../lib/seido.ts'

// ============================================================================
// invoice-keikasochi-rate.test.ts
//   同一サイト内で「インボイス経過措置」の数値が食い違っていないかを機械で止める。
//
// なぜ作ったか（2026-09-07 実測）:
//   /seido/keikasochi-itsumade は「『2026年10月からは50%控除』と書かれた解説記事を
//   今も検索結果で見かけますが、これは改正前の古いスケジュールです」と名指しで
//   訂正している。ところが同じサイトの
//   /roumu/invoice-keika-sochoku-gimu-deadline が、まさにその改正前の
//   スケジュール（2026年10月から50%・経過措置は2029年9月末で終了）を、
//   金額の試算例つきで配信し続けていた。自社が批判した対象が自社の記事だった。
//   読者はその試算をそのまま計算に使う。腐る日は2026年10月1日。
//
//   訂正そのものは 2026-07-29 に /corrections（sharoushi-agent.com）へ
//   記帳済みだった。正典を直しても、同じ主張を持つ派生記事へ伝播しなかった。
//   規律では防げなかった（記事は日次生成で増える）。だから道具にする。
//
// 検査の作り:
//   正典は /seido/keikasochi-itsumade の表（lib/seido.ts）だけ。ここから
//     - 段の境界になる年（2023 / 2026 / 2028 / 2030 / 2031）
//     - 控除割合ごとに、その割合が生きている年の範囲
//   を機械で読み出し、サイト内の全記事がそれと矛盾しないことを確認する。
//   数字をこのファイルに書き写さない（写した瞬間に2つ目の正典ができる）。
//
// 一次資料（正典側 lib/seido.ts が保持。ここでは参照のみ）:
//   国税庁「インボイス制度 〜基礎編〜」（令和8年5月）／
//   財務省「令和8年度税制改正の大綱」p.92-93
// ============================================================================

const CANON_SLUG = 'keikasochi-itsumade'

// --- 正典（表）を読み出す ---------------------------------------------------

const canon = SEIDO_POSTS.find(p => p.slug === CANON_SLUG)
assert.ok(canon, `正典記事が見つからない: /seido/${CANON_SLUG}`)

const canonTable = canon.sections.find(s => s.table)?.table
assert.ok(canonTable, `正典記事に経過措置の表が無い: /seido/${CANON_SLUG}`)

/** 「30%」「控除不可」→ 30 / 0 */
function parseRate(cell: string): number | null {
  if (/控除不可|控除できません/.test(cell)) return 0
  const m = cell.match(/(\d+)\s*[%％]/)
  return m ? Number(m[1]) : null
}

function years(text: string): number[] {
  return [...text.matchAll(/(20\d{2})年/g)].map(m => Number(m[1]))
}

/** 控除割合 → その割合が生きている年の集合（開始年〜終了年） */
const RATE_YEARS = new Map<number, Set<number>>()
/** 段の境界になりうる年（この年以外の「9月/10月」を経過措置の境界として書いたら誤り） */
const BOUNDARY_YEARS = new Set<number>()

for (const row of canonTable.rows) {
  const ys = years(row[0])
  const rate = parseRate(row[1])
  assert.ok(ys.length > 0, `表の期間欄から年を読めない: ${row[0]}`)
  assert.ok(rate !== null, `表の控除割合を読めない: ${row[1]}`)
  for (const y of ys) BOUNDARY_YEARS.add(y)
  const span = RATE_YEARS.get(rate) ?? new Set<number>()
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) span.add(y)
  RATE_YEARS.set(rate, span)
}

// --- 検査対象の文を、型のついたオブジェクトから組み立てる -------------------
// 生テキストを 。 で割ると表の行が1つの塊になり、全段の数字が同じ文に同居して
// 誤検知する。だから表は行単位で1つの単位にする。

type Unit = { where: string; text: string }

function sentences(text: string): string[] {
  return text.split(/(?<=。)/).map(s => s.trim()).filter(Boolean)
}

function unitsForArticle(where: string, chunks: string[]): Unit[] {
  return chunks.flatMap(c => sentences(c).map(text => ({ where, text })))
}

function collect(): Unit[] {
  const out: Unit[] = []

  for (const a of USECASE_LIST) {
    const where = `/roumu/${a.slug}`
    const chunks = [
      a.h1, a.titleKeyword, a.description, a.lead,
      ...a.sections.flatMap(s => [s.heading, ...s.body]),
      ...a.examples.flatMap(e => [e.ask, e.answer]),
      ...a.faqs.flatMap(f => [f.q, f.a]),
    ]
    out.push(...unitsForArticle(where, chunks))
  }

  for (const p of SEIDO_POSTS) {
    const where = `/seido/${p.slug}`
    const chunks = [
      p.title, p.description, p.lead,
      ...p.sections.flatMap(s => [
        s.heading,
        ...s.body,
        ...(s.table ? [s.table.caption, ...s.table.rows.map(r => r.join(' / '))] : []),
      ]),
    ]
    out.push(...unitsForArticle(where, chunks))
  }

  return out
}

/** 記事全体がインボイス経過措置の話をしているか（文単位だと文脈が落ちる） */
function inScopeArticle(text: string): boolean {
  return /インボイス|適格請求書|免税事業者/.test(text)
    && /経過措置|控除割合|控除率|仕入税額控除/.test(text)
}

/**
 * 違反にしない文。
 *   - 改正前の旧情報を「旧情報である」と示して引用しているもの（訂正記事はこれを必ず書く）
 *   - 正しく否定しているもの（「50%ではなく70%」）
 */
const ALLOWED = /改正前|見直し前|旧スケジュール|旧情報|予定でした|ではなく70|古い/

/**
 * 控除割合の段とは別の日付を持つ論点。ここを段の境界と取り違えないよう、
 * 期間の検査から外す。
 *   - 上限額ルール（10億円→1億円）は課税期間の開始日で切り替わり、
 *     2024年10月1日という控除割合とは無関係の日付を持つ（/seido/keikasochi-1okuen-jogen）。
 */
const OTHER_SCHEDULE = /上限|億円/

function scopedArticles(): Map<string, Unit[]> {
  const byArticle = new Map<string, Unit[]>()
  for (const u of collect()) {
    const list = byArticle.get(u.where) ?? []
    list.push(u)
    byArticle.set(u.where, list)
  }
  const scoped = new Map<string, Unit[]>()
  for (const [where, units] of byArticle) {
    if (inScopeArticle(units.map(u => u.text).join(''))) scoped.set(where, units)
  }
  return scoped
}

// --- 検査本体 ---------------------------------------------------------------

test('正典（/seido/keikasochi-itsumade の表）が現行のスケジュールを持っている', () => {
  // 正典が静かに書き換わったら、下の検査は無意味になる。先にここで固定する。
  assert.equal(RATE_YEARS.get(70)?.has(2026), true, '2026年は70%の段に含まれるはず')
  assert.equal(RATE_YEARS.get(50)?.has(2026), false, '2026年は50%の段ではない（改正前の情報）')
  assert.equal(RATE_YEARS.get(50)?.has(2028), true, '50%になるのは2028年10月から')
  assert.equal(RATE_YEARS.get(0)?.has(2031), true, '控除不可は2031年10月以後')
  assert.equal(BOUNDARY_YEARS.has(2029), false, '2029年は段の境界ではない')
})

test('インボイス経過措置の控除割合が、正典の段と食い違っていない', () => {
  const bad: string[] = []
  for (const [where, units] of scopedArticles()) {
    for (const u of units) {
      if (ALLOWED.test(u.text)) continue
      const ys = years(u.text)
      if (ys.length === 0) continue
      const rates = [...u.text.matchAll(/(\d+)\s*[%％]/g)].map(m => Number(m[1]))
      for (const r of new Set(rates)) {
        const span = RATE_YEARS.get(r)
        if (!span) continue // 経過措置の控除割合ではない数値（税率10%など）は見ない
        const outside = ys.filter(y => !span.has(y))
        if (outside.length > 0) {
          bad.push(
            `${where}: ${r}% の段に無い年 ${[...new Set(outside)].join('・')} と同じ文にある`
            + `（正典では ${r}% は ${Math.min(...span)}〜${Math.max(...span)}年）\n    ← ${u.text.slice(0, 120)}`,
          )
        }
      }
    }
  }
  assert.deepEqual(bad, [], `控除割合の食い違い ${bad.length} 件:\n  ` + bad.join('\n  '))
})

test('インボイス経過措置の段の境界に、正典に無い年を書いていない', () => {
  const bad: string[] = []
  for (const [where, units] of scopedArticles()) {
    for (const u of units) {
      if (ALLOWED.test(u.text) || OTHER_SCHEDULE.test(u.text)) continue
      for (const m of u.text.matchAll(/(20\d{2})年\s*(9|10)月/g)) {
        const y = Number(m[1])
        if (BOUNDARY_YEARS.has(y)) continue
        bad.push(
          `${where}: 段の境界として ${m[0]} を書いている`
          + `（正典の境界年は ${[...BOUNDARY_YEARS].sort().join('・')}）\n    ← ${u.text.slice(0, 120)}`,
        )
      }
    }
  }
  assert.deepEqual(bad, [], `経過措置の期間の誤り ${bad.length} 件:\n  ` + bad.join('\n  '))
})

test('検査器そのものが本物の誤りを捕まえる（取り逃がしたら検査器が壊れている）', () => {
  // 2026-09-07 時点で /roumu/invoice-keika-sochoku-gimu-deadline に実在した文。
  const known = [
    '第2段階は2026年10月1日から2029年9月30日までで、控除できる割合が50％に下がります。',
    '2026年10月以降は25万円（50％控除）になり、2029年10月以降は控除がゼロになります。',
    '2026年の控除率変更（80%→50%）のタイミングで会計処理の見直しを行い、',
    '経過措置は2029年9月30日まで有効です。',
  ]
  for (const s of known) {
    assert.ok(!ALLOWED.test(s) && !OTHER_SCHEDULE.test(s), `許容規則が誤って通してしまう: ${s}`)
    const ys = years(s)
    const rates = [...s.matchAll(/(\d+)\s*[%％]/g)].map(m => Number(m[1]))
    const rateConflict = rates.some(r => {
      const span = RATE_YEARS.get(r)
      return !!span && ys.some(y => !span.has(y))
    })
    const boundaryConflict = [...s.matchAll(/(20\d{2})年\s*(9|10)月/g)]
      .some(m => !BOUNDARY_YEARS.has(Number(m[1])))
    assert.ok(rateConflict || boundaryConflict, `取り逃がした: ${s}`)
  }

  // 正しい記述は素通りさせる（過検知で正典を直せなくならないように）。
  const good = [
    '2026年10月1日からの控除割合は70%です。',
    '2028年10月1日〜2030年9月30日の課税仕入れは50%を控除できます。',
    '2023年10月1日から2026年9月30日までは80%を控除できます。',
    // 上限額ルールは控除割合の段と別の日付を持つ（2024年10月1日）。落としてはいけない。
    '2024年10月1日から2026年9月30日までの間に開始する課税期間では10億円、2026年10月1日以後に開始する課税期間では1億円です。',
  ]
  for (const s of good) {
    const ys = years(s)
    const rates = [...s.matchAll(/(\d+)\s*[%％]/g)].map(m => Number(m[1]))
    for (const r of rates) {
      const span = RATE_YEARS.get(r)
      if (!span) continue
      assert.deepEqual(ys.filter(y => !span.has(y)), [], `正しい文を落とした: ${s}`)
    }
    if (OTHER_SCHEDULE.test(s)) continue
    for (const m of s.matchAll(/(20\d{2})年\s*(9|10)月/g)) {
      assert.ok(BOUNDARY_YEARS.has(Number(m[1])), `正しい文を落とした: ${s}`)
    }
  }
})

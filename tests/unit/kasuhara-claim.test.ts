import { test } from 'node:test'
import assert from 'node:assert/strict'
import { USECASE_LIST } from '../../lib/usecase.ts'
import type { UseCase } from '../../lib/usecase.ts'

// ============================================================================
// カスハラ義務化の「事実」を機械で固定する
//
//   なぜ作ったか（2026-08-25）:
//     /roumu/customer-harassment-kigyou-kisoku-gimuuka（GSC imp 115 / clk 9）が本文で
//     「顧客等からの著しい迷惑行為への対応についても……実務上は『努力義務』として
//     扱われています」と書いていた。**2026年10月1日から措置義務**なので、読者に
//     「まだ努力義務だ」という誤った安心を与える。しかもこのページは同日の canonical
//     統合で5本の弱い側から評価を集約した統合先で、誤りに評価を集めている状態だった。
//
//   一次情報（2026-08-25 最終確認）:
//     厚生労働省「令和8年10月1日からハラスメント対策が強化されます」
//     https://www.mhlw.go.jp/content/11900000/001662576.pdf
//       - カスタマーハラスメント対策の義務化【改正労働施策総合推進法・指針の内容】
//       - 「事業主は、以下の措置を必ず講じなければなりません。」＝措置義務
//       - 施行日 2026年10月1日（施行期日を定める令和8年政令第17号で確定）
//       - 2025年6月11日は**公布日**（令和7年法律第63号）であって施行日ではない
//       - 企業規模による経過措置は無く、すべての事業主が対象
//     東京都カスタマーハラスメント防止条例の施行日は 2025年4月1日（令和7年4月1日）
//       https://www.hataraku.metro.tokyo.lg.jp/kaizen/ryoritsu/kasuhara/index.html
//
//   規律では防げなかった（記事は日次生成で増える）。だから道具にする。
//   ここが赤いまま本番へ出ることは、テストがCIとデプロイ手順に載っている限り無い。
// ============================================================================

/** 施行日の正典。ここを直せば検査もエラーメッセージも一斉に変わる。 */
const ENFORCEMENT_DATE = '2026年10月1日'

// 東京都条例の正式名は「カスタマー・ハラスメント」（中黒あり）。中黒の有無で検査から漏らさない
const KASUHARA = /カスハラ|カスタマー・?ハラスメント/

/**
 * カスハラの措置義務について、2026年10月1日以降は端的に誤りになる断定。
 * 「まだ義務ではない」と読者に思わせる表現を機械で止める。
 */
const FORBIDDEN: { re: RegExp; why: string; anySentence?: boolean }[] = [
  { re: /努力義務/, why: '国のカスハラ対策は2026年10月1日から措置義務。努力義務ではない' },
  { re: /義務ではありません|義務ではない|義務ではあ(り|)ま[せ]ん/, why: '措置義務である' },
  { re: /義務化されていません|義務化されていない/, why: '2026年10月1日から義務化される' },
  { re: /義務付ける(法律|規定|条文)は(現時点では)?(存在しません|ありません|施行されていません)/, why: '改正労働施策総合推進法が義務付ける' },
  // 2026-09-06: 「施行されていません」「義務でないとしても」は上の型に当たらず素通りしていた。
  { re: /(規程|規定|整備)は義務でない/, why: '2026年10月1日から措置義務である' },
  { re: /法的義務となっているわけではありません|直接義務ではない|直接の法的義務/, why: '措置義務である' },
  {
    re: /義務として確定しているわけではありません|義務として確定していません|義務(に|と)なっているわけではありません|義務化されるわけではありません/,
    why: '2026年10月1日施行の措置義務として確定している',
  },
  { re: /指針・推奨レベル/, why: '指針ではなく法律上の措置義務' },
  { re: /罰則付きで義務化する法律はまだ施行されていません/, why: '2026年10月1日施行が確定している' },
  // anySentence: カスハラ語を含まない文（「法制化の議論が進んでいます。」だけの文）も見る。
  // 2026-10-02 検証役の指摘: カスハラ語の無い文は素通りしていて、この型は効いていなかった
  { re: /義務化が議論される段階|義務化に向けた議論|法整備に向けた議論|法制化が検討|法制化の議論/, why: '議論ではなく成立・公布済みで施行日も確定', anySentence: true },
  { re: /今後は罰則を伴う義務規定へ移行する可能性|今後国の指針改正によって|義務化の範囲が広がる可能性/, why: '可能性ではなく確定した施行日がある' },
  { re: /2026年6月/, why: 'カスハラ義務化の施行日は2026年10月1日。2026年6月は誤り' },
  { re: /2025年6月11日から|2025年6月11日に施行|2025年6月11日施行/, why: '2025年6月11日は公布日であって施行日ではない' },
  {
    // 「2024年11月に成立した改正労働施策総合推進法」「2024年4月施行の改正労働施策総合推進法」
    // 「2024年のパワハラ指針改正」等。カスハラを措置義務化した改正法の年を取り違えている。
    re: /(2023|2024)年[^。]{0,20}(改正(された)?労働施策総合推進法|労働施策総合推進法[^。]{0,6}(改正|一部改正)|パワハラ指針改正|指針改正)/,
    why: 'カスハラを措置義務化した改正法は2025年6月11日公布（令和7年法律第63号）・2026年10月1日施行',
  },
]

/**
 * 唯一の正しい「努力義務」。改正労働施策総合推進法33条3項。
 * 自社の労働者が取引先等の労働者にカスハラをしたとき、相手方の事業主から
 * 事実確認等への協力を求められた場合に、これに応じるよう努める義務。
 */
const LEGITIMATE_EFFORT_DUTY = /取引先/

/**
 * もう一つの正しい「努力義務」: 東京都カスタマー・ハラスメント防止条例（2025年4月1日施行）。
 * 事業者の責務（9条）も措置（14条）も「講ずるよう努めなければならない」＝努力義務で、罰則は無い。
 *   https://www.reiki.metro.tokyo.lg.jp/reiki/reiki_honbun/g101RG00005328.html（2026-10-02 確認）
 * 国の法律（労働施策総合推進法）の話を同じ文でしていれば、ここは通さない。
 */
function isTokyoOrdinanceOnly(s: string): boolean {
  return /東京都|都条例/.test(s) && /条例/.test(s) && !/労働施策総合推進法|措置義務|2026年10月|(?<!全)国|改正法|法律/.test(s)
}

/** 各記事の全文（検査対象の文字列を1本にまとめる） */
function textsOf(u: UseCase): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  const push = (path: string, v?: string) => {
    if (typeof v === 'string' && v.length > 0) out.push({ path, text: v })
  }
  push('h1', u.h1)
  push('titleKeyword', u.titleKeyword)
  push('description', u.description)
  push('lead', u.lead)
  push('ogCategory', u.ogCategory)
  u.sections?.forEach((s, i) => {
    push(`sections[${i}].heading`, s.heading)
    s.body?.forEach((b, j) => push(`sections[${i}].body[${j}]`, b))
  })
  u.examples?.forEach((e, i) => {
    push(`examples[${i}].ask`, e.ask)
    push(`examples[${i}].answer`, e.answer)
  })
  u.faqs?.forEach((f, i) => {
    push(`faqs[${i}].q`, f.q)
    push(`faqs[${i}].a`, f.a)
  })
  return out
}

/** 「。」で文に割る。判定を段落でなく文の単位で行うため（段落だと文脈が混ざる）。 */
function sentences(text: string): string[] {
  return text.split(/(?<=。)/).filter((s) => s.trim().length > 0)
}

function kasuharaArticles(): UseCase[] {
  return USECASE_LIST.filter((u) =>
    textsOf(u).some((t) => KASUHARA.test(t.text)) || KASUHARA.test(u.h1),
  )
}

test('カスハラ記事が1本以上ある（検査そのものが空振りしていないことの確認）', () => {
  assert.ok(kasuharaArticles().length > 0, 'カスハラ記事が0件。検査対象の抽出が壊れている')
})

test('カスハラの措置義務を「努力義務」「義務ではない」と断定している箇所が無い', () => {
  const violations: string[] = []
  for (const u of kasuharaArticles()) {
    for (const { path, text } of textsOf(u)) {
      for (const s of sentences(text)) {
        // 判定は「カスハラの話をしている文」に限る。
        // 育児介護休業法や女性活躍推進法の努力義務まで巻き込まない。
        const aboutKasuhara = KASUHARA.test(s) || /顧客等/.test(s)
        for (const { re, why, anySentence } of FORBIDDEN) {
          if (!aboutKasuhara && !anySentence) continue
          if (!re.test(s)) continue
          // 33条3項（取引先事業主への協力）と東京都条例は本当に努力義務なので通す
          if (re.source.includes('努力義務') && (LEGITIMATE_EFFORT_DUTY.test(s) || isTokyoOrdinanceOnly(s))) continue
          violations.push(`${u.slug} ${path}\n      理由: ${why}\n      該当: ${s.trim()}`)
        }
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `カスハラ義務化について誤った断定が ${violations.length} 件あります。\n` +
      `一次情報: https://www.mhlw.go.jp/content/11900000/001662576.pdf\n\n` +
      violations.map((v) => `  - ${v}`).join('\n\n'),
  )
})

test('義務の有無を語るカスハラ記事は、施行日 2026年10月1日 を必ず書いている', () => {
  const missing: string[] = []
  for (const u of kasuharaArticles()) {
    const all = textsOf(u).map((t) => t.text).join('\n')
    // 「義務」の話をしていない記事（記録の残し方だけ等）には求めない
    const talksAboutDuty = /義務化|措置義務|義務付け|義務です|義務になり/.test(all)
    if (!talksAboutDuty) continue
    if (!all.includes(ENFORCEMENT_DATE)) missing.push(u.slug)
  }
  assert.deepEqual(
    missing,
    [],
    `カスハラの義務を語りながら施行日「${ENFORCEMENT_DATE}」を書いていない記事が ${missing.length} 本あります: ${missing.join(', ')}`,
  )
})

/**
 * 2026-10-02: 施行日（2026年10月1日）を過ぎても「施行されます」「施行に向けて」と
 * 未来の話として書いた記事が本番に残っていた（手書き4本・日次生成の約20本）。
 * 施行後に読む人には「まだ始まっていない」と読める。施行日以降はビルドで止める。
 */
const PRE_ENFORCEMENT: RegExp[] = [
  /施行されます/,
  /施行を前に/,
  /施行に向け(て|た)/,
  /施行(日)?までに/,
  /施行までの/,
  /施行の\d+か月前/,
  /2026年10月(1日)?の施行まで/,
  /施行前から/,
  /施行(日)?に間に合/,
  /施行.{0,30}間に合わ/,
  /措置義務になります/,
]

test('施行日（2026年10月1日）以降、カスハラ記事に施行前の言い回しが残っていない', () => {
  const violations: string[] = []
  for (const u of kasuharaArticles()) {
    for (const { path, text } of textsOf(u)) {
      for (const s of sentences(text)) {
        // カスハラ記事の中の文は全部見る（主語の無い「施行日までに…」も読者には同じ誤り）。
        // 東京都条例（2025年4月1日施行）だけを語る文は対象外
        if (/東京都|条例/.test(s) && !/2026年10月|措置義務/.test(s)) continue
        // 1文は1件に数える（「施行に間に合」と「施行…間に合わ」の両方に当たって二重に数えていた）
        if (PRE_ENFORCEMENT.some((re) => re.test(s))) violations.push(`${u.slug} ${path}\n      該当: ${s.trim()}`)
      }
    }
  }
  assert.deepEqual(violations, [], `施行前の言い回しが ${violations.length} 件残っています（施行日は ${ENFORCEMENT_DATE}・施行済み）:\n` +
    violations.map((v) => `  - ${v}`).join('\n\n'))
})

test('東京都カスタマーハラスメント防止条例の施行日を誤って書いていない', () => {
  const violations: string[] = []
  for (const u of kasuharaArticles()) {
    for (const { path, text } of textsOf(u)) {
      for (const s of sentences(text)) {
        if (!/東京都/.test(s) || !/条例/.test(s) || !/施行/.test(s)) continue
        // 正: 2025年4月1日施行（令和7年4月1日）。
        // 「2024年10月に施行」「2024年4月施行」「2023年に施行」「（2024年施行）」が本文にあった。
        //
        // 判定は「条例」という語の近傍に限る。1文の中で都条例と国の施行日を並べて書く
        // 正しい書き方（東京都は2025年4月1日／国は2026年10月1日）まで挙げないため。
        for (let i = s.indexOf('条例'); i !== -1; i = s.indexOf('条例', i + 1)) {
          const near = s.slice(Math.max(0, i - 30), i + 12)
          for (const y of near.match(/20\d{2}\s*年(\s*\d{1,2}\s*月)?/g) ?? []) {
            const n = y.replace(/\s/g, '')
            if (n !== '2025年4月' && n !== '2025年') {
              violations.push(
                `${u.slug} ${path}: 東京都条例の近傍に「${n}」がある（正: 2025年4月1日施行）\n      該当: ${s.trim()}`,
              )
            }
          }
        }
      }
    }
  }
  assert.deepEqual(violations, [], `東京都条例の施行日の誤り ${violations.length} 件:\n` +
    violations.map((v) => `  - ${v}`).join('\n'))
})

/**
 * 2026-10-02: 東京都カスタマー・ハラスメント防止条例を「防止措置が義務化」「措置義務が課されています」と
 * 書いた文が4つあった。条例の9条・14条はどちらも「講ずるよう努めなければならない」（努力義務・罰則なし）。
 * 国の措置義務（2026年10月1日施行）と混ぜると、都外の読者は「東京だけの話」、都内の読者は
 * 「もう1年半前から義務だった」と誤って読む。
 *   一次情報: https://www.reiki.metro.tokyo.lg.jp/reiki/reiki_honbun/g101RG00005328.html
 *
 * 判定は「条例」の語の後ろ、国の話（国では／労働施策総合推進法 等）が始まるまでの範囲だけを見る。
 * 「東京都は2025年4月1日に条例を施行し、国では…措置義務が2026年10月1日から施行」という正しい並べ方は通す。
 */
const ORDINANCE_DUTY = /(?<!努力)義務(化|が課|を課|付け|づけ|となり|となって|です|があ|として|を負|が生じ)|(?<!努力)措置義務|講じる義務|講ずる義務/
const NATIONAL_TOPIC = /(?<!全)国(では|でも|レベル|の法|は|の措置)|労働施策総合推進法/

test('東京都カスタマー・ハラスメント防止条例を「義務」と書いていない（正: 努力義務）', () => {
  const violations: string[] = []
  for (const u of kasuharaArticles()) {
    for (const { path, text } of textsOf(u)) {
      for (const s of sentences(text)) {
        if (!/東京都|都条例/.test(s)) continue
        for (let i = s.indexOf('条例'); i !== -1; i = s.indexOf('条例', i + 1)) {
          const after = s.slice(i)
          const stop = after.search(NATIONAL_TOPIC)
          const scope = stop === -1 ? after : after.slice(0, stop)
          if (ORDINANCE_DUTY.test(scope)) {
            violations.push(`${u.slug} ${path}\n      該当: ${s.trim()}`)
            break
          }
        }
      }
    }
  }
  assert.deepEqual(violations, [], `東京都条例を義務と書いた文 ${violations.length} 件（条例は努力義務・罰則なし）:\n` +
    violations.map((v) => `  - ${v}`).join('\n\n'))
})

test('全記事に「番頷」等の製品名の誤字が無い', () => {
  const violations: string[] = []
  // 「番頭」の誤変換。1文字違いで読者には別語に見える
  const TYPOS: [RegExp, string][] = [
    [/番頷/g, '番頭'],
    [/番頸/g, '番頭'],
    [/番豆頁/g, '番頭'],
  ]
  for (const u of USECASE_LIST) {
    for (const { path, text } of textsOf(u)) {
      for (const [re, correct] of TYPOS) {
        if (re.test(text)) {
          violations.push(`${u.slug} ${path}: 「${text.match(re)![0]}」→「${correct}」`)
        }
        re.lastIndex = 0
      }
    }
  }
  assert.deepEqual(violations, [], `製品名の誤字 ${violations.length} 件:\n` +
    violations.map((v) => `  - ${v}`).join('\n'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeBlock, enforceTaxonomy } from '../../lib/gap-engine/engine/validateSheet.ts'
import { DISCLAIMER } from '../../lib/gap-engine/taxonomy/items.ts'
import { blockLine, sheetPlainText } from '../../lib/gap-engine/ui/renderSheet.ts'
import { heuristicGapSheet } from '../../lib/gap-engine/fallback.ts'
import type { GapBlock, GapSheet } from '../../lib/gap-engine/engine/types.ts'

test('sanitizeBlock drops written without real quote', () => {
  const source = '始業は午前9時とする。'
  const block: GapBlock = {
    id: 'kasuhara.policy',
    group: 'kasuhara_2026_10',
    title: 'カスタマーハラスメントの方針',
    status: 'written',
    priority: 'p0_deadline',
    what_found: '捏造',
    what_not_found: '',
    why_it_matters: '',
    next_step: '',
    citations: [{ quote: 'この引用は本文にない' }],
  }
  const out = sanitizeBlock(source, block)
  assert.equal(out.status, 'unmentioned')
  assert.equal(out.citations.length, 0)
})

test('heuristicGapSheet never claims written without quote', () => {
  const sheet = heuristicGapSheet({
    text: '第1条 始業は午前9時、終業は午後6時とする。年次有給休暇を与える。',
    titleGuess: 'thin.txt',
  })
  assert.equal(sheet.disclaimer, DISCLAIMER)
  const hours = sheet.blocks.find(b => b.id === 'abs.hours_start_end')
  assert.ok(hours)
  if (hours!.status === 'written') {
    assert.ok((hours!.citations?.length ?? 0) > 0)
  }
  const kasu = sheet.blocks.find(b => b.id === 'kasuhara.policy')
  assert.equal(kasu?.status, 'unmentioned')
})

test('enforceTaxonomy fills missing taxonomy ids', () => {
  const source = '始業は午前9時とする。'
  const thin: GapSheet = {
    schema_version: 'x',
    disclaimer: '',
    document: {
      title_guess: 'x',
      page_count: 1,
      pages_read: 1,
      pages_unread: [],
      char_count: source.length,
      extracted_ok: true,
    },
    summary: {
      headline: '',
      written_count: 0,
      ops_missing_count: 0,
      unmentioned_count: 0,
      unread_note: null,
    },
    blocks: [],
    contradictions: [],
    followups: [],
  }
  const out = enforceTaxonomy(thin, source)
  assert.ok(out.blocks.length > 10)
  assert.ok(out.blocks.some(b => b.id === 'kasuhara.policy'))
})

// ============================================================================
// 2026-08-31: 同じ型の欠陥が1日で3件出た——「プロンプトが契約を書いていないので、
// モデルが別名で返し、下流が黙って捨てる」。捨てられた側は画面上
// 「このファイルでは触れていない」になるため、**壊れて見えない**のが最悪だった。
//   1件目 status: written を定義しておらず "found" が返る
//   2件目 出力スキーマ自体が無く、根拠が citations でなく quote で返る
//   3件目 逐語引用に「（第2条）」が付いて本文と一致しない
// プロンプト側は直したが、モデルを変えれば同じ形で再発しうる。
// 受け止める側をここで固定する。
// ============================================================================
test('モデルが別名・出典付きで返しても、正しい引用を捨てない', () => {
  const source = '第2条 始業は午前9時、終業は午後6時とする。'
  const drifted = {
    id: 'abs.hours_start_end',
    title: '始業・終業の時刻',
    group: 'absolute_lsa89',
    priority: 'p1_absolute',
    status: 'found',                                        // written の別名
    quote: '始業は午前9時、終業は午後6時とする。（第2条）',   // citations でなく quote・出典付き
    note: '始業・終業の時刻が明記されています。',              // what_found でなく note
    what_found: '',
    what_not_found: '',
    why_it_matters: '',
    next_step: '',
    citations: [],
  } as never

  const out = sanitizeBlock(source, drifted)
  assert.equal(out.status, 'written', 'status の別名 found を written として受け止める')
  assert.equal(out.citations.length, 1, 'quote に入った根拠を citations として拾う')
  assert.ok(out.what_found, 'note に入った要約を what_found として拾う')
})

test('本文に無い引用は、別名で来ても通さない', () => {
  const fabricated = {
    id: 'abs.break', title: '休憩時間', group: 'absolute_lsa89', priority: 'p1_absolute',
    status: 'found', quote: '休憩は3時間とする。', what_found: '', what_not_found: '',
    why_it_matters: '', next_step: '', citations: [],
  } as never
  const out = sanitizeBlock('第3条 休憩は正午から1時間とする。', fabricated)
  assert.equal(out.status, 'unmentioned', '捏造引用は written にしない')
  assert.equal(out.citations.length, 0)
})

// 2026-09-06: 禁止語の関門は blocks と followups には効いていたが、
//   **結論（headline）と未読注記は素通り**だった。監査で誤りが出た位置のひとつは結論の隣で、
//   結論は1枚でいちばん大きく出る。LLM が書く経路を全部通すことを固定する。
test('禁止語は、結論・未読注記・followups・項目のどこに来ても落とす', () => {
  const source = '第24条 会社は、顧客等からの著しい迷惑行為から従業員を守るため、対応方針を定める。'
  const sheet = {
    schema_version: 'x',
    disclaimer: '',
    document: { title_guess: 't', page_count: 1, pages_read: 1, pages_unread: [], char_count: 40, extracted_ok: false },
    summary: {
      headline: '2026年10月1日の努力義務化に向けて、方針の整備が要ります。読み取りは途中までです。',
      written_count: 0, ops_missing_count: 0, unmentioned_count: 0,
      unread_note: '未読が2ページあります。努力義務化の範囲は確認できていません。',
    },
    blocks: [],
    contradictions: [],
    followups: ['努力義務化に向けて窓口を決めてください。', '相談窓口の担当者を決めてください。'],
  } as unknown as GapSheet

  const out = enforceTaxonomy(sheet, source)
  const all = JSON.stringify({ h: out.summary.headline, u: out.summary.unread_note, f: out.followups })
  assert.ok(!all.includes('努力義務'), '結論・未読注記・followups から禁止語が消えている: ' + all)
  assert.ok(out.summary.headline.length > 0, '結論が空にならない（文単位で落とす）')
  assert.ok(out.followups.some(f => f.includes('相談窓口')), '問題の無い followups は残す')
})

// ============================================================================
// 2026-09-07 開業社労士の走破: 「顧問先に勧めない」の理由が2件。どちらも
// **引用を隣に置いたおかげで読み手が照合でき、その照合で製品が外した**ものだった。
// ============================================================================

// (1) 引用した原文にその制度の言葉が1つも無いのに「制度はある」と分類していた。
//     実測2件: ops.annual_leave_5days（原文に「時季指定」「年5日」が無い）と
//     abs.wage_cutoff_paydate（第40条は構成・計算方法・支払方法まで。締切・支払日が無い）。
//     citations は本文に実在する別の条文なので quoteExists は通ってしまう。
test('引用にその項目の言葉が無ければ、「ある」側の分類にしない', () => {
  const yukyu =
    '第37条 年次有給休暇は、従業員があらかじめ請求する時季に与える。ただし、事業の正常な運営を妨げる場合は、他の時季に変更することがある。'
  const jiki = sanitizeBlock(yukyu, {
    id: 'ops.annual_leave_5days',
    group: 'operations',
    title: '年5日の時季指定',
    status: 'ops_missing',
    priority: 'p1_absolute',
    what_found: '会社が時季を指定して年5日を取得させる制度の存在は読み取れます。',
    what_not_found: '',
    why_it_matters: '',
    next_step: '',
    citations: [{ quote: '年次有給休暇は、従業員があらかじめ請求する時季に与える。' }],
  } as GapBlock)
  assert.ok(
    jiki.status !== 'ops_missing' && jiki.status !== 'written',
    `原文に「時季指定」も「年5日」も無いのに ${jiki.status} で出している`,
  )
  assert.ok(!jiki.what_found, `根拠の無い要約が残っている: ${jiki.what_found}`)

  const chingin = '第40条 賃金は、基本給及び諸手当をもって構成し、その計算方法及び支払方法は賃金規程に定める。'
  const shimekiri = sanitizeBlock(chingin, {
    id: 'abs.wage_cutoff_paydate',
    group: 'absolute_lsa89',
    title: '賃金の締切と支払時期',
    status: 'written',
    priority: 'p1_absolute',
    what_found: '第40条で賃金規程への委譲が記載されており、締切と支払時期が別途規程に定められていることが示唆されています。',
    what_not_found: '',
    why_it_matters: '',
    next_step: '',
    citations: [{ quote: 'その計算方法及び支払方法は賃金規程に定める。' }],
  } as GapBlock)
  assert.ok(
    shimekiri.status !== 'ops_missing' && shimekiri.status !== 'written',
    `原文に締切も支払日も無いのに ${shimekiri.status} で出している`,
  )
})

// 関門が「ある」側を一律に殺していないこと。実際に締切と支払日が書いてあれば written のまま。
test('引用にその項目の言葉があれば、「ある」側の分類を落とさない', () => {
  const src = '第5条 賃金は毎月末日締め翌月15日払いとする。'
  const out = sanitizeBlock(src, {
    id: 'abs.wage_cutoff_paydate',
    group: 'absolute_lsa89',
    title: '賃金の締切と支払時期',
    status: 'written',
    priority: 'p1_absolute',
    what_found: '締切と支払日が書かれています。',
    what_not_found: '',
    why_it_matters: '',
    next_step: '',
    citations: [{ quote: '賃金は毎月末日締め翌月15日払いとする。' }],
  } as GapBlock)
  assert.equal(out.status, 'written')
  assert.equal(out.citations.length, 1)
})

// (2) 原文「従業員の定年は満60歳とし」に対して「規程にある」を出していた。
//     ページ全体で 65歳・継続雇用・高年齢 は0件。危険の向きが逆で、**穴を「あり」と
//     見せて安心させている**。高年法の判定はこの製品の範囲外なので、判定を足すのではなく
//     「記載の有無を見ている／内容の適否は見ていない」が伝わる表示にする。
test('「ある」側のラベルが、内容が妥当という意味に読めない', () => {
  const source = '第38条 従業員の定年は満60歳とし、定年に達した日の属する月の末日をもって退職とする。'
  const sheet = enforceTaxonomy(
    {
      schema_version: 'x',
      disclaimer: '',
      document: { title_guess: 'teinen.txt', page_count: 0, pages_read: 0, pages_unread: [], char_count: source.length, extracted_ok: true },
      summary: { headline: '', written_count: 0, ops_missing_count: 0, unmentioned_count: 0, unread_note: null },
      blocks: [
        {
          id: 'abs.retirement',
          group: 'absolute_lsa89',
          title: '退職',
          status: 'written',
          priority: 'p1_absolute',
          what_found: '定年は満60歳と書かれています。',
          what_not_found: '',
          why_it_matters: '',
          next_step: '',
          citations: [{ quote: '従業員の定年は満60歳とし' }],
        },
      ],
      contradictions: [],
      followups: [],
    } as unknown as GapSheet,
    source,
  )

  const teinen = sheet.blocks.find(b => b.id === 'abs.retirement')
  assert.equal(teinen?.status, 'written', '記載そのものは読めているので「ある」側は維持する')

  const label = blockLine('written', '').trim()
  assert.ok(
    !/規程にある|規定にある|問題な|適合|妥当|対応済|OK|大丈夫/.test(label),
    `「ある」側のラベルが内容の適否まで言っていると読める: ${label}`,
  )
  assert.ok(/記載|書いて/.test(label), `ラベルが「記載の有無」を指していない: ${label}`)

  // 1枚のどこかに、見ている範囲（記載の有無であって内容の適否ではない）が書いてある。
  const text = sheetPlainText(sheet)
  const scope = text
    .split('\n')
    .find(line => /内容/.test(line) && /見ていません|判断していません|確認していません|していません/.test(line))
  assert.ok(scope, '「内容が今の法令に合っているかは見ていない」と読める行が1枚に無い')
  assert.ok(/法令|法律/.test(scope!), `見ている範囲の説明が内容の適否に触れていない: ${scope}`)
})

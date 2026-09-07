// ============================================================================
// 関門: 「赤に見えて、実は1件も測っていない」テストファイルを検出する。
//
// 2026-09-07 の実測。tests/unit/gap-engine-sanitize.test.ts（引用の実在・禁止語・
// 分類の妥当性という、この製品の中核の検査 9 件）が、`npm run test:unit`
// （= `node --test`）では **ファイルごと import に失敗して 1 件も実行されていなかった**。
//
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find module
//     '/Users/takeshi/banto/lib/gap-engine/taxonomy/items'
//     imported from /Users/takeshi/banto/lib/gap-engine/engine/validateSheet.ts
//
// 原因は lib/gap-engine/ 配下の相対 import が拡張子無しだったこと。Node の ESM は
// 拡張子を推測しないので解決できない（tsx や Next のバンドラは推測するので、
// `npm run build` も `npx tsx --test` も緑のままだった）。
//
// 最悪なのは、これが **「ベースラインの赤 7 件」の 1 件として数えられていた** こと。
// 既知の赤として扱われると誰も中を見なくなる。落ちているのと測っていないのは違う。
//
// この検査は tests/ 配下の全テストファイルから静的 import グラフを辿り、
// Node の ESM 解決で読めない指定が 1 つでもあれば落ちる。
//
// 実装上の注意（Node の実挙動に合わせてある。緩めると意味が無くなる）:
//   - `import type` / `export type` は Node の型ストリップが文ごと消すので、
//     解決されなくても実行時には落ちない。だから追わない（追うと偽陽性になる。
//     例: lib/risk-fallback.ts の `import type { ... } from './prompts'`）。
//   - 動的 import は評価されるまで落ちないので追わない。
//   - `import.meta.resolve()` は存在確認をしない（URL を組み立てて返すだけ）ので、
//     file: に解決されたものは必ず existsSync で実在を確かめる。
//   - `import.meta.resolve(spec, parent)` の第2引数は
//     `--experimental-import-meta-resolve` 無しでは **黙って無視される**。
//     相対指定を渡すと親ではなくこのファイルからの解決になり、存在しないパスを
//     でっち上げて全件を偽の赤にする（2026-09-07 に実際に踏んだ）。
//     だから相対指定は new URL() で親から自分で組む。
// ============================================================================

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..')
const TESTS_DIR = path.join(REPO_ROOT, 'tests')

/** 中身を辿って更に import を読む対象の拡張子。 */
const TRAVERSABLE = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'])

/**
 * 静的 import / export の from 句を行頭から拾う。
 *
 * 先頭を `^[ \t]*` に固定してあるので、`// import ...` や JSDoc の ` * import ...`
 * といったコメント行は拾わない。import 節に許す文字を `[\w\s{},*$]` に絞ってあるので、
 * `export const X = ...` のような別の文へ食い込むこともしない。
 */
const RE_TYPE_ONLY = /^[ \t]*(?:import|export)[ \t]+type[\s\S]{0,600}?from[ \t]*(['"])([^'"]+)\1/gm
const RE_VALUE = /^[ \t]*(?:import|export)(?![ \t]+type[ \t])[\w\s{},*$]*?from[ \t]*(['"])([^'"]+)\1/gm
const RE_SIDE_EFFECT = /^[ \t]*import[ \t]*(['"])([^'"]+)\1/gm

type Problem = {
  testFile: string
  chain: string[]
  specifier: string
  reason: string
}

function listTestFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listTestFiles(full))
    } else if (entry.endsWith('.test.ts') || entry.endsWith('.test.mts')) {
      out.push(full)
    }
  }
  return out.sort()
}

/** そのファイルが実行時に本当に読み込む指定だけを返す（型だけの import は除く）。 */
function runtimeSpecifiers(source: string): string[] {
  const typeOnly = new Set<string>()
  for (const m of source.matchAll(RE_TYPE_ONLY)) typeOnly.add(`${m.index}`)

  const specs = new Set<string>()
  for (const m of source.matchAll(RE_VALUE)) {
    if (typeOnly.has(`${m.index}`)) continue
    specs.add(m[2])
  }
  for (const m of source.matchAll(RE_SIDE_EFFECT)) {
    if (typeOnly.has(`${m.index}`)) continue
    specs.add(m[2])
  }
  return [...specs]
}

function checkGraph(testFile: string, visitedAll: Set<string>): Problem[] {
  const problems: Problem[] = []
  const seen = new Set<string>([testFile])
  const queue: { file: string; chain: string[] }[] = [{ file: testFile, chain: [] }]

  while (queue.length > 0) {
    const { file, chain } = queue.shift()!
    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }

    const parentUrl = pathToFileURL(file).href
    for (const spec of runtimeSpecifiers(source)) {
      if (spec.startsWith('node:')) continue

      let resolved: string
      try {
        // 相対・絶対・file: は親から自分で組む（第2引数は効かない。冒頭の注記を参照）。
        // それ以外（bare specifier）は node_modules 解決を Node 本体に任せる。
        resolved =
          spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/') || spec.startsWith('file:')
            ? new URL(spec, parentUrl).href
            : import.meta.resolve(spec)
      } catch (err) {
        problems.push({
          testFile,
          chain,
          specifier: spec,
          reason: `${(err as { code?: string }).code ?? 'RESOLVE_FAILED'} — ${file} から解決できない`,
        })
        continue
      }

      if (!resolved.startsWith('file:')) continue
      const target = fileURLToPath(resolved)

      if (!existsSync(target)) {
        problems.push({
          testFile,
          chain,
          specifier: spec,
          reason: `ERR_MODULE_NOT_FOUND — ${file} が読む ${target} が無い（Node の ESM は拡張子を推測しない）`,
        })
        continue
      }

      // node_modules と リポ外は、そこから先を辿らない。
      if (target.includes(`${path.sep}node_modules${path.sep}`)) continue
      if (!target.startsWith(REPO_ROOT + path.sep)) continue
      if (!TRAVERSABLE.has(path.extname(target))) continue
      if (seen.has(target)) continue

      seen.add(target)
      visitedAll.add(target)
      queue.push({ file: target, chain: [...chain, path.relative(REPO_ROOT, file)] })
    }
  }

  return problems
}

test('tests/ の全テストファイルが node --test で import できる（0件実行のまま赤に埋もれない）', () => {
  const testFiles = listTestFiles(TESTS_DIR)
  assert.ok(testFiles.length > 0, 'tests/ にテストファイルが1件も見つからない。走査対象の指定が壊れている')

  const visitedAll = new Set<string>()
  const problems: Problem[] = []
  for (const f of testFiles) problems.push(...checkGraph(f, visitedAll))

  // この関門自体が「何も測らない緑」に劣化していないことを確かめる。
  // 上の正規表現が壊れて指定を1つも拾わなくなると、problems は当然 0 件になり
  // 検査は緑のまま通る——今回直したのと同じ「赤に見えて測っていない」形になる。
  // だから **実際に辿った本数** に下限を置く。
  // 2026-09-07 実測: テスト 44 本から実装側 38 本（lib/ と app/）へ到達。
  assert.ok(
    visitedAll.size >= 30,
    `import グラフの走査が ${visitedAll.size} 本しか届いていない（2026-09-07 実測は 38 本）。` +
      `検査そのものが壊れている疑いが強い。runtimeSpecifiers() の正規表現を確認すること`,
  )

  const report = problems
    .map((p) => {
      const via = p.chain.length > 0 ? `\n      経由: ${p.chain.join(' -> ')}` : ''
      return `  - ${path.relative(REPO_ROOT, p.testFile)}\n      指定: '${p.specifier}'\n      理由: ${p.reason}${via}`
    })
    .join('\n')

  assert.equal(
    problems.length,
    0,
    `import に失敗して1件も実行されないテストファイルがある（${testFiles.length}件中 ${problems.length}件の解決不能）:\n${report}\n` +
      `直し方: 相対 import に拡張子を書く（このリポの流儀。tsconfig の allowImportingTsExtensions が有効）。`,
  )
})

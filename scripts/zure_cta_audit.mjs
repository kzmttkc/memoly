#!/usr/bin/env node
/**
 * zure_cta_audit.mjs — 公開面→/zure の UTM 監査（CEO W1）
 *
 * 失敗条件:
 *   - /roumu/[slug] の CTA が素の /zure（utm なし）
 *   - ヒーロー二次が /business（獲得死に面）へ逃げる
 *
 * Usage: node scripts/zure_cta_audit.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagePath = path.join(ROOT, 'app/roumu/[slug]/page.tsx')
const usecasePath = path.join(ROOT, 'lib/usecase.ts')

const page = fs.readFileSync(pagePath, 'utf8')
const usecase = fs.readFileSync(usecasePath, 'utf8')

const fails = []

if (!page.includes('zureHref(')) {
  fails.push('roumu/[slug]/page.tsx が zureHref を使っていない')
}
if (!page.includes('const ctaHref')) {
  fails.push('ctaHref が無い（旧 signupHref のまま）')
}
if (page.includes('href="/business"') && page.includes('全体像')) {
  fails.push('ヒーロー二次が /business のまま（獲得死に面）')
}
if (!page.includes('href="/offer"')) {
  fails.push('ヒーロー二次が /offer になっていない')
}

const slugs = [...usecase.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1])
const utmCount = [...usecase.matchAll(/signupUtm:/g)].length

const report = {
  generatedAt: new Date().toISOString(),
  usecaseSlugs: slugs.length,
  signupUtmExplicit: utmCount,
  defaultUtmViaZureHref: page.includes('zureHref(\'roumu\'') || page.includes('zureHref("roumu"'),
  secondaryOffer: page.includes('href="/offer"'),
  fails,
  ok: fails.length === 0,
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)

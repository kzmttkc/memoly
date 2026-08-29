#!/usr/bin/env node
/**
 * ceo_weekly_pdca.mjs — 評価3軸付き週次PDCA（自律発火用）
 *
 * Usage:
 *   node scripts/ceo_weekly_pdca.mjs
 *   node scripts/ceo_weekly_pdca.mjs --dry-run
 *
 * Env:
 *   PLAUSIBLE_API_KEY（任意。無ければ snapshot / MANUAL）
 *
 * Writes:
 *   docs/ceo/state/p0_scoreboard.json（p0_scoreboard経由）
 *   docs/ceo/state/pdca_latest.json
 *   docs/ceo/state/pdca_log.jsonl（追記）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const STATE = path.join(ROOT, 'docs/ceo/state')
const SNAP = path.join(STATE, 'plausible_snapshot.json')
const OUT = path.join(STATE, 'pdca_latest.json')
const LOG = path.join(STATE, 'pdca_log.jsonl')
const dry = process.argv.includes('--dry-run')

function runScoreboard() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/p0_scoreboard.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    throw new Error(`p0_scoreboard exit ${r.status}`)
  }
  return JSON.parse(fs.readFileSync(path.join(STATE, 'p0_scoreboard.json'), 'utf8'))
}

async function fetchEvent(name, apiKey) {
  const end = new Date().toISOString().slice(0, 10)
  const filters = `event:name==${name}`
  const url =
    `https://plausible.io/api/v1/stats/aggregate?site_id=${encodeURIComponent('sharoushi-agent.com')}` +
    `&period=custom&date=2026-07-01,${end}&metrics=events,visitors` +
    `&filters=${encodeURIComponent(filters)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) throw new Error(`Plausible ${name} HTTP ${res.status}`)
  const json = await res.json()
  return {
    events: json?.results?.events?.value ?? null,
    visitors: json?.results?.visitors?.value ?? null,
  }
}

async function liveFunnel(apiKey) {
  const names = [
    'zure_landing',
    'zure_sheet_shown',
    'zure_sample_clicked',
    'signup_started',
    'signup_completed',
    'signup_blocked_age',
    'signup_blocked_consent',
    'banto_cta',
    'offer_view',
  ]
  const out = {}
  for (const n of names) {
    try {
      out[n] = await fetchEvent(n, apiKey)
    } catch (e) {
      out[n] = { error: String(e.message || e) }
    }
  }
  return out
}

function scoreAxes(board, funnel) {
  const file = board.northStar?.zureShown ?? 0
  const target = board.northStar?.fileTarget ?? 10
  const signupS = funnel?.signup_started?.visitors
  const signupC = funnel?.signup_completed?.visitors
  const landing = funnel?.zure_landing?.visitors
  const sheet = funnel?.zure_sheet_shown?.visitors
  const sample = funnel?.zure_sample_clicked?.events ?? 0

  let integration = 3.0
  if (file >= 5) integration += 0.5
  if (file >= 10) integration += 0.7
  if (board.deploy?.zureTrustLineLive) integration += 0.2
  if (board.deploy?.kasuharaZureBridgeLive) integration += 0.2

  let competitive = 3.4
  if (landing != null && sheet != null && landing > 0) {
    const rate = sheet / landing
    if (rate >= 0.35) competitive += 0.4
    else if (rate < 0.15) competitive -= 0.3
  }
  if (sample > 0) competitive += 0.1

  let lp = 3.0
  if (board.deploy?.zureTrustLineLive) lp += 0.2
  if (funnel?.offer_view?.visitors > 0) lp += 0.2
  if (file >= 3) lp += 0.3

  const clamp = (n) => Math.max(1, Math.min(5, Number(n.toFixed(1))))
  return {
    integration: clamp(integration),
    competitiveEdge: clamp(competitive),
    lpTopTier: clamp(lp),
    fileProgress: `${file}/${target}`,
    signupPass:
      signupS && signupC != null ? Number((signupC / Math.max(1, signupS)).toFixed(2)) : null,
    sheetPerLanding:
      landing && sheet != null ? Number((sheet / Math.max(1, landing)).toFixed(2)) : null,
  }
}

function nextHand(axes, funnel, board) {
  const file = board.northStar?.zureShown ?? 0
  if (file < 10) {
    const landing = funnel?.zure_landing?.visitors ?? 0
    const sheet = funnel?.zure_sheet_shown?.visitors ?? 0
    if (landing >= 5 && sheet / Math.max(1, landing) < 0.25) {
      return {
        hand: '/zure 第一面を1変数だけ変える（信頼・サンプル・形式）',
        axis: 'lpTopTier + competitiveEdge',
        why: '着地はあるが sheet が足りない',
      }
    }
    if ((funnel?.banto_cta?.visitors ?? 0) < 20) {
      return {
        hand: 'カスハラ上位ガイド mid CTA の文言/位置を1変数修理',
        axis: 'competitiveEdge',
        why: '会社向け送客クリックが細い',
      }
    }
    return {
      hand: '規定例→/zure→sheet の閉ループを1箇所だけ強化（流入を足さない）',
      axis: 'integration',
      why: `file=${file}/10 未達`,
    }
  }
  return {
    hand: '有料1社の決裁カード（BILLING）を Owner へ提出',
    axis: 'integration',
    why: 'fileゲート通過',
  }
}

async function main() {
  fs.mkdirSync(STATE, { recursive: true })
  const board = dry
    ? JSON.parse(fs.readFileSync(path.join(STATE, 'p0_scoreboard.json'), 'utf8'))
    : runScoreboard()

  let funnel = null
  const apiKey = process.env.PLAUSIBLE_API_KEY
  if (apiKey) {
    try {
      funnel = await liveFunnel(apiKey)
      if (!dry) {
        const snap = {
          queriedAt: new Date().toISOString().slice(0, 10),
          site: 'sharoushi-agent.com',
          plausibleNote: 'ceo_weekly_pdca live aggregate',
          data: Object.fromEntries(
            Object.entries(funnel).map(([k, v]) => [
              k,
              {
                results: {
                  events: { value: v.events ?? 0 },
                  visitors: { value: v.visitors ?? 0 },
                },
              },
            ]),
          ),
        }
        fs.writeFileSync(SNAP, JSON.stringify(snap, null, 2) + '\n')
      }
    } catch (e) {
      funnel = { error: String(e.message || e) }
    }
  } else if (fs.existsSync(SNAP)) {
    const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8'))
    funnel = {}
    for (const [k, v] of Object.entries(snap.data || {})) {
      funnel[k] = {
        events: v?.results?.events?.value ?? null,
        visitors: v?.results?.visitors?.value ?? null,
      }
    }
  }

  const axes = scoreAxes(board, funnel && !funnel.error ? funnel : {})
  const hand = nextHand(axes, funnel && !funnel.error ? funnel : {}, board)
  const report = {
    generatedAt: new Date().toISOString(),
    brand: '就業規則AI',
    axes,
    northStar: board.northStar,
    funnel,
    nextHand: hand,
    ownerReport: [
      `【就業規則AI CEO週次 ${new Date().toISOString().slice(0, 10)}】`,
      `数字: file=${axes.fileProgress} · signupPass=${axes.signupPass ?? 'n/a'} · sheet/land=${axes.sheetPerLanding ?? 'n/a'} · 軸 統合${axes.integration}/凌駕${axes.competitiveEdge}/LP${axes.lpTopTier}`,
      `1手: ${hand.hand}`,
      `決裁: ${board.northStar?.zureShown >= 10 ? 'BILLINGカード検討' : 'なし'}`,
    ].join('\n'),
  }

  console.log(JSON.stringify(report, null, 2))
  if (!dry) {
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n')
    fs.appendFileSync(LOG, JSON.stringify(report) + '\n')
    console.error(`Wrote ${path.relative(ROOT, OUT)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

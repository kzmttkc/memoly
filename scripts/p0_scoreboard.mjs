#!/usr/bin/env node
/**
 * p0_scoreboard.mjs — 就業規則AI P0 北の星スコアボード
 *
 * Usage:
 *   node scripts/p0_scoreboard.mjs
 *   node scripts/p0_scoreboard.mjs --dry-run
 *
 * Env (optional):
 *   PLAUSIBLE_API_KEY  — Plausible Stats API
 *   PLAUSIBLE_SITE_ID  — e.g. banto-roumu.com
 *
 * Writes: docs/ceo/state/p0_scoreboard.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OFFER_PATH = path.join(ROOT, 'lib/offer.ts')
const OUT_DIR = path.join(ROOT, 'docs/ceo/state')
const OUT_PATH = path.join(OUT_DIR, 'p0_scoreboard.json')
const P0_START = '2026-08-28'

function parseOffer(src) {
  const fileTarget = Number((src.match(/fileTarget:\s*(\d+)/) || [])[1])
  const kabauFileTarget = Number((src.match(/kabauFileTarget:\s*(\d+)/) || [])[1])
  const killDate = (src.match(/killDate:\s*'([^']+)'/) || [])[1]
  if (!fileTarget || !killDate) {
    throw new Error('Failed to parse fileTarget/killDate from lib/offer.ts')
  }
  return { fileTarget, kabauFileTarget: kabauFileTarget || 0, killDate }
}

function daysUntil(isoDate) {
  const end = Date.parse(`${isoDate}T23:59:59+09:00`)
  return Math.ceil((end - Date.now()) / 86_400_000)
}

function daySpan(startIso, endIso) {
  const a = Date.parse(`${startIso}T00:00:00+09:00`)
  const b = Date.parse(`${endIso}T23:59:59+09:00`)
  return Math.max(1, Math.ceil((b - a) / 86_400_000))
}

async function fetchPlausibleZureCount(apiKey, siteId) {
  const end = new Date().toISOString().slice(0, 10)
  const endpoint = `https://plausible.io/api/v1/stats/aggregate?site_id=${encodeURIComponent(siteId)}&period=custom&date=${P0_START},${end}&metrics=events&filters=${encodeURIComponent('event:name==zure_sheet_shown')}`
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Plausible HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  const n = json?.results?.events?.value
  return typeof n === 'number' ? n : null
}

async function main() {
  const dry = process.argv.includes('--dry-run')
  const offerSrc = fs.readFileSync(OFFER_PATH, 'utf8')
  const offer = parseOffer(offerSrc)
  const daysLeft = daysUntil(offer.killDate)
  const totalWindow = daySpan(P0_START, offer.killDate)
  const elapsed = Math.max(1, totalWindow - Math.max(0, daysLeft) + 1)

  let zureShown = null
  let zureSource = 'MANUAL_REQUIRED'
  const apiKey = process.env.PLAUSIBLE_API_KEY
  const siteId = process.env.PLAUSIBLE_SITE_ID || 'banto-roumu.com'
  if (apiKey) {
    try {
      zureShown = await fetchPlausibleZureCount(apiKey, siteId)
      zureSource = 'plausible_v1_aggregate'
    } catch (e) {
      zureSource = `PLAUSIBLE_ERROR: ${e.message}`
    }
  }

  const expectedByToday =
    zureShown == null ? null : Number(((offer.fileTarget * elapsed) / totalWindow).toFixed(2))
  const onTrack =
    zureShown == null || expectedByToday == null ? null : zureShown >= expectedByToday

  const report = {
    generatedAt: new Date().toISOString(),
    brand: '就業規則AI',
    northStar: {
      metric: 'zure_sheet_shown',
      fileTarget: offer.fileTarget,
      kabauFileTarget: offer.kabauFileTarget,
      killDate: offer.killDate,
      daysLeft,
      elapsedDays: elapsed,
      totalWindowDays: totalWindow,
      zureShown,
      zureSource,
      expectedByToday,
      onTrack,
      progress:
        zureShown == null ? null : Number((zureShown / offer.fileTarget).toFixed(3)),
    },
    commercial: {
      paidCompanies: null,
      note: 'Stripe/Supabaseで手計測。subscription_started を突合',
    },
    nextActions: [
      zureShown == null
        ? 'Plausibleで zure_sheet_shown を手計測するか PLAUSIBLE_API_KEY を設定'
        : zureShown < offer.fileTarget
          ? '記事・ツール→/zure 閉ループの1箇所を修理（流入を足さない）'
          : '有料1社の決裁カード（BILLING）へ進む',
    ],
  }

  console.log(JSON.stringify(report, null, 2))

  if (!dry) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + '\n')
    console.error(`Wrote ${path.relative(ROOT, OUT_PATH)}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

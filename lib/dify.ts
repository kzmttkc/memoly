import { readFileSync } from 'node:fs'

// ============================================================================
// dify.ts — Difyボット（社労士13本）への薄いラッパ + トピック→ボットルーティング
//
//   目的:
//     縦SaaS「会社を覚える労務AI」のチャットで、固い法令数値（36協定の上限時間、
//     社会保険の料率、育休給付の率など）が必要なときだけ、該当領域のDifyボットに
//     一次照会する。毎回呼ばない（コスト/レイテンシ）。キーワード一致時のみ起動。
//
//   設計の流儀:
//     - 鍵はハードコードしない。本番は env(DIFY_KEYS_JSON)、ローカルは
//       config/x_keys.json の DIFY_KEY_* から読む（§0.5原則6）。
//     - エンドポイントは api.dify.ai/v1/chat-messages（blocking）。
//     - 失敗は握りつぶさず null を返す（呼び出し側で「Dify無しで続行」できる）。
//
//   鍵のロード優先順位（env優先・ファイルはローカル開発フォールバック）:
//     (1) 環境変数 DIFY_KEYS_JSON（DIFY_KEY_* を含むJSON文字列）があればそれをparse。
//         本番 Vercel ではローカルの x_keys.json が存在しないため、この経路が正。
//         env投入は CEO が別途 CLI で行う（このコードは env対応のみ・鍵値は書かない）。
//     (2) 無ければ既存ファイルパス（DIFY_KEYS_PATH で上書き可）から読む。
//     いずれも parse 失敗時は {} で安全劣化（鍵が無ければ askDify が null を返す＝
//     Dify無しで続行・既存挙動を維持）。
// ============================================================================

const DIFY_ENDPOINT = 'https://api.dify.ai/v1/chat-messages'

// x_keys.json の絶対パス（Takeshi_Automation 配下）。env で上書き可。
// 本番(Vercel)ではこのファイルは存在しない＝(2)は失敗し、(1)の DIFY_KEYS_JSON が正となる。
const KEYS_PATH =
  process.env.DIFY_KEYS_PATH ??
  '/Users/takeshi/Takeshi_Automation/config/x_keys.json'

// 鍵キャッシュ（プロセス内で1回だけ読む）
let keysCache: Record<string, string> | null = null

function loadKeys(): Record<string, string> {
  if (keysCache) return keysCache

  // (1) env優先: DIFY_KEYS_JSON があればそれを使う（本番Vercelの正経路）。
  const envJson = process.env.DIFY_KEYS_JSON
  if (envJson && envJson.trim()) {
    try {
      const parsed = JSON.parse(envJson) as Record<string, unknown>
      // 文字列値のみ採用（非文字列は除外）。空オブジェクトでもファイルにフォールバックしない
      // ＝env明示時はenvを正とする。
      keysCache = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === 'string') as [string, string][],
      )
      return keysCache
    } catch (e) {
      // parse失敗は安全劣化。env指定があったのに壊れている事実だけ残し、ファイルへフォールバック。
      console.error('[dify] DIFY_KEYS_JSON のparseに失敗（ファイルへフォールバック）', {
        err: (e as Error).message,
      })
    }
  }

  // (2) フォールバック: ローカル開発用の x_keys.json（本番では通常存在しない）。
  try {
    const raw = readFileSync(KEYS_PATH, 'utf8')
    keysCache = JSON.parse(raw) as Record<string, string>
  } catch (e) {
    console.error('[dify] 鍵の読込に失敗（DIFY_KEYS_JSON 未設定かつファイル無し）', {
      path: KEYS_PATH,
      err: (e as Error).message,
    })
    keysCache = {}
  }
  return keysCache
}

// ----------------------------------------------------------------------------
// ボット定義: 内部トピックID → (x_keys.json の鍵名, 判定キーワード)
//   キーワードが質問本文に含まれたら、その領域のボットへ照会する。
//   先頭にマッチしたものを1本だけ使う（複数照会はしない＝レイテンシ/コスト抑制）。
// ----------------------------------------------------------------------------
export interface DifyBot {
  topic: string
  keyName: string
  keywords: string[]
}

// factルートは 36協定 / 育児介護 の2本に限定（CEO裁定 2026-06-27）。
//   理由: 番頭の差別化の本丸は「最新法令ファクト精度＋citation＋信頼担保」。Difyナレッジ
//   自体はコモディティRAGで先行優位が無い。固い法令数値は lib/legal-facts.ts の出典付き
//   構造データへ移し、Dify依存を縮小する。
//   残す2本は「固い数値かつ sonnet では精度不足（改正に弱い）」で補う価値が高い領域に限る:
//     - 36協定(36KYOTEI): 上限時間の固い数値＋特別条項。誤りが致命的。
//     - 育児介護(IKUJI_KAIGO): 給付率・期間が改正で動き、sonnetの記憶では不正確になりやすい。
//   factルートから外したボット（理由）:
//     - SHARO_SOUDAN(汎用相談=sonnet+会社記憶と重複・SPOF)
//     - SHARO_PORTAL(旧UI)
//     - HARASSMENT(固い数値でない)
//     - HR_SAIYO(中核外)
//     - NYUTAISHA(手順情報=sonnetで十分)
//     - KYUYO_CHECK(割増率/最賃 → legal-facts.ts の確定値＋「要確認」で代替)
//     - SHAKAIHOKEN_SIM(料率 → legal-facts.ts の厚生年金18.3%＋「要確認」で代替)
//   ※外したボットの env / 鍵 / DOCUMENT_BOTS は消さない。ルーティング配列から除くだけ。
export const DIFY_BOTS: DifyBot[] = [
  { topic: '36協定・残業', keyName: 'DIFY_KEY_36KYOTEI',
    keywords: ['36協定', '三六協定', '時間外', '残業', '上限規制', '特別条項'] },
  { topic: '育児・介護', keyName: 'DIFY_KEY_IKUJI_KAIGO',
    keywords: ['育休', '育児休業', '産休', '介護休業', '育児給付', '出生時育児'] },
]

/**
 * 質問本文から、照会すべきDifyボットを1本だけ選ぶ（無ければ null）。
 * DIFY_BOTS の定義順で先頭マッチを採用する（より具体的な36協定等を上に置いている）。
 */
export function routeToBot(query: string): DifyBot | null {
  for (const bot of DIFY_BOTS) {
    if (bot.keywords.some(kw => query.includes(kw))) return bot
  }
  return null
}

export interface DifyAnswer {
  topic: string
  answer: string
}

// ----------------------------------------------------------------------------
// 書類生成ボットのマッピング（提案A=書類ドラフト生成）。
//   documentType（画面の選択値）→ 生成系Difyボットの鍵名・トピック名。
//   ここに無い種別、または鍵が無い場合は呼び出し側で sonnet フォールバックする。
// ----------------------------------------------------------------------------
export interface DocumentBot {
  topic: string
  keyName: string
}

export const DOCUMENT_BOTS: Record<string, DocumentBot> = {
  '36協定': { topic: '36協定届', keyName: 'DIFY_KEY_36KYOTEI' },
  '就業規則': { topic: '就業規則', keyName: 'DIFY_KEY_SHUGYO_KISOKU' },
  '賃金規程': { topic: '賃金規程', keyName: 'DIFY_KEY_CHINGIN_KITEI' },
  '労働条件通知書': { topic: '労働条件通知書', keyName: 'DIFY_KEY_RODO_JOTOKEN' },
}

/** documentType に対応する生成ボット定義を返す（未対応なら null）。 */
export function routeToDocumentBot(documentType: string): DocumentBot | null {
  return DOCUMENT_BOTS[documentType] ?? null
}

/**
 * documentType に対応する生成ボットへ query を投げ、ドラフト本文を返す。
 * 対応ボットが無い／鍵が無い／呼び出し失敗 → null（呼び出し側で sonnet フォールバック）。
 */
export async function generateDocumentViaDify(
  documentType: string,
  query: string,
  user = 'memoly-company',
): Promise<DifyAnswer | null> {
  const bot = routeToDocumentBot(documentType)
  if (!bot) return null
  const answer = await askDify(bot.keyName, query, user)
  if (!answer) return null
  return { topic: bot.topic, answer }
}

/**
 * 指定した鍵名のDifyボットに query を投げ、回答テキストを返す。
 * blocking モード。失敗時は null（呼び出し側はDify無しで続行する）。
 *
 * @param keyName x_keys.json のキー名（例 'DIFY_KEY_36KYOTEI'）
 * @param query   ボットへの質問
 * @param user    Dify の user 識別子（会話分離用・会社IDなどを渡す）
 */
export async function askDify(
  keyName: string,
  query: string,
  user = 'memoly-company',
  timeoutMs = 20_000,
): Promise<string | null> {
  const keys = loadKeys()
  const apiKey = keys[keyName]
  if (!apiKey) {
    console.error('[dify] 鍵が見つからない', { keyName })
    return null
  }

  try {
    const res = await fetch(DIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        inputs: {},
        response_mode: 'blocking',
        conversation_id: '',
        user,
      }),
      // ネットワーク不調でチャット全体を止めないよう短めのタイムアウト。
      // 助成金(HOJOKIN)など遅い経路は呼び出し側で短縮し、早めに sonnet フォールバックさせる。
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[dify] HTTP error', { keyName, status: res.status, body: body.slice(0, 300) })
      return null
    }

    const data = (await res.json()) as { answer?: string }
    const answer = typeof data.answer === 'string' ? data.answer.trim() : ''
    return answer || null
  } catch (e) {
    console.error('[dify] 呼び出し失敗', { keyName, err: (e as Error).message })
    return null
  }
}

/**
 * query に法令キーワードがあれば該当ボットへ照会し、{topic, answer} を返す。
 * 無ければ null（=Dify照会不要）。チャットAPIから1行で呼べる便利関数。
 */
export async function maybeAskDifyForQuery(
  query: string,
  user = 'memoly-company',
): Promise<DifyAnswer | null> {
  const bot = routeToBot(query)
  if (!bot) return null
  const answer = await askDify(bot.keyName, query, user)
  if (!answer) return null
  return { topic: bot.topic, answer }
}

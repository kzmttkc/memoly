// ============================================================================
// embedding.ts — 記憶のセマンティック検索（pgvector）用の埋め込みプロバイダ層
//
//   目的（PMFロードマップ P1-1・Kabauの最大差別化＝記憶の縦深/moat）:
//     company.ts の relevanceScore はキーワード＋2-gram 部分一致で、同義語・言い換えに弱い
//     （「育休」と「育児休業」「産休明けの休み」を結べない）。会話クエリと過去記憶を
//     埋め込みベクトルにしてコサイン類似度で想起することで「言い方が違っても意味で思い出す」
//     を実現する。ここはその「意味ベクトル化」だけを担う薄い層。
//
//   プロバイダ:
//     OpenAI text-embedding-3-small（1536次元・低コスト）を既定にする。
//     SDK は足さず fetch で叩く（依存を増やさない・Vercel 関数サイズを太らせない）。
//     将来 Voyage 等へ差し替える場合もこのファイルの中だけで完結させる。
//
//   ★graceful degrade（最重要・既存動作を絶対に壊さない）:
//     - OPENAI_API_KEY 未設定なら embeddingEnabled()=false。呼び出し側は
//       従来のキーワード検索へ自動フォールバックする（本ファイルは null を返すだけ）。
//     - API 失敗・タイムアウト・異常レスポンスでも throw せず null を返す。
//       ＝「意味検索が使えないときは黙ってキーワード検索に戻る」を保証する。
// ============================================================================

// text-embedding-3-small の次元数。supabase/company_memory_semantic.sql の
// vector(1536) と厳密に一致させること（不一致は挿入・検索で必ず失敗する）。
export const EMBEDDING_DIM = 1536

// 埋め込みモデル。低コスト・高品質の既定。変えるときは EMBEDDING_DIM と
// マイグレーションの vector 次元も必ず揃える。
const EMBEDDING_MODEL = 'text-embedding-3-small'

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'

// 1テキストあたりの入力上限（安全側の文字数キャップ）。text-embedding-3-small の
// トークン上限（8191）に対し十分内側。記憶要約は通常1000字以内なので実運用では効かない。
const MAX_INPUT_CHARS = 8000

// API 呼び出しのタイムアウト（ミリ秒）。想起は対話の律速なので長く待たない
// （超えたら null＝キーワード検索へフォールバック）。
const EMBED_TIMEOUT_MS = 8000

/** 埋め込みが利用可能か（＝APIキーが設定されているか）。false のとき呼び出し側は
 *  一切ネットワークを叩かず従来のキーワード検索へ倒す。 */
export function embeddingEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

/** number[] を pgvector のテキストリテラル `[a,b,c]` に変換する。
 *  supabase-js の insert / RPC 引数へはこのテキスト形で渡し、SQL 側で ::vector にキャストする
 *  （JS 配列を直接渡すと JSON 化されて vector へキャストできないため）。 */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

interface OpenAIEmbeddingResponse {
  data?: { embedding?: number[] }[]
  error?: { message?: string }
}

/**
 * 複数テキストをまとめて埋め込む（OpenAI は input 配列でバッチ可能＝往復を節約）。
 * 返り値は入力と同じ並びの (number[] | null)[]。キー未設定・失敗時は全要素 null。
 * ★ throw しない（呼び出し側の既存フローを止めない）。
 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return texts.map(() => null)

  // 空文字は埋め込まない（API エラー回避）。位置は保つため後で null を埋め戻す。
  const cleaned = texts.map(t => (typeof t === 'string' ? t.trim().slice(0, MAX_INPUT_CHARS) : ''))
  const nonEmptyIdx: number[] = []
  const inputs: string[] = []
  cleaned.forEach((t, i) => {
    if (t) {
      nonEmptyIdx.push(i)
      inputs.push(t)
    }
  })
  if (inputs.length === 0) return texts.map(() => null)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS)
  try {
    const res = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as OpenAIEmbeddingResponse
      console.error('[embedding:embedTexts] API non-OK; falling back to keyword', {
        status: res.status,
        message: body?.error?.message,
      })
      return texts.map(() => null)
    }
    const json = (await res.json()) as OpenAIEmbeddingResponse
    const out: (number[] | null)[] = texts.map(() => null)
    const rows = json.data ?? []
    // OpenAI は入力順を保って返す。位置対応で埋め戻す。
    nonEmptyIdx.forEach((origIdx, k) => {
      const emb = rows[k]?.embedding
      if (Array.isArray(emb) && emb.length === EMBEDDING_DIM) {
        out[origIdx] = emb
      } else if (emb) {
        console.error('[embedding:embedTexts] unexpected dim', { got: emb.length, want: EMBEDDING_DIM })
      }
    })
    return out
  } catch (e) {
    // タイムアウト（AbortError）・ネットワーク断など。黙ってキーワード検索へ倒す。
    console.error('[embedding:embedTexts] threw; falling back to keyword', (e as Error).message)
    return texts.map(() => null)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 単一テキストを埋め込む。キー未設定・失敗・空文字では null（＝キーワード検索へ倒す）。
 * ★ throw しない。
 */
export async function embedText(text: string): Promise<number[] | null> {
  const [vec] = await embedTexts([text])
  return vec ?? null
}

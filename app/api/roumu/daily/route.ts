import { NextResponse } from 'next/server'
import { USECASE_LIST } from '@/lib/usecase'

// ============================================================================
// /api/roumu/daily — 「今日の1分労務」カード（D23）のデータソース。
//   既存の /roumu 記事群（lib/usecase.ts の SSOT）から、JST の日付で決定的に
//   1本を選んで軽量メタ（slug/タイトル/リード/カテゴリ）だけを返す。
//     - 新規コンテンツは書かない（既存記事の抜粋+リンクのみ）。
//     - LLM/DB 呼び出しなし・認証不要（公開記事の公開メタのみ＝PIIなし）。
//     - 記事全文をクライアントバンドルに載せないための分離（home はこのAPIを叩く）。
//   同じ日は誰が見ても同じ記事（日替わり・チラつきなし）。
// ============================================================================

export const dynamic = 'force-dynamic'

export async function GET() {
  const list = USECASE_LIST
  if (list.length === 0) {
    return NextResponse.json({ article: null })
  }
  // JST の経過日数で決定的にローテーション。
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const dayIndex = Math.floor(jstNow.getTime() / (24 * 60 * 60 * 1000))
  const pick = list[dayIndex % list.length]

  return NextResponse.json(
    {
      article: {
        slug: pick.slug,
        title: pick.h1,
        lead: pick.lead,
        category: pick.ogCategory,
      },
    },
    // 公開メタのみ＝CDNで1時間キャッシュ可（日替わり粒度に対して十分細かい）。
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' } },
  )
}

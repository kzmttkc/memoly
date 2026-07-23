'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'

// ============================================================================
// DailyRoumuCard — 「今日の1分労務」カード（外部評価 D23）。
//   既存の /roumu 記事群から日替わりで1本を抜粋してホームに出す
//   （/api/roumu/daily・新規コンテンツは書かない＝既存記事へのリンクのみ）。
//   取得失敗時は何も出さない（ベストエフォート）。記事は新しいタブで開き、
//   アプリの文脈（companyId 付きの画面）を失わせない。
// ============================================================================

interface DailyArticle {
  slug: string
  title: string
  lead: string
  category: string
}

export function DailyRoumuCard() {
  const [article, setArticle] = useState<DailyArticle | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/roumu/daily')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => {
        if (alive && data.article) setArticle(data.article as DailyArticle)
      })
      .catch(() => {
        /* 出せなければ出さない */
      })
    return () => {
      alive = false
    }
  }, [])

  if (!article) return null

  return (
    <section aria-label="今日の1分労務">
      <div className="mb-1 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-brand-600" aria-hidden />
        <h2 className="text-sm font-semibold text-neutral-900">今日の1分労務</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
          {article.category}
        </span>
      </div>
      <a href={`/roumu/${article.slug}`} target="_blank" rel="noopener" className="block">
        <Card interactive className="py-4">
          <p className="text-sm font-medium text-neutral-900">{article.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">
            {article.lead}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600">
            読む（1分）
            <ArrowRight className="h-3 w-3" aria-hidden />
          </p>
        </Card>
      </a>
    </section>
  )
}

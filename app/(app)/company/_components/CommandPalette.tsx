'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Home,
  MessageSquareText,
  BookOpenCheck,
  FileText,
  ShieldCheck,
  Sparkles,
  History,
  CalendarClock,
  FileBarChart,
  CreditCard,
  Building2,
  Sun,
  Moon,
  Search,
  CornerDownLeft,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'

// ============================================================================
// CommandPalette — Stripe 品質の Cmd/Ctrl+K コマンドパレット（自前実装・依存追加なし）。
// ----------------------------------------------------------------------------
//   /company 配下全体で起動。あいまい検索（部分列マッチ＋近接スコア）／矢印キー移動／
//   Enter 実行／Esc 閉じ。加えて g シーケンス（g c=相談 / g m=記憶 / g r=規程 /
//   g d=書類 …）を提供し、UI 上に kbd で視覚提示する。
//   input/textarea/select/contenteditable にフォーカス中はショートカットを無効化する。
//   会社切替は所属会社を読み、複数社なら各社を切替先として列挙する。
//   companyId は URL クエリから引き継ぐ（AppShell と同じ流儀）。
// ============================================================================

interface Membership {
  companyId: string
  role: 'admin' | 'member'
  name: string
}

interface Command {
  id: string
  label: string
  group: string
  /** g シーケンスのヒント（例: 'g c'）。あれば行に kbd 表示。 */
  hint?: string
  /** 検索補助語（ローマ字/英語など。ラベル外の当たりを増やす）。 */
  keywords?: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  perform: () => void
}

// フォーカスが編集要素にあるか（ショートカット抑止用）。
function inEditable(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  )
}

// 部分列マッチ + 近接スコア（小さいほど良い）。当たらなければ null。
function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let ti = 0
  let score = 0
  let lastHit = -1
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    for (let j = ti; j < t.length; j++) {
      if (t[j] === ch) {
        found = j
        break
      }
    }
    if (found === -1) return null
    // 連続一致は加点（＝離れているほど減点）。先頭一致も加点。
    if (lastHit !== -1) score += found - lastHit
    else score += found
    lastHit = found
    ti = found + 1
  }
  return score
}

export function CommandPalette() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const companyId = searchParams.get('companyId') ?? ''
  const { resolved, toggle } = useTheme()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [companies, setCompanies] = useState<Membership[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // g シーケンスの保留状態。
  const pendingG = useRef(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const withCompany = useCallback(
    (href: string) => (companyId ? `${href}?companyId=${companyId}` : href),
    [companyId],
  )

  const go = useCallback(
    (href: string) => {
      router.push(withCompany(href))
      setOpen(false)
    },
    [router, withCompany],
  )

  // 開いたときに所属会社を取得（複数社なら切替先として出す）。
  useEffect(() => {
    if (!open) return
    let alive = true
    fetch('/api/company')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: { companies?: Membership[] }) => {
        if (alive) setCompanies(d.companies ?? [])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: 'home', label: 'ホームを開く', group: 'ナビゲーション', hint: 'g h', keywords: 'home dashboard トップ', icon: Home, perform: () => go('/company/home') },
      { id: 'chat', label: '相談を始める', group: 'ナビゲーション', hint: 'g c', keywords: 'soudan chat AI 相談', icon: MessageSquareText, perform: () => go('/company/chat') },
      { id: 'memory', label: '記憶を見る', group: 'ナビゲーション', hint: 'g m', keywords: 'kioku memory 会社の記憶', icon: History, perform: () => go('/company/memory') },
      { id: 'rules', label: '規程を見る', group: 'ナビゲーション', hint: 'g r', keywords: 'kitei rules 自社ルール', icon: BookOpenCheck, perform: () => go('/company/rules') },
      { id: 'documents', label: '書類を作る', group: 'ナビゲーション', hint: 'g d', keywords: 'shorui documents 書類作成 レビュー', icon: FileText, perform: () => go('/company/documents') },
      { id: 'risk', label: 'リスク診断', group: 'ナビゲーション', keywords: 'risk 労務リスク 診断', icon: ShieldCheck, perform: () => go('/company/risk') },
      { id: 'deadlines', label: '期限カレンダー', group: 'ナビゲーション', hint: 'g e', keywords: 'kigen deadlines 期限', icon: CalendarClock, perform: () => go('/company/deadlines') },
      { id: 'insights', label: '助成金・法改正', group: 'ナビゲーション', keywords: 'joseikin insights 助成金 法改正', icon: Sparkles, perform: () => go('/company/insights') },
      { id: 'reports', label: '社労士に渡すメモ', group: 'ナビゲーション', keywords: 'matome reports 報告 社労士 まとめ メモ', icon: FileBarChart, perform: () => go('/company/reports') },
      // ラベルは AppShell ナビと同じ「プラン」（席課金は士業のみ。keywords で「席」検索は維持）。
      { id: 'billing', label: 'プラン', group: 'ナビゲーション', keywords: 'billing plan seats 課金 席', icon: CreditCard, perform: () => go('/company/billing') },
    ]

    const view: Command[] = [
      {
        id: 'theme',
        label: resolved === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え',
        group: '表示',
        keywords: 'theme dark light テーマ 表示 切替',
        icon: resolved === 'dark' ? Sun : Moon,
        perform: () => {
          toggle()
          setOpen(false)
        },
      },
    ]

    // 会社切替（複数社のみ）。1社/0社なら「会社一覧」1本に。
    const companyCmds: Command[] =
      companies.length > 1
        ? companies
            .filter(c => c.companyId !== companyId)
            .map(c => ({
              id: `switch-${c.companyId}`,
              label: `会社を切り替える：${c.name}`,
              group: '会社',
              keywords: `switch company ${c.name} 顧問先 切替`,
              icon: Building2,
              perform: () => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('companyId', c.companyId)
                router.push(`${window.location.pathname}?${params.toString()}`)
                setOpen(false)
              },
            }))
        : [
            {
              id: 'company-list',
              label: '会社を切り替える（会社一覧へ）',
              group: '会社',
              keywords: 'switch company 会社切替 一覧',
              icon: Building2,
              perform: () => go('/company'),
            },
          ]

    return [...nav, ...companyCmds, ...view]
  }, [go, resolved, toggle, companies, companyId, router, searchParams])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const scored = commands
      .map(c => {
        const s = fuzzyScore(query, `${c.label} ${c.keywords ?? ''}`)
        return s === null ? null : { c, s }
      })
      .filter((x): x is { c: Command; s: number } => x !== null)
      .sort((a, b) => a.s - b.s)
    return scored.map(x => x.c)
  }, [commands, query])

  // 検索が変わったら選択を先頭へ戻す。
  useEffect(() => {
    setActive(0)
  }, [query, open])

  // グローバル: Cmd/Ctrl+K でトグル、g シーケンスで直行。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl+K はどこでも（編集中でも）パレットを開閉。
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(o => !o)
        return
      }
      if (open) return
      if (inEditable()) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (pendingG.current) {
        const cmd = commands.find(c => c.hint === `g ${e.key.toLowerCase()}`)
        pendingG.current = false
        if (gTimer.current) clearTimeout(gTimer.current)
        if (cmd) {
          e.preventDefault()
          cmd.perform()
        }
        return
      }
      if (e.key === 'g') {
        pendingG.current = true
        if (gTimer.current) clearTimeout(gTimer.current)
        gTimer.current = setTimeout(() => {
          pendingG.current = false
        }, 1200)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, commands])

  // ヘッダの検索ボタン等からクリックで開けるよう、カスタムイベントも受ける。
  useEffect(() => {
    const openIt = () => setOpen(true)
    window.addEventListener('banto-open-command-palette', openIt)
    return () => window.removeEventListener('banto-open-command-palette', openIt)
  }, [])

  // 開いたら入力にフォーカス、閉じたらクエリを消す。
  useEffect(() => {
    if (open) {
      setQuery('')
      // 次フレームでフォーカス（マウント直後の描画待ち）。
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // アクティブ行をビューに追従。
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open, filtered])

  const onListKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive(a => Math.min(a + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive(a => Math.max(a - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        filtered[active]?.perform()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    },
    [filtered, active],
  )

  if (!open) return null

  // グループ順を保ったまま描画（filtered は元順を維持）。
  let idx = -1
  const groups: { name: string; items: { c: Command; i: number }[] }[] = []
  for (const c of filtered) {
    idx++
    const last = groups[groups.length - 1]
    if (last && last.name === c.group) last.items.push({ c, i: idx })
    else groups.push({ name: c.group, items: [{ c, i: idx }] })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="コマンドパレット"
    >
      {/* 背景スクリム */}
      <button
        type="button"
        aria-label="コマンドパレットを閉じる"
        onClick={() => setOpen(false)}
        className="banto-overlay-in absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
      />
      <div className="banto-pop-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        {/* 検索行 */}
        <div className="flex items-center gap-2.5 border-b border-neutral-200 px-4">
          <Search className="h-4.5 w-4.5 shrink-0 text-neutral-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onListKey}
            placeholder="操作を検索…（相談・記憶・書類・切替）"
            aria-label="コマンドを検索"
            className="h-12 w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          <span className="banto-kbd shrink-0">esc</span>
        </div>

        {/* 一覧 */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">
              一致する操作がありません
            </p>
          ) : (
            groups.map(g => (
              <div key={g.name} className="mb-1">
                <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  {g.name}
                </p>
                {g.items.map(({ c, i }) => {
                  const Icon = c.icon
                  const isActive = i === active
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-idx={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => c.perform()}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-neutral-700 hover:bg-neutral-50',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4.5 w-4.5 shrink-0',
                          isActive ? 'text-brand-600' : 'text-neutral-400',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      {c.hint && (
                        <span className="flex shrink-0 items-center gap-1">
                          {c.hint.split(' ').map((k, ki) => (
                            <span key={ki} className="banto-kbd">
                              {k}
                            </span>
                          ))}
                        </span>
                      )}
                      {isActive && !c.hint && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

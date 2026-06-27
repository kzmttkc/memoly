'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import {
  Home,
  MessageSquareText,
  BookOpenCheck,
  FileText,
  ShieldCheck,
  Sparkles,
  History,
  CreditCard,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import { CompanySwitcher } from './CompanySwitcher'

// ============================================================================
// AppShell — 番頭(Banto) 会社版の共通アプリシェル。
//   上部ヘッダ: Banto ワードマーク + CompanySwitcher 常設 + アカウント(ログアウト)
//   左サイドナビ(>=lg): 相談 / 自社ルール / 書類 / リスク診断 / 助成金・法改正 を
//     lucide アイコン + テキスト併記。現在地をアクティブ表示(brand)。
//   モバイル(<lg): 下部タブバー + ヘッダのドロワーは使わずタブで主要5導線。
//   各ページは <AppShell><PageHeader/>...</AppShell> で中身だけを書く
//   （手書きヘッダの重複を解消）。companyId は URL クエリから引き継ぐ。
// ============================================================================

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

// rules は admin 限定だが、シェルは可視性を一律にし、API 側 403 を rules ページが扱う。
// home は会社選択後のトップ（能動フィード）。先頭に置き「戻る理由」への最短導線にする。
// memory（会社の記憶）は番頭の差別化の核。サイドナビ/ドロワーには出すが、
// モバイル下部タブは主要5+ホームの6枠を維持し（7枠は窮屈）、memory は下部タブからは外す。
const NAV: NavItem[] = [
  { href: '/company/home', label: 'ホーム', icon: Home },
  { href: '/company/chat', label: '相談', icon: MessageSquareText },
  { href: '/company/memory', label: '会社の記憶', icon: History },
  { href: '/company/rules', label: '自社ルール', icon: BookOpenCheck },
  { href: '/company/documents', label: '書類', icon: FileText },
  { href: '/company/risk', label: 'リスク診断', icon: ShieldCheck },
  { href: '/company/insights', label: '助成金・法改正', icon: Sparkles },
  // 課金/席管理(admin向け)。サイドナビ/ドロワーには出すが、下部タブには出さない。
  { href: '/company/billing', label: 'プラン・席', icon: CreditCard },
]

// モバイル下部タブは主要6導線に絞る（memory/billing はドロワー/サイドナビから到達）。
const MOBILE_TAB_NAV: NavItem[] = NAV.filter(
  n => n.href !== '/company/memory' && n.href !== '/company/billing',
)

function Wordmark() {
  return (
    <Link
      href="/company"
      className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      aria-label="番頭ホーム"
    >
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
        番
      </span>
      <span className="text-base font-bold tracking-tight text-neutral-900">番頭</span>
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const companyId = searchParams.get('companyId') ?? ''
  const [drawerOpen, setDrawerOpen] = useState(false)

  // companyId を保ったままナビ遷移する。
  const withCompany = (href: string) =>
    companyId ? `${href}?companyId=${companyId}` : href

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-50 text-neutral-900">
      {/* ===== 上部ヘッダ ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          {/* モバイル: ドロワートグル */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
            aria-label="メニューを開く"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <Wordmark />

          <div className="ml-2 hidden min-w-0 flex-1 sm:block">
            <CompanySwitcher companyId={companyId} variant="header" />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="ログアウト"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
        {/* sm 未満では会社スイッチャーを2段目に */}
        <div className="border-t border-neutral-100 px-4 py-2 sm:hidden">
          <CompanySwitcher companyId={companyId} variant="header" />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        {/* ===== 左サイドナビ(>=lg) ===== */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 border-r border-neutral-200 px-3 py-5 lg:block">
          <nav className="space-y-1" aria-label="会社版ナビゲーション">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={withCompany(href)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  )}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                  {label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* ===== メイン ===== */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* ===== モバイル下部タブ(<lg) ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur lg:hidden"
        aria-label="会社版ナビゲーション（モバイル）"
      >
        <div className="mx-auto grid max-w-md grid-cols-6">
          {MOBILE_TAB_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={withCompany(href)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                  active ? 'text-brand-700' : 'text-neutral-500',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ===== モバイルドロワー(ヘッダのMenuから) ===== */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/30"
            aria-label="メニューを閉じる"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Wordmark />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="space-y-1" aria-label="会社版ナビゲーション（ドロワー）">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={withCompany(href)}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                      active
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-neutral-700 hover:bg-neutral-100',
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}

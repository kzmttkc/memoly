'use client'

import { useEffect, useState } from 'react'
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
  CalendarClock,
  FileBarChart,
  CreditCard,
  LogOut,
  Menu,
  X,
  Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import { CompanySwitcher } from './CompanySwitcher'
import { CommandPalette } from './CommandPalette'

// ============================================================================
// AppShell — 番頭(Banto) 会社版の共通アプリシェル。
//   上部ヘッダ: Banto ワードマーク + CompanySwitcher 常設（モバイルも同一行=1段・D21）
//   左サイドナビ(>=lg): D01 情報設計を「相談する / 気づく / つくる / 覚える」の
//     4柱グループで再編（URLは全て既存のまま・表示だけ再構成）。
//   モバイル(<lg): 下部タブは「ホーム/相談/気づく/つくる/記憶」の5枠（D02: 記憶を復帰）。
//     気づく=insights起点(リスク/期限も同柱)・つくる=documents起点(メモも同柱)。
//   各ページは <AppShell><PageHeader/>...</AppShell> で中身だけを書く。
//   companyId は URL クエリ優先。URL に無ければ最後に選択した会社
//   (localStorage 'banto-last-company') でリンクを補完する（D03）。
//   D11: テーマ切替はヘッダから撤去（コマンドパレット内の「テーマを切り替え」に格納）。
// ============================================================================

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /** この項目/タブをアクティブ表示する追加パス（同じ柱の配下ページ）。 */
  activePaths?: string[]
}

interface NavGroup {
  /** 柱の見出し（null はグループ見出しなし＝ホーム）。 */
  label: string | null
  items: NavItem[]
}

// D01: 10項目の平置きをやめ、4柱（相談する/気づく/つくる/覚える）に再編する。
//   既存URLは一切変えない（リダイレクト不要）。billing はナビ末尾の「設定」領域へ。
const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ href: '/company/home', label: 'ホーム', icon: Home }] },
  {
    label: '相談する',
    items: [{ href: '/company/chat', label: '相談', icon: MessageSquareText }],
  },
  {
    label: '気づく',
    items: [
      { href: '/company/risk', label: 'リスク診断', icon: ShieldCheck },
      { href: '/company/insights', label: '助成金・法改正', icon: Sparkles },
      { href: '/company/deadlines', label: '期限', icon: CalendarClock },
    ],
  },
  {
    label: 'つくる',
    items: [
      { href: '/company/documents', label: '書類', icon: FileText },
      { href: '/company/reports', label: '社労士に渡すメモ', icon: FileBarChart },
    ],
  },
  {
    label: '覚える',
    items: [
      { href: '/company/memory', label: '会社の記憶', icon: History },
      { href: '/company/rules', label: '自社ルール', icon: BookOpenCheck },
    ],
  },
]

// モバイル下部タブ（5枠・D02: 記憶を復帰）。柱の起点ページに遷移し、
// 同柱の配下ページでもタブがアクティブになる（activePaths）。
const MOBILE_TAB_NAV: NavItem[] = [
  { href: '/company/home', label: 'ホーム', icon: Home },
  { href: '/company/chat', label: '相談', icon: MessageSquareText },
  {
    href: '/company/insights',
    label: '気づく',
    icon: Sparkles,
    activePaths: ['/company/risk', '/company/deadlines'],
  },
  {
    href: '/company/documents',
    label: 'つくる',
    icon: FileText,
    activePaths: ['/company/reports'],
  },
  {
    href: '/company/memory',
    label: '記憶',
    icon: History,
    activePaths: ['/company/rules'],
  },
]

// D03: 最後に選択した会社の保持キー（値は companyId のみ・PIIなし）。
const LAST_COMPANY_KEY = 'banto-last-company'

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
  const urlCompanyId = searchParams.get('companyId') ?? ''
  const [drawerOpen, setDrawerOpen] = useState(false)
  // D03: URL に companyId が無いときのフォールバック（最後に選択した会社）。
  //   SSR とのハイドレーション不一致を避けるため、マウント後にだけ読む。
  const [storedCompanyId, setStoredCompanyId] = useState('')
  // ⌘（macOS）/ Ctrl（その他）を kbd 表示で出し分け。SSR では中立の Ctrl 表記。
  const [cmdKey, setCmdKey] = useState('Ctrl')
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)) {
      // navigator（外部システム）判定はマウント後にしかできない（SSRは中立表記）。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCmdKey('⌘')
    }
  }, [])

  // D03: URL の companyId を「最後に選択した会社」として保持する（URL指定が常に優先）。
  useEffect(() => {
    if (!urlCompanyId) {
      try {
        const v = localStorage.getItem(LAST_COMPANY_KEY)
        // localStorage（外部システム）との同期。SSRハイドレーション不一致回避のため
        // 描画中でなくマウント後に読む必要がある（lib/theme.tsx と同じ流儀）。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (v) setStoredCompanyId(v)
      } catch {
        /* localStorage 不可はフォールバックなし（従来挙動） */
      }
      return
    }
    setStoredCompanyId(urlCompanyId)
    try {
      localStorage.setItem(LAST_COMPANY_KEY, urlCompanyId)
    } catch {
      /* 保存失敗は無視 */
    }
  }, [urlCompanyId])

  const companyId = urlCompanyId || storedCompanyId

  // companyId を保ったままナビ遷移する。
  const withCompany = (href: string) =>
    companyId ? `${href}?companyId=${companyId}` : href

  const isActive = (item: NavItem) =>
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.activePaths ?? []).some(p => pathname === p || pathname.startsWith(`${p}/`))

  async function handleLogout() {
    // D03: ログアウト時は会社の既定選択も破棄する（共有端末での持ち越し防止）。
    try {
      localStorage.removeItem(LAST_COMPANY_KEY)
    } catch {
      /* 無視 */
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  // サイドナビ/ドロワー共通のグループ描画。
  const renderGroups = (onNavigate?: () => void, dense?: boolean) => (
    <>
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label ?? `g${gi}`} className={gi > 0 ? 'mt-4' : undefined}>
          {group.label && (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              {group.label}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map(item => {
              const { href, label, icon: Icon } = item
              const active = isActive(item)
              return (
                <Link
                  key={href}
                  href={withCompany(href)}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    dense ? 'py-2' : 'py-2.5',
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
          </div>
        </div>
      ))}
      {/* 設定領域: プラン（admin向け課金管理）。4柱の外に置く。 */}
      <div className="mt-4 border-t border-neutral-200 pt-3">
        <Link
          href={withCompany('/company/billing')}
          onClick={onNavigate}
          aria-current={pathname.startsWith('/company/billing') ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            pathname.startsWith('/company/billing')
              ? 'bg-brand-50 text-brand-700'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
          )}
        >
          <CreditCard className="h-4.5 w-4.5 shrink-0" aria-hidden />
          プラン
        </Link>
      </div>
    </>
  )

  return (
    <div className="min-h-[100dvh] bg-neutral-50 text-neutral-900">
      {/* ===== 上部ヘッダ（D21: モバイルも1段） ===== */}
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

          {/* D21: 会社スイッチャーは全幅で同一行に置く（2段目を廃止・truncateで収める）。 */}
          <div className="ml-2 min-w-0 flex-1">
            <CompanySwitcher companyId={companyId} variant="header" />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* コマンドパレット起動（Stripe 流）。デスクトップは入力風、モバイルはアイコン。 */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('banto-open-command-palette'))}
              aria-label="コマンドパレットを開く"
              title="コマンドパレット"
              className="hidden items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-500 transition-colors duration-150 hover:border-neutral-300 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:flex"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span>検索・操作</span>
              <span className="banto-kbd">{cmdKey}</span>
              <span className="banto-kbd">K</span>
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('banto-open-command-palette'))}
              aria-label="コマンドパレットを開く"
              className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:hidden"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
            {/* D11: テーマ切替はヘッダから撤去（既定はライト固定・切替はコマンド
                パレットの「テーマを切り替え」から＝設定の奥へ格納）。
                D20: ログアウトはサイドナビ末尾（>=lg）とドロワー末尾（<lg）へ格納済み。 */}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        {/* ===== 左サイドナビ(>=lg)・D01 4柱 ===== */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 px-3 py-5 lg:flex">
          <nav aria-label="会社版ナビゲーション">{renderGroups(undefined, true)}</nav>
          {/* D20: ログアウトはナビ末尾（区切り線の下）。主要導線との誤タップを避ける。 */}
          <div className="mt-auto border-t border-neutral-200 pt-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" aria-hidden />
              ログアウト
            </button>
          </div>
        </aside>

        {/* ===== メイン ===== */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* ===== モバイル下部タブ(<lg)・D02 記憶を復帰した5枠 ===== */}
      {/* id="banto-mobile-tabbar": CookieBanner がこの要素の実高さを読み、
          未同意時にバナーをこのタブバーの上に重ねて配置する（両方とも fixed bottom-0
          のため、素朴に重ねるとバナー(z-50)がタブバー(z-30)のタップ領域を覆ってしまう）。 */}
      <nav
        id="banto-mobile-tabbar"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur lg:hidden"
        aria-label="会社版ナビゲーション（モバイル）"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_TAB_NAV.map(item => {
            const { href, label, icon: Icon } = item
            const active = isActive(item)
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

      {/* ===== モバイルドロワー(ヘッダのMenuから)・D01 4柱の全項目 ===== */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/30"
            aria-label="メニューを閉じる"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white p-4 shadow-xl">
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
            <nav aria-label="会社版ナビゲーション（ドロワー）">
              {renderGroups(() => setDrawerOpen(false))}
            </nav>
            {/* D20: モバイルはドロワー末尾からログアウト（ヘッダ直置きの誤タップ防止）。 */}
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <LogOut className="h-4.5 w-4.5 shrink-0" aria-hidden />
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* コマンドパレット（Cmd/Ctrl+K・g シーケンス）。/company 全体で常駐。 */}
      <CommandPalette />
    </div>
  )
}

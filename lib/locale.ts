'use client'

import { useEffect, useState } from 'react'

// ============================================================================
// lib/locale — minimal UI-locale plumbing for the /company app shell.
// ----------------------------------------------------------------------------
//   2026-07-29 CTO (L3 audit #2): /business/en → /signup?lang=en →
//   /company/onboarding already switches display copy on the auth pages
//   (isEn pattern in (auth)/signup, (auth)/login), but ?lang=en was dropped
//   the moment the user reached the app itself (`/company/*`) — those pages
//   had no language branching at all, so an English-reading visitor who
//   signed up in English landed on an all-Japanese chat/nav.
//
//   Design (mirrors the existing D03 companyId pattern in AppShell.tsx):
//     - The URL's ?lang= is the source of truth when present (`en`/`ja`).
//     - It's mirrored into localStorage('banto-locale') so the choice
//       survives clicks to links that don't carry ?lang= explicitly
//       (most in-app <Link> hrefs don't, same reason AppShell keeps a
//       'banto-last-company' fallback for companyId).
//     - Absent both, default is 'ja' (no browser-language sniffing — this
//       app's default has always been Japanese; only an explicit signal
//       switches it).
//
//   Scope: this is intentionally a small, targeted fix (chat placeholder/
//   send button, AppShell nav/aria-labels), not a full i18n framework. If
//   more app screens need this later, extend from here rather than adding a
//   second mechanism.
// ============================================================================

export type Locale = 'ja' | 'en'

const STORAGE_KEY = 'banto-locale'

/**
 * @param urlLangParam the raw `lang` query param from useSearchParams().get('lang'),
 *   or null if absent. Pass `null` if the caller doesn't have a `lang` param at all.
 */
export function useLocale(urlLangParam: string | null): Locale {
  const [locale, setLocale] = useState<Locale>('ja')

  useEffect(() => {
    if (urlLangParam === 'en' || urlLangParam === 'ja') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(urlLangParam)
      try {
        localStorage.setItem(STORAGE_KEY, urlLangParam)
      } catch {
        /* localStorage 不可はこのセッション内のみ有効 */
      }
      return
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'en') {
        setLocale('en')
      }
    } catch {
      /* localStorage 不可はja既定のまま */
    }
  }, [urlLangParam])

  return locale
}

/** Appends `lang=en` to an href when the current locale is English (no-op for 'ja'). */
export function withLocale(href: string, locale: Locale): string {
  if (locale !== 'en') return href
  return href.includes('?') ? `${href}&lang=en` : `${href}?lang=en`
}

/** Tiny inline picker: `t(locale, '日本語', 'English')`. Keeps call sites short. */
export function t(locale: Locale, ja: string, en: string): string {
  return locale === 'en' ? en : ja
}

# 番頭 / Banto — Persona UX Dogfooding Audit (Loop01 / Persona 10)

- **Persona**: John Smith (35), HR manager at the Japan subsidiary of a foreign company. Prefers English UI, intermediate Japanese.
- **Goal**: See how far the product is usable in English, and whether it helps him understand Japanese labor law *in English*.
- **Anxiety**: Non-Japanese locale support may be poor.
- **Method**: First-hand operation via Playwright/Chrome, desktop, banto-roumu.com. Third-party evaluation, 忖度なし.
- **Date/time**: 2026-07-23 ~23:25 JST.
- **Disposable account intended**: `test+p10_loop01_41dh8kvp@example.com`

> **Environment caveat (read first).** This audit ran in a Chrome profile shared with other concurrent persona-audit runs. Two artifacts resulted and are called out inline so they are NOT mistaken for product defects: (1) at signup submit, Chrome **autofill silently overwrote my email** with a stale value from a parallel run (`test+p03_loop01_...`); (2) the app's **session cookie was repeatedly rotated** by parallel logins, causing intermittent Japanese "権限が確認できませんでした" (permission could not be confirmed) errors on the chat/billing endpoints. When my session was momentarily valid, the English chat worked perfectly (evidence below).

---

## (A) 3-Second Test — "As an English speaker, can I tell what this is?"

**Verdict: FAILS for a non-Japanese reader.**

- URL: `banto-roumu.com/business`. The page is **100% Japanese**. The only Latin text is the **"BANTO / 番頭" wordmark** and incidental proper nouns further down (SmartHR, Supabase, HTTPS/TLS, "AI", plan names "Entry"/"Standard").
- **No language toggle / 言語 / EN selector anywhere** — not in the header, footer, signup, or app.
- In 3 seconds an English speaker sees a navy **"BANTO"** logo and a chat-style mockup → can *guess* it's an AI chat product, but nothing signals (a) the domain is **labor/HR law**, or (b) that it can be **used in English**. John's core question ("can I use this in my language?") gets no visible "yes."
- Evidence: `get_page_text` of `/business` (full page, Japanese only); landing screenshot.

---

## (B) Journey

1. `/business` — Japanese-only landing. Cookie banner Japanese ("ログイン維持にCookieを使用します…"), accepted.
2. `/signup` — Japanese-only. Fields: メールアドレス / パスワード（8文字以上）/ 会社名（任意）. Required consent checkbox **「事業者として利用します（18歳以上）」** (Japanese only). Optional newsletter checkbox.
   - Entered `test+p10_loop01_41dh8kvp@example.com`, password, company name **"Acme Japan K.K."** (Latin script accepted).
   - **At submit, Chrome autofill replaced the email with a stale `test+p03_...` value** (screenshot-confirmed) → my intended p10 account was NOT the one submitted. Harness artifact.
3. Redirected to `/company/onboarding` — "会社の基本情報を登録". Japanese dropdowns: **業種** (20 JSIC options, all Japanese), **従業員数**, **36協定** buttons. (A McAfee True Key save-password popup also appeared — browser, not product.)
4. `/company` (account home) — Japanese. Company card renders **"Acme Japan K.K."** (管理者 / 1 席 / 0 自社ルール).
5. `/company/chat` — sent the English yukyu question.
   - First 2 sends returned the Japanese permission error (session-rotation artifact).
   - Once my session settled on "Acme Japan K.K.", the AI returned a **full, high-quality English answer** (see D/F).
   - A follow-up **Japanese** question then hit the same permission error again (session rotated once more) → JP-answer path **未確認/unverified** in this run (but the sample-demo and comparison sections confirm Japanese is the native path, and English input→English output is confirmed).

---

## (C) Findings — 3 Tiers (with evidence)

### 離脱級 (drop-off)

1. **Zero English localization across the entire UI; no language toggle.** Landing, signup, onboarding, sidebar nav (相談/リスク診断/助成金・法改正/期限/書類/社労士に渡すメモ/会社の記憶/自社ルール/プラン/ログアウト), every button, every disclaimer, and even the **chrome around the AI answer** (参考情報 header, 記憶に保存 / 期限を作る / 社労士に渡すメモを作る, save-to-memory prompt) are Japanese only. A non-Japanese HR manager cannot self-serve with confidence. **This directly confirms John's anxiety.** Evidence: `get_page_text` of `/business`, `/signup`, `/company`, `/company/chat`.
2. **The required consent checkbox「事業者として利用します（18歳以上）」is Japanese-only and gates registration.** An English speaker is forced to agree to something they cannot read to create an account. Evidence: signup screenshot.
3. **(Conditional) The permission-error copy has no English fallback.** "この会社の相談を開く権限が確認できませんでした。会社の切り替えで自社を選び直すか、管理者の方にご確認いただけますか。" In *this* audit the error was harness contamination — but the **product ships this recovery message in Japanese only**. A real non-Japanese user who ever lands in a stale-session/permission state hits a dead end with no readable recovery path. Evidence: chat `get_page_text` (error appeared 3×).

### イライラ級 (frustration)

1. **Onboarding 業種 dropdown = 20 Japanese JSIC categories, no English.** John must translate/guess to select "情報通信業" (IT). Evidence: `read_page` combobox options (農業・林業 … 分類不能の産業).
2. **Mixed-language answer surface.** The AI *body* is English, but the labels wrapping it stay Japanese: 参考情報 (header), 記憶に保存 / 期限を作る / 社労士に渡すメモを作る (action buttons), 「この方針を会社の記憶に残しますか？ … 記録する / いいえ」 (save prompt), and the 【根拠】 basis-label. John gets the answer but can't confidently operate the follow-up actions. Evidence: chat `get_page_text` + screenshot.
3. **Sample-company demo on `/business` is Japanese-only**, so an English speaker cannot preview the product's answer style before committing to signup. Evidence: `/business` text.

### 微差 (minor)

1. Company name accepts and displays Latin script ("Acme Japan K.K.") cleanly — good, but its field label/placeholder is Japanese.
2. Signup company-name placeholder is Japanese ("会社名（任意・あとでも入力できます）").
3. `/account` and `/settings` both 404 — no discoverable self-serve account page for a user hunting settings by URL.

---

## (D) What Worked Well

- **The English AI answer was genuinely excellent and accurate on Japanese labor law.** For the yukyu question it delivered, in fluent English:
  - Entitlement scale (6mo→10d, 1.5y→11, 2.5y→12, 3.5y→14, 4.5y→16, 5.5y→18, 6.5y+→20), 6-month / 80%-attendance threshold.
  - Part-time pro-rating ("hikaku-fuyo" 比例付与).
  - **The 2019 5-day mandatory-use rule** for employees with ≥10 days, employer-designation duty, **up to ¥300,000 penalty per employee** — with an appropriate "please verify current amount" caveat.
  - 2-year carry-over/expiry; timing rights ("jiki shitei ken" / employer's business-disruption exception); planned-leave system (keikaku nenkyu); pay-during-leave options.
  - **A transparent "What I Could Not Confirm for Acme Japan" section** (company rules not yet registered), and a **【根拠】** footer citing 労働基準法 Art. 39 + 厚生労働省, noting "no confirmed figures from the registered fact database were used." This is exactly the honesty a foreign HR manager needs.
- **Bilingual capability confirmed**: reads English input, answers in English, understands the "yukyu" romaji.
- **Low-friction signup structure**: email + password only, no credit card, company name optional.
- **Latin company names render correctly** throughout.

Evidence: full chat `get_page_text` (English answer captured in full) + screenshot showing header "Acme Japan K.K.", English Q bubble, English A, "本日の残り相談 18/20回".

---

## (E) Success Case

- **Industry**: Foreign-affiliated IT / software (Japan subsidiary)
- **Size**: ~15 employees (10–29 band)
- **Topic**: Understanding statutory paid-leave (yukyu) obligations *in English*, incl. the 5-day mandatory-use rule
- **Time taken**: ~2 minutes from question to a complete English explanation
- **Quote (John's voice)**:
  > "I typed my question in plain English and got a clear, accurate rundown of Japan's paid-leave law — the entitlement table, the 5-day mandatory rule, carry-over — all in English. It even told me exactly what it couldn't confirm until we register our own work rules, and cited the Labor Standards Act. For once I understood a Japanese labor obligation without a translator. The catch: everything *around* the answer — the menus, the buttons, the sign-up consent box — is Japanese only, so I leaned on my intermediate Japanese just to get to the chat."

---

## (F) Goal Achieved?

**PARTIAL — YES at the answer layer, blocked at the UI layer.**

- ✅ **Core goal met**: John *can* use the chat in English and *did* understand Japanese labor law in English. The AI answer quality is a genuine strength and the single most valuable thing for this persona.
- ⚠️ **But the path to and around that answer is Japanese-only.** No language toggle; signup, the required consent checkbox, onboarding dropdowns, sidebar, and answer-action buttons all require reading Japanese. John (intermediate JP) got through; a **zero-Japanese** user would most likely stall at the signup consent checkbox or the onboarding industry dropdown, never reaching the chat.
- **Single highest-leverage fix**: add an EN/JA language toggle (or at least localize signup + the AI-answer chrome + error messages). The AI is *already* bilingual; the shell is the bottleneck.

---

## Cleanup

**NOT completed — deliberately skipped for safety. 未確認/unverified.**

- Chrome autofill overwrote my registration email with a parallel run's disposable address (`test+p03_...`) at submit, so a **cleanly p10-owned account was never created**. The company "Acme Japan K.K." I registered is entangled under another persona's (p03's) disposable account.
- The app's session cookie was being rotated by concurrent runs (intermittent 403s), so any destructive deletion could target the **wrong / a parallel run's** account.
- No self-serve deletion page was reachable (`/account`, `/settings` → 404; `/company/billing` → 権限がありません).
- **Decision**: do not delete, to avoid destroying a parallel run's data. **Follow-up for the harness owner**: run persona audits in *isolated* browser profiles (separate Chrome user-data-dir per persona) to prevent autofill/session cross-contamination; and sweep any orphaned "Acme Japan K.K." company left under the `test+p03_...` disposable account.

# Loop1 ドッグフーディング 高リスク所見 現物確認（独立クリーンセッション）

検証者: verifier（実装から独立）／日時: 2026-07-23〜24 JST
手法: ~/banto コード読解（main）＋ banto-roumu.com curl実測 ＋ Supabase service-role 読取り。
footprint: **本番へ新規データを一切書き込まず**（全項目をコード＋読取り＋curlで確定できたため使い捨て会社は作成せず）。本番の会社は既存の「検証製造K.K.」1社(free)のみで、これは当方作成物でないため削除対象外。残データ0でクリーン。
注: 当セッションにはブラウザMCPが無く（Read/Bash/WebFetchのみ）、クライアント側描画はコードで確定した。

---

## 判定サマリ
1. 士業¥29,800の目玉が無料で可能か … **事実（ゲート漏れ確定）**
2. 就業規則ファイルアップロード機能 … **誤り（アップロード機能は存在しない＝persona07が正）**
3. CSP開示ギャップ … **一部（CSPギャップは事実／ただし実データ送信はゼロ）**
4. 相談タブ companyId無し行き止まり … **事実（条件付き＝localStorage未設定の初回導線のみ）**
5. 退会/削除UIの発見性 … **事実（/account は404・削除は billing に埋没）**

**士業ゲート漏れ: 有り（収益影響＝構造的・現時点の実損はゼロ）**

---

## 1. 士業プラン¥29,800の目玉が無料で実質可能か = 事実（ゲート漏れ）

証拠（コード）:
- `app/api/company/route.ts` POST: user取得→{name,seats}→companies INSERT→admin member INSERT。**plan も 会社所有数も一切チェックしない**（41-56行）。
- `lib/plans.ts` の `multiClient` フラグ（士業のみ true, 168行）は grep 全走査で **tokushoho表示 / billing表示 / checkout課金数量ロジックの3箇所のみ**参照。会社作成・切替のゲートには一度も使われない。
- `supabase/company_schema.sql:35` `plan text NOT NULL DEFAULT 'free'`＋`plan_ssot_migration.sql:41` DEFAULT 'free'。→新規会社は誰が作っても free。
- DBトリガは `trg_company_seat_limit`（`enforce_company_seat_limit`, company_schema.sql:195-212）**のみ**＝1社内のメンバー席数(seats_purchased)制限。**ユーザーあたり会社数の制限トリガ/ポリシーは全sqlに存在しない**（全走査確認）。
- `app/(app)/company/page.tsx:333-` 「別の会社（顧問先）を追加する」UIは同じ無制限 POST /api/company を叩く。
- `app/(app)/company/_components/CompanySwitcher.tsx:92-` 複数社セレクタは `companies.length > 1` で**無条件表示（plan判定なし）**。

→ FREEプランで複数顧問先の作成・切替・各社データ分離（記憶分離）が全部使える。これは士業プランの旗艦訴求そのもの（`app/business/page.tsx:272` 「複数の顧問先を管理」/ `billing/page.tsx:275`「複数の顧問先を切り替え・各社データ分離」/ FAQ「士業プランで複数顧問先を切り替えて使えます」）。

士業プランで**実際に enforce されている差別化**（コード上）:
- 日次レート上限が最上位（chat 400 / insights 80 / risk_audit 80 / document_generate 80 / document_review 80 / api_v1 20000）＝ `lib/rate-limit.ts` が `limitFor(planId,kind)` で enforce。
- seatCap 50（1社あたり購入可能席の天井）。
- 席（シート）課金モデル（multiClient=true → checkout の billQuantity=席数）。
→ すなわち「複数顧問先切替・各社記憶分離」という**看板機能は無料**で、士業で実際に閉じているのはレート上限・席数・課金形態のみ。

収益影響: 現状 `BILLING_ENABLED` 未有効・本番会社は1社のみの pre-launch。**実損はまだゼロ**。ただし課金解禁時に¥29,800の主要購入動機が既に無料で成立している構造的リーク。手当案: 会社作成POSTで「所属会社数 > 1 は multiClient プランを要求」or「非shigyoは2社目作成を課金導線へ」を追加。

## 2. 就業規則ファイルアップロード = 誤り（アップロードは存在しない）

証拠:
- `app/api/company/document/ingest/route.ts` POST は `documentText`（テキスト）を受ける（79-96行）。
- `type="file"` / FileReader / multipart / formData / PDF解析は**リポ全体でゼロ**（app/ components/ 全走査）。
- `app/(app)/company/documents/page.tsx`: レビューもingestも Textarea 貼り付け（344「既存の規程テキストを貼り付け」/ 455「全文を覚えさせる」）。
- D22「規程ingest→差分要約」= テキスト貼り付けの**再取込（改定）時に差分要約**する機能。ファイルアップロードではない。

→ persona07「アップロード機能が存在しない・番頭は手入力で覚えさせるモデル」は**正しい**。
期待ズレの種（軽微）: `/security` 本文に「アップロードされた規程や登録データ…」の表現あり（プロンプトインジェクション防御の文脈）。ここだけ「アップロード」を想起させるが、ingest UI 実体は貼り付け。文言の軽微なギャップ。

## 3. CSP開示ギャップ = 一部（CSPギャップは事実／実データ送信ゼロ）

証拠（curl実測 banto-roumu.com ヘッダ）:
- enforce CSP: `script-src ... https://www.clarity.ms https://*.clarity.ms`、`connect-src ... https://*.sentry.io https://*.ingest.sentry.io` を許可。
- `/security` 委託先一覧(8項)= Supabase/Anthropic/Dify/OpenAI/Vercel/Resend/Stripe/Plausible **のみ**。`/privacy` 第3条 = Anthropic/Supabase/Plausible/Stripe **のみ**。→ Clarity(Microsoft)・Sentry は両開示に未記載。persona04 の「CSP許可 vs 開示未記載」は事実。

ただし（重要な緩和事実）:
- 本番 homepage HTML に **clarityスクリプトタグ／clarity ID／sentry の痕跡ゼロ**（curl実測）。
- `components/analytics/Clarity.tsx`: `NEXT_PUBLIC_CLARITY_ID` 未設定なら完全 no-op。`instrumentation.ts`: `SENTRY_DSN` 未設定なら no-op。
→ **現状 Clarity/Sentry は発火しておらず、実データ送信はゼロ**。CSPは「有効化前の先行許可(no-op許可)」。

判断材料: 現時点で無断データ送信の実害は無い。穴は「未使用ホストをCSP先行許可し、かつ有効化時に開示追記する運用ゲートが無い」こと。推奨=(a)有効化まで clarity/sentry を enforce CSP から外す or (b)有効化と同時に /security・/privacy に追記する運用を義務化。**Clarity を有効化した瞬間に開示未追記だと本当の開示違反になる**ため、有効化前に開示追記を紐付ける。

## 4. 相談タブ companyId無し行き止まり = 事実（条件付き）

証拠:
- `app/(app)/company/chat/page.tsx` 末尾: `<CompanyGuard><CompanyChat/></CompanyGuard>`。
- `CompanyGuard.tsx:32-61`: companyId が URL に無いとき localStorage `banto-last-company` を見て、あれば `?companyId=` を付け replace、**無ければ「会社が指定されていません。会社一覧に戻る」を表示**（自動選択ロジック無し）。
- `AppShell.tsx:170-174`: 下部タブ `withCompany(href)= companyId ? href?companyId : href`。companyId = URLクエリ or storedCompanyId(localStorage)。
→ 初回セッション（localStorage空）で /company ハブ（companyId無し）から「相談」タブを叩くと bare `/company/chat` → CompanyGuard → localStorage空 → **行き止まり**。単一会社ユーザーでも1社を自動選択しない。ある会社ページを一度開けば localStorage が入り以後解消。
→ persona02 は正しい（**初回導線でのみ再現**）。curl `/company/chat`(companyIdなし)=307(未認証→login)でクライアント挙動は測れず、コードで確定。
改善案: CompanyGuard に「所属が1社ならそれを自動選択」を追加。

## 5. 退会/削除UIの発見性 = 事実（/account 404・billingに埋没）

証拠:
- `/account` = 本番 **404**（curl実測）。`app/account`・`app/(app)/account` は不在。削除は `app/api/account/route.ts`(DELETE)のみ。
- 削除UI = `DataSecuritySection.tsx`（「削除」と入力させる二段確認で DELETE /api/account）。レンダリング箇所は `app/(app)/company/billing/page.tsx:344` **のみ**。ナビ上 billing は AppShell の「設定」領域末尾。
→ 初見ユーザーが「退会」を探すと /account は404、削除は**プラン・請求ページの中**という非直感的な場所。発見性は低い。persona05 の指摘は正しい。
改善案: /account を用意し billing の削除セクションへ誘導、または退会リンクをアカウント/設定に明示。

# 番頭 バックアップ / リストア runbook

本番 Supabase プロジェクト `hsyalzzcemtewmtorwkn`（Gokaku と同一プロジェクト・番頭は
`companies` / `company_*` テーブル、旧個人版は `memoly_*`）のバックアップ体制と復旧手順の台帳です。

最終更新: 2026-07-10（Wave 2）

---

## 0. 結論（まず読む）

- このプロジェクトは **Supabase 無料枠** で運用しています（Gokaku と共有・7日無アクティブで自動停止する枠）。
- **無料枠にはマネージドな日次バックアップも PITR（Point-in-Time Recovery）も付きません。**
  （日次バックアップ=Pro以上・7日保持／PITR=有料アドオン・Pro以上）。
- したがって現時点の実効的なバックアップは **本 runbook のローカル論理ダンプ（`scripts/backup_dump.mjs`）** です。
  これを定期的に手元で走らせて世代を残すのが、無料枠での唯一の現実解になります。
- 課金判断（Pro化してマネージドバックアップ/PITRを得るか）は、有料課金のため Takeshi の承認事項です。
  番頭に実データ（複数社・有償顧客）が乗る段階で Pro 化を推奨します。それまではローカル論理ダンプで足ります。

### Takeshi 手動確認タスク（1回・ダッシュボード）
無料枠であることの最終確認と、Pro 化した場合の自動バックアップ有効化確認:
1. Supabase ダッシュボード → プロジェクト `hsyalzzcemtewmtorwkn` → **Settings → Billing** でプラン（Free/Pro）を確認。
2. Pro の場合: **Database → Backups** で日次バックアップの有無と保持期間、**Point in Time Recovery** の有効/無効を確認。
3. 確認結果を本ファイルの「0. 結論」に追記（プラン変更時の差分管理のため）。

---

## 1. バックアップの取得（読取専用・安全）

`scripts/backup_dump.mjs` は **service role で GET のみ** を発行し、テーブルを NDJSON でローカルに落とします。
**INSERT/UPDATE/DELETE/DDL は一切発行しません**（本番を絶対に書き換えない）。出力は `backups/`（`.gitignore` 済＝顧客データを git に載せない）。

```bash
cd ~/memoly

# まず件数だけ確認（本文は書かない）
node scripts/backup_dump.mjs --dry-run

# 実ダンプ（backups/<UTCタイムスタンプ>/<table>.ndjson と _manifest.json を生成）
node scripts/backup_dump.mjs

# テーブルを絞る場合
TABLES=companies,company_members,company_profiles node scripts/backup_dump.mjs
```

対象テーブル（番頭 SaaS 本体＋旧個人版）:
`companies, company_members, company_profiles, company_attributes, company_memories,
company_conversations, company_messages, company_documents, company_deadlines, company_leads,
company_digests, company_risk_scores, company_audit_logs, company_billing_events,
memoly_users, memoly_profiles, memoly_memories, memoly_conversations, memoly_messages,
memoly_reports, memoly_api_usage, memoly_extraction_logs`

- 未適用テーブル（例: `company_audit_logs` / `company_leads` は手動マイグレーション未反映なら 404）は
  自動で SKIP し、失敗にはしません（`docs/BANTO_MANUAL_MIGRATIONS.md` 参照）。
- **auth.users（認証情報）は PostgREST 経由では取得しません。** 認証ユーザーの復旧は §3 を参照。

### 推奨運用
- 実データが乗るまで: 週1回手動で `node scripts/backup_dump.mjs` を実行し、`backups/` を外部（暗号化した個人ストレージ）へ退避。
- 世代管理: `backups/<timestamp>/` がそのまま世代。3〜4世代を目安に保持。
- `_manifest.json` にテーブル別件数が残るので、ダンプ間の件数急減（=消失事故）検知に使えます。

---

## 2. リストア（復旧手順）

> 復旧は**本番を書き換える**操作です。番頭の SSOT では本番書込・migration 適用は Takeshi の判断で行います。
> 本 runbook の restore 手順は「壊れた/消えたときに使う道具」であり、平常時は実行しません。
> `backup_dump.mjs` を read-only に留めているのはこのため（誤実行での上書き事故を構造的に防ぐ）。

### 2-A. テーブル単位のリストア（論理ダンプから）

NDJSON を service role で upsert して戻します。以下は最小の復旧スクリプト例です（`--confirm` を付けたときだけ書き込む二段構え）。
必要時に `scripts/backup_restore.mjs` として保存して使ってください（平常時はリポジトリに置きません）。

```js
// backup_restore.mjs — NDJSONダンプ→本番へupsert（--confirm時のみ書込）
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const [dir, table] = [process.argv[2], process.argv[3]]     // 例: backups/2026-... company_profiles
const CONFIRM = process.argv.includes('--confirm')
const env = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) env[m[1]]=m[2].trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false } })
const rows = readFileSync(`${dir}/${table}.ndjson`,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l))
console.log(`${table}: ${rows.length} rows to restore`)
if (!CONFIRM) { console.log('dry-run（--confirm で実際に upsert）'); process.exit(0) }
for (let i=0;i<rows.length;i+=500) {
  const { error } = await sb.from(table).upsert(rows.slice(i,i+500), { onConflict: 'id' })
  if (error) { console.error(error); process.exit(1) }
}
console.log('done')
```

```bash
# 1) まず dry-run で件数確認
node backup_restore.mjs backups/2026-07-10T.../ company_profiles
# 2) 問題なければ実書込
node backup_restore.mjs backups/2026-07-10T.../ company_profiles --confirm
```

注意:
- `onConflict` は各テーブルの主キー（多くは `id`。`company_members` 等の複合キーはそのテーブルの一意制約名に合わせる）。
- 外部キー依存があるため復元順は **親→子**（`companies` → `company_members`/`company_profiles` → その他）。
- upsert は既存行を上書きします。**先に §1 で現状をダンプ**してから実行（復旧の復旧ができるように）。

### 2-B. 全体リストア（プロジェクト全体を時点復旧したい）

- **Pro + PITR/日次バックアップがある場合（推奨）**: Supabase ダッシュボード → Database → Backups から
  時点復旧/バックアップ復元を実行。これが最も安全（auth・storage・拡張・RLSまで含む完全復旧）。
- **無料枠（現状）**: 全体の時点復旧は不可。§2-A のテーブル単位復旧を親→子の順で全テーブル分回すのが代替。
  スキーマ（テーブル/RLS/関数/pgvector）は `supabase/*.sql` が SSOT なので、空プロジェクトへは
  それらを SQL Editor で流し込み → §2-A でデータ投入、の順で再構築できます。

### 2-C. スキーマの再現
テーブル定義・RLS・関数・拡張は `supabase/` 配下の SQL がSSOT:
`schema.sql, company_schema.sql, company_*.sql, api_usage.sql, plan_ssot_migration.sql,
company_memory_semantic.sql`（pgvector）ほか。手動適用の台帳は `docs/BANTO_MANUAL_MIGRATIONS.md`。

---

## 3. 認証ユーザー（auth.users）の扱い

- `auth.users` は PostgREST では読み書きしません。無料枠では auth スキーマの論理ダンプ手段が限られます。
- 現実運用: ユーザーは Supabase Auth（メール/パスワード・マジックリンク）で自己再登録が可能。
  番頭のデータは会社スコープ（`company_members.user_id`）で紐づくため、**ユーザー消失時は
  同一メールで再作成 → `company_members` の `user_id` を新UIDへ張り替え**で復帰できます（§2-A の upsert で対応）。
- 完全な auth 復旧が要件になったら Pro 化 + ダッシュボードのバックアップ復元が正道です。

---

## 4. 外形監視（uptime）の下地

`/api/health` を実装済み（認証不要・秘密値を返さない・DB往復1回・`Cache-Control: no-store`）。
- 正常: `200 {"status":"ok"}` ／ DB不通など致命: `503 {"status":"error"}` ／ env欠落のみ: `200 {"status":"degraded"}`
- 監視は「200 かつ body に `"status":"ok"`」を成功条件にするのが確実です。

### Takeshi 手動タスク: UptimeRobot 設定（無料枠で可）
無料枠: 50モニター・5分間隔まで無料。
1. https://uptimerobot.com でアカウント作成（無料）。
2. Add New Monitor → Monitor Type: **HTTP(s)**。
3. URL: `https://banto-roumu.com/api/health`、間隔: 5分。
4. （任意）Advanced → Keyword monitoring で `"status":"ok"` を含むことを成功条件に。
5. Alert Contacts にメール（`kazumototakeshi@gmail.com`）を登録。
- 代替: Better Stack（旧 Better Uptime）無料枠、または Vercel の外形監視でも可。

---

## 5. エラー監視（Sentry）— env-gate 実装済・アカウントは手動

`instrumentation.ts` に **env-gate 方式**で計装済みです。`SENTRY_DSN` が無ければ完全 no-op
（本番挙動・ビルドに影響なし）。`@sentry/nextjs` は DSN 投入時に導入する運用にしてあり、未導入でもビルドは通ります。

無料枠: Sentry **Developer プラン（無料）** = 5,000 errors/月・1ユーザー・30日保持。番頭の現トラフィックでは十分。

### Takeshi 手動タスク: Sentry 有効化
1. https://sentry.io でアカウント作成（無料）→ プロジェクト作成（Platform: **Next.js**）。
2. 表示される **DSN**（`https://xxxx@oooo.ingest.sentry.io/nnnn`）を控える。
3. パッケージ導入: `cd ~/memoly && npm i @sentry/nextjs`
4. Vercel（memoly-chat）の環境変数に `SENTRY_DSN` を設定（Production）。ローカル検証は `.env.local` にも。
5. 再デプロイ後、`instrumentation.ts` の `register()` が `[instrumentation] Sentry 有効化しました` を出せば有効。
- CSP は `*.sentry.io` / `*.ingest.sentry.io` を connect-src に許可済み（追加設定不要）。
- PII は送らない設定（`sendDefaultPii: false`）。労務データを外部へ出さない安全既定。

---

## 6. 行動観察（Microsoft Clarity）— env-gate 実装済・アカウントは手動

`components/analytics/Clarity.tsx` を layout に組込済み。`NEXT_PUBLIC_CLARITY_ID` が無ければ何も描画しません（no-op）。
インライン snippet を使わずタグを直接ロードするため CSP 適合（`unsafe-inline` に依存しない）。

無料枠: Clarity は **完全無料・トラフィック上限なし**（ヒートマップ/セッションリプレイ）。

### Takeshi 手動タスク: Clarity 有効化
1. https://clarity.microsoft.com でアカウント作成（無料）→ プロジェクト作成（サイト: `banto-roumu.com`）。
2. 発行される **Project ID**（10桁前後の英数字）を控える。
3. Vercel（memoly-chat）の環境変数に `NEXT_PUBLIC_CLARITY_ID` を設定（Production）。
4. 再デプロイ後、`https://www.clarity.ms/tag/<ID>` が読み込まれれば有効。
- CSP は `www.clarity.ms` / `*.clarity.ms` を script-src / connect-src に許可済み（追加設定不要）。
- Cookie 同意/プライバシー表記の整合は公開前に確認（現状の CookieBanner・privacy と齟齬がないか）。

---

## 7. CSP 強化の計測レーン（script-src の unsafe-inline 撤去に向けて）

現状（enforce）は `script-src 'self' 'unsafe-inline' ...` を維持しています。理由は **Next.js が
フレームワーク製のインライン script（ハイドレーション）をページ毎に出す**ためで、これを外すと即クラッシュします。
自前の実行可能インライン（旧 plausible-init）は `/plausible-init.js` へ外部化済み＝**自作コードのインラインは 0**。

そこで `next.config.ts` に **`Content-Security-Policy-Report-Only`（厳格版・unsafe-inline なし）を並走**させています。
これは enforce しない（画面を壊さない）で違反だけを `/api/csp-report` に集め、残るインラインの正体を定量化します。

実測（2026-07-10・`/business`）: report-only 違反 **32件／全て `script-src-elem: inline`（disposition=report）**。
= 残っているのは Next フレームワーク製インラインのみ、という裏取り。

### 到達可能な最も厳格な状態と、次の一手
- 完全撤去には **nonce + `strict-dynamic` 方式**が必要ですが、Next.js では nonce 付与がページを
  **動的レンダリング化**します。番頭は `/roumu/*`（SEO記事）や `/business` が静的で、これを動的化すると
  TTFB/キャッシュが劣化するため、**壊さない・SEOを落とさない**を優先して現状は Report-Only 計測に留めています。
- 次の段階（別Wave）の選択肢:
  1. `/company/*`（認証済＝既に動的）だけ middleware で nonce+strict-dynamic を適用し、静的な公開面は現状維持（推奨・部分適用）。
  2. サイト全体 nonce 化（静的面の動的化を許容する経営判断が要る）。
- 計測の読み方: `/api/csp-report` のログ（Vercel）に `directive=... blocked=...` が出ます。`inline` 以外
  （外部ホスト）の違反が出たら、それは許可ホストの追加漏れなので `next.config.ts` に足します。

---

## 付録: 検証済み事項（Wave 2 実走ログ）
- `node scripts/backup_dump.mjs`（read-only）: 22テーブル、failed=0（未適用2テーブルはSKIP）。
- `/api/health`: 200 `{"status":"ok"}`、`/api/csp-report`: 204。
- 主要ページ（/business,/login,/signup,/privacy,/terms,/roumu/*,/tools/*）: console.error 0・pageerror 0・4xx/5xx 0。
- 認証後フロー実走（`scripts/authed_e2e_capture.mjs`）: login→company→onboarding→chat→memory の実スクショ取得（`e2e-captures/`・gitignore）。

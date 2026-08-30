# Owner 手動 TODO — one-product 残り

**対象**: コードでは閉じられない作業だけ  
**不要**: `/zure` ヒーロー・ドメイン301・リポ合併・名前合わせの追加コピー  
**前提**: Banto `eeef6f7` 以降、Agent Netlify 本番はヒーロー主CTA一本まで反映済み

---

## 優先順（この順でやる）

1. Supabase `pack_invites` 表
2. Vercel のメール env（Resend）確認
3. Stripe 台帳 Price / Payment Link の新規停止（アーカイブ）
4. Stripe 商品名を「就業規則AI …」に揃える
5. （任意）`contact@` → `support@` 転送
6. （任意）パック Payment Link の成功URL確認
7. スモーク：テスト決済またはログ確認

---

## 1. Supabase に `pack_invites` を作る

**なぜ**: パック購入 webhook が `pack_invites` へ upsert する。表が無いと招待記録が落ち、再送・監査ができない。

### 手順

1. [Supabase Dashboard](https://supabase.com/dashboard) を開く  
2. 就業規則AI（banto-roumu.com）の **本番プロジェクト** を選ぶ  
3. 左メニュー **SQL Editor** → **New query**  
4. リポジトリの次を全文ペーストして Run:

`https://github.com/kzmttkc/memoly/blob/main/supabase/pack_invites.sql`

ローカルなら:

```bash
# ファイル場所
/Users/takeshi/banto/supabase/pack_invites.sql
```

5. 成功確認（SQL Editor で）:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'pack_invites'
order by ordinal_position;
```

期待: `id`, `stripe_session_id`, `email`, `status`, `user_id`, `mailed_at`, `created_at`, `meta`

6. （任意）Table Editor で `pack_invites` が見えること

**やらないこと**: 既存の `companies` / 課金表の変更。この SQL は追加のみ。

---

## 2. Vercel でパック招待メールが送れるか確認

**なぜ**: `lib/pack-invite.ts` は次が揃わないとメールを送らず、ログにだけ警告を残す。

- `RESEND_API_KEY`
- `DIGEST_FROM_EMAIL`（なければ `MAIL_FROM`）

### 手順

1. [Vercel](https://vercel.com) → プロジェクト **memoly**（banto-roumu.com）  
2. **Settings → Environment Variables**（Production）  
3. 次を確認する（値は画面ではマスクされるので「存在する／From 形式が正しい」だけでよい）:

| 変数 | 期待 |
|---|---|
| `RESEND_API_KEY` | `re_...`（Resend の本番キー） |
| `DIGEST_FROM_EMAIL` または `MAIL_FROM` | 例: `就業規則AI <support@banto-roumu.com>` または Resend 検証済みドメインの From |

4. Resend ダッシュボードで ** Domains ** が verified か確認  
5. From がそのドメイン（または検証済みアドレス）であること  
6. 未設定なら追加 → **Redeploy**（env 反映のため最新 Production を再デプロイ）

### 動作確認（推奨）

- Stripe CLI またはテスト Payment Link でパック相当の `checkout.session.completed` を banto webhook に流す  
- Vercel **Functions / Logs** で `/api/company/billing/webhook` を見る  
  - 成功例: `ok: pack: invite mailed` / `ok: pack: existing_user mailed`  
  - 失敗例: `[pack-invite] RESEND_API_KEY / DIGEST_FROM_EMAIL 未設定`  
- Supabase `pack_invites` に1行入り、`status` が `mailed` または `existing_user`  
- 受信箱に件名「就業規則AI — パックの次は、ずれを1枚にする」  
- リンク: `/invite?from=pack`（→ `/signup`）または既存ユーザーなら `/zure?from=pack`

**注意**: Word 配信はこれまでどおり Agent（Netlify）側。Banto は Free 案内だけ。両方の webhook が同じ Stripe アカウントからイベントを受けてよい（製品ガードで分岐）。

---

## 3. Stripe — 台帳 1,980 の新規をアーカイブ

**目的**: 既存購読は残し、**新規購入だけ止める**（強制解約しない）。

### 対象 ID（コード正典）

| 項目 | 値 |
|---|---|
| Product | `prod_V6k8wDcAUcPlIL` |
| Price | `price_1U6WeSJzuwrOe7d10HxNhYHx` |
| Payment Link | `plink_1U6WelJzuwrOe7d1bigUQzK2` |
| URL | `https://buy.stripe.com/fZu00k1hS3BY9FbeV19MY0k` |

### 手順（Dashboard・LIVE）

1. [Stripe Dashboard](https://dashboard.stripe.com) → **LIVE モード**であることを確認（テストトグルOFF）  
2. **Product catalog → Products** → 上記 Product（カスハラ記録台帳）を開く  
3. **Price** `price_1U6WeSJzuwrOe7d10HxNhYHx`  
   - **Archive price**（または Deactivate）  
   - 既存サブスクは継続される（Archive は新規 Checkout 用）  
4. **Payment links** → `plink_1U6WelJzuwrOe7d1bigUQzK2`  
   - **Deactivate** / 無効化  
5. 確認: 上記 buy.stripe.com URL を開くと購入できないこと  
6. 既存顧客向けポータルは残す（特商法どおり）:  
   `https://billing.stripe.com/p/login/cNibJ22lW6Oa9FbaEL9MY00`  
7. サイト側: `kasuhara-ledger.html` はすでに「新規停止」＋無料記録へ。**Buy の Payment Link 再注入はコードで停止済み**。追加の HTML 編集は不要

**やらないこと**: 既存台帳顧客の Subscription を一括キャンセルしない。

---

## 4. Stripe — 商品名を「就業規則AI …」に揃える

**目的**: 領収書・明細・Checkout 上の名前が Kabau / 番頭 / sharoushi 単独に見えないようにする。

### 手順

1. Stripe LIVE → **Product catalog**  
2. 次を開き、**Name**（必要なら Statement descriptor 近傍の表示名）を変更:

| 現行の目安 | 推奨名 |
|---|---|
| カスハラ実務パック | `就業規則AI カスハラ実務パック` |
| 記録台帳（既存向け） | `就業規則AI 記録台帳（既存契約）` |
| Entry / Standard / 士業（banto 席） | すでに就業規則AIなら維持。旧名なら `就業規則AI Entry` 等へ |

3. Payment Link / Checkout のプレビューで表示名を目視  
4. 変更後、テストまたは少額確認は任意（名前変更だけなら決済不要）

パック Price ID（参考）: `price_1TyiXYJzuwrOe7d1UMBVIrru` / Payment Link `https://buy.stripe.com/6oUeVebWw1tQ04BfZ59MY0j`

---

## 5.（任意だが推奨）メール転送 `contact@` → `support@`

**なぜ**: 公開HTMLの窓口は `support@banto-roumu.com` に揃済み。旧アドレスへ来るメールを落とさない。

### 手順（ドメインのメールホストによる）

1. `sharoushi-agent.com` / `banto-roumu.com` の DNS・メール管理（Google Workspace / レジストラ等）を開く  
2. `contact@sharoushi-agent.com`（および旧 contact）を  
   **転送先 `support@banto-roumu.com`** に設定  
3. テスト: contact@ に自分から1通送り、support@ で受信すること

---

## 6.（任意）パック Payment Link の成功URL

**現状**: 成功後は Agent の pack-access（Word）→ ページ内で `/zure` と `/invite` 案内。

### 確認手順

1. Stripe → Payment links → パック用 `plink_1TyiXZJzuwrOe7d1QJuNeP5Q`  
2. **After payment** / Confirmation が  
   `https://sharoushi-agent.com/kasuhara-pack-access.html?session_id={CHECKOUT_SESSION_ID}`  
   系であることを確認（既存のままなら変更不要）  
3. 変える場合のみ: 成功ページを壊さないよう、Word 用 access URL を残したままにする

---

## 7. 完了判定（Owner チェック）

全部終わったら次が全部 Yes:

| # | 確認 |
|---|---|
| A | Supabase に `pack_invites` がある |
| B | パック購入（またはテスト）後、購入者メールに Free 案内が届く |
| C | 案内リンク `/invite` が 404 ではなく signup へ進む |
| D | 台帳の buy.stripe.com が新規購入できない |
| E | 領収書・Checkout の商品名が「就業規則AI …」 |
| F | （任意）contact@ が support@ に届く |

これで CHECKLIST の Owner 未チェック3項目＋転送が閉じる。

---

## 触らなくてよいもの

- `/zure` の家・HeroArtifact  
- ドメイン 301  
- リポジトリ合併  
- Agent のクリーム家の全面置換  
- パック Word 配信ロジック（Netlify）  
- BILLING_ENABLED 解禁（別決裁）  
- Dify DPA 署名（別カード `docs/ceo/cards/DIFY_DPA_SIGNING_RUNBOOK.md`）

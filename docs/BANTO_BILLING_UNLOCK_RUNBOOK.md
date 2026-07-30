# BANTO_BILLING_UNLOCK_RUNBOOK — 課金解禁 当日実行手順

作成: 2026-07-09 CTO（TOP10⑦）／実行日: **2026-08-05 Takeshi承認当日**（`docs/`＝memoly リポ。解禁条件は `~/Takeshi_Automation/docs/BANTO_BILLING_GATE.md`）

**所要時間合計: 約70分**（手順0〜7。うち Takeshi の手が要るのは 手順2の合言葉実行・手順5の実カード決済・手順6の文面承認の3点）

---

## 前提（当日より前に済ませておくこと）

| # | 項目 | 状態 |
|---|---|---|
| P1 | lifecycle E2E 全green（`node scripts/billing_lifecycle_e2e.mjs`） | ✅ 2026-07-09 mockモード 14/14 PASS |
| P2 | 解禁条件(a)(b)(c) 充足（BANTO_BILLING_GATE.md §1・review.py実測） | 8/5 判定 |
| P3 | Takeshi 承認（金銭系・自律境界1） | 8/5 |
| P4 | 【Takeshi必要作業】Stripe **テストAPIキー**（sk_test_）の取得・共有 | 未。ダッシュボード右上「テストモード」→開発者→APIキー。入手後 `node scripts/billing_lifecycle_e2e.mjs provision` でテストPrice作成→テスト環境で実Checkoutスモークまで済ませられる |
| P5 | 既知ギャップ: **Entry年額の checkout 未結線**（checkout API に月/年の interval 指定が無く、STRIPE_PRICE_STARTER_YEARLY を読む経路が無い） | 解禁は月額3プランで開始し、年額は解禁後の追撃で結線（推奨）。年額を初日から出すなら先に結線 |

---

## 手順0. 事前チェック（5分）

```bash
cd ~/memoly && git pull && npm run build        # ビルドクリーン確認
node scripts/billing_lifecycle_e2e.mjs           # 全green を当日再確認（出荷ゲート）
```

## 手順1. Stripe webhook エンドポイント作成（5分・初回のみ）

Stripe ダッシュボード（本番モード）→ 開発者 → Webhook → エンドポイント追加:

- URL: `https://banto-roumu.com/api/company/billing/webhook`
- 購読イベント（**5つとも必須**。特に invoice.* はコード実装済みだが購読漏れしやすい）:
  `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.payment_failed` / `invoice.payment_succeeded`
- 発行された署名シークレット `whsec_...` を控える（手順3で env へ）。

## 手順2. 本番 Price 作成（5分・Takeshi承認の宣言＝合言葉つき）

```bash
cd ~/memoly
STRIPE_SECRET_KEY=sk_live_...（本番キー） CONFIRM_LIVE=BANTO-UNLOCK \
  node scripts/billing_create_live_prices.mjs
```

- 金額は `lib/plans.ts`（SSOT・2026-06-29承認: Entry¥3,980/年¥39,800/Standard¥9,800/士業¥29,800）から自動で取る。
- 冪等: 既存の banto Product があれば再作成せず既存 Price を表示して終了。
- 出力された `STRIPE_PRICE_*` 3行を手順3で使う。

## 手順3. Vercel production env 設定（5分）

```bash
cd ~/memoly
for kv in \
  "STRIPE_SECRET_KEY=sk_live_..." \
  "STRIPE_WEBHOOK_SECRET=whsec_...（手順1の値）" \
  "STRIPE_PRICE_STARTER=price_...（手順2の出力）" \
  "STRIPE_PRICE_STANDARD=price_..." \
  "STRIPE_PRICE_SHIGYO=price_..." \
  "BILLING_ENABLED=true" ; do
  k=${kv%%=*}; v=${kv#*=}
  vercel env rm "$k" production -y 2>/dev/null; printf '%s' "$v" | vercel env add "$k" production
done
```

- 罠（project_billing_lifecycle_state）: env は set しただけでは効かない。**必ず手順4の再デプロイ**で反映する。masked表示は読み戻せないので、検証は手順5の実トランザクションで行う。

### 手順3b. 法定表示まわり（2026-07-30 法務監査#1・#2 で追加。Takeshi手番）

課金解禁と同じ日に、Stripe ダッシュボード側で3つ設定する。**どれも欠けたまま解禁すると
表示と実挙動が食い違う**（＝特商法・景表法上の不利益をこちらが被る）。

1. **規約URLの登録 → `STRIPE_TOS_CONSENT=true`**
   - ダッシュボード → 設定 → 「公開情報」/ Checkout の規約URLに
     `https://banto-roumu.com/terms` を登録する。
   - 登録し終えてから env に `STRIPE_TOS_CONSENT=true` を足して再デプロイすると、
     Checkout に「利用規約および特商法表記に同意します」のチェックが出る。
   - ⚠ **登録前に true にしてはいけない。** 規約URL未登録のまま
     `consent_collection.terms_of_service` を送ると **Checkout セッションの作成自体が
     失敗**し、全ユーザーが決済できなくなる（同社の別製品で実測済み）。
     この事故を避けるため既定はオフで、env でしか有効化できないようにしてある
     （`lib/stripe.ts` の `tosConsentEnabled()`）。
   - なお自動更新・総額・解約・返金・インボイスの表示（`custom_text.submit`）は
     ダッシュボード設定に依存しないので、この env と無関係に常時出る。

2. **カスタマーポータルのフロー設定（自己解約の導線）**
   - ダッシュボード → 設定 → Billing → カスタマーポータル で以下にする。
     - サブスクリプションのキャンセル: **許可する／請求期間の末日で解約**
       （at end of billing period）
     - 未使用期間の**プロレーション返金は行わない**
   - ⚠ 既定の「即時キャンセル」のままだと、`/tokushoho` の
     「請求期間の末日までご利用いただけます」と実挙動が食い違い、そのまま虚偽表示になる。
   - この設定を保存すると `/api/company/billing/portal`（admin限定・POST `{companyId}`）が
     動くようになる。動くようになったら `/tokushoho` の解約欄を
     「請求日の7日前までにご連絡ください」から「管理画面からご自身で解約できます」へ
     書き換えること（暫定文言なので、ポータル開通後は不要になる）。

3. **送信者住所 `SENDER_POSTAL_ADDRESS`**（課金とは独立だが同時にやる）
   - 特定電子メール法は送信メールに**送信者の住所**の表示を求める。従来のフッタは
     「所在地：日本」で要件を満たしていなかった。
   - `vercel env add SENDER_POSTAL_ADDRESS production` に実在の住所を入れる。
     設定するまでは、住所を捏造せず「ご請求により遅滞なく開示します」の案内が出る
     （weekly-email / deadline-reminder / send-day2-reminder の3経路共通）。
   - `UNSUBSCRIBE_SECRET` は **2026-07-30 に設定済み**（production・48バイトのランダム値）。
     配信停止トークンの鍵が `SUPABASE_SERVICE_ROLE_KEY` の流用でなくなった。
     入れる順序に意味がある: 鍵を後から変えると、**それ以前に送ったメールの
     配信停止リンクが全部無効になる**（署名が合わなくなる）。トークン付きメールが
     1通も出ていないうちに入れる必要があり、最初の対象は deadline-reminder の
     毎日 08:00 JST。ここに間に合わせるため、機能の初回デプロイ当日に入れてある。
     以後この値は**ローテーションしない**（するなら、それ以前の停止リンクが死ぬことを
     承知のうえで、直後に全購読者へ新しいリンクを送り直すこと）。

## 手順4. デプロイ（5分）

```bash
cd ~/memoly && vercel --prod
```

デプロイ後の疎通（課金ゲートが開いたことの機械確認）:

```bash
# BILLING_ENABLED 反映前は 503(BILLING_DISABLED)。反映後は 401(未ログイン)になれば開通。
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://banto-roumu.com/api/company/billing/checkout
```

## 手順5. 本番スモーク＝実カード検証（15分・Takeshi実カード）

1. banto-roumu.com にテスト用会社の admin でログイン → `/company/billing` → **Entry 月額**を選択 → Stripe Checkout へ遷移することを確認。
2. Takeshi の実カードで ¥3,980 を決済（自腹スモーク。100%OFFプロモコード方式も可＝`allow_promotion_codes` 実装済みだが、**カード認証〜請求の全経路**を見るため初回は実額を推奨）。
3. 確認（3点で green）:
   - Supabase: `select plan, seats_purchased, status, stripe_subscription_id from companies where id='<会社ID>'` → `starter / active`
   - Stripe ダッシュボード: サブスクリプション active・webhook 配信ログ 200
   - Plausible: `subscription_started`（props.plan=starter）発火
4. スモーク解約: Stripe ダッシュボードからサブスクを即時キャンセル → companies.plan が `free` / status `canceled` に落ちることを確認（＝剥奪経路の本番実証）。必要なら返金処理。

## 手順6. モニター出口通知（15分・文面はTakeshi承認必須）

`~/Takeshi_Automation/docs/BANTO_MONITOR_EXIT.md` §2 の要件で通知文を作成して送付:

- 選択肢3並記: (1) **Entry 50%永続割**（月¥1,990/年¥19,900・比較対象は実売価格¥3,980のみ） (2) 無料閲覧モード移行 (3) エクスポートして退会。
- 「支払手段を登録しない限り課金は発生しません（何もしなければ課金されません）」を明記。
- 「永続」は条件付き（サービス提供継続・同一アカウント）と明記。§3 チェックリスト全問YESで通す。
- **14日ルール**: モニター社の課金開始（=モニター終了日）は通知から14日以上後。8/5送付なら **モニター終了は最短8/19**。新規顧客への課金は8/5から即開始でよい（この2つの日付を混同しない）。

## 手順7. 計測確認（10分）

- Plausible（sharoushi共有サイト・hostname=banto-roumu.com）: `subscription_started` / `churned` がイベントに現れること（手順5で1件発火済みのはず）。
- 週次 review.py の番頭ファネルに課金指標が乗ることを確認（`fetch_banto_cohort()` は登録/activation。課金は `companies.plan` 分布: `select plan, count(*) from companies group by plan`）。
- `company_billing_events` に手順5のイベント（checkout.session.completed 〜 subscription.deleted）が記録されていること＝監査ログ稼働。

## ロールバック（1コマンド）

```bash
printf 'false' | vercel env add BILLING_ENABLED production --force && vercel --prod
```

checkout が 503(BILLING_DISABLED) に戻り、新規課金は止まる。既存サブスクは webhook が引き続き状態同期する（付与済み権利は壊さない）。

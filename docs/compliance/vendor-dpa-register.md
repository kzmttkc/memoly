# 委託先 DPA / SCC 台帳（番頭 banto-roumu.com）

> **公開しない内部文書。** `/privacy` の「外国にある第三者への提供（越境移転）について」(3) で
> 「契約上の定めの有無と内容を確認し、確認日とともに記録しています」と書いている、その記録の実体。
> この台帳が無いと当該記述は裏付けを持たない。
>
> 最終確認日: **2026-08-12** / 次回確認予定: **2027-08-12**（年1回・ポリシー記載の頻度）

## なぜこれが要るか

個人情報保護法の「基準適合体制」ルートは、移転先が相当措置を継続的に講ずる体制にあることの確認と、
**その継続的な実施の確保**（定期確認・支障時の対応）を求める。実務上は年1回程度の定期確認と
その記録が想定され、記録が無ければ履行を証明できない。GDPR 上も SCC 締結の書面証跡が求められる。

2026-08-12 の法務レビューで、`/privacy` と `/terms` が「確認したうえで利用しています」と
書いているのに、確認の記録がリポジトリに1件も存在しないことが判明した（grep でヒットしたのは
公開文言の2ファイルのみ）。本台帳はその是正。

## 一覧（2026-08-12 一次情報で確認）

| 事業者 | 法人格・所在国 | DPA本文 | 締結形態 | SCC | 締結状況 |
|---|---|---|---|---|---|
| Anthropic | Anthropic, PBC（米国・デラウェア） | https://www.anthropic.com/legal/data-processing-addendum | 規約に自動組込み | Yes | **有効** |
| OpenAI | OpenAI OpCo, LLC（米国・デラウェア） | https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf （v.010126） | 規約に自動組込み（署名版フォームは任意） | Yes | **有効** |
| Dify | LangGenius, Inc.（米国・デラウェア File No. 7358523） | https://dify.ai/assets/legal/data-protection-agreement.pdf | **別途署名・メール送付が必要** | Yes | **未締結（要対応）** |
| Supabase | Supabase, Inc.（米国） | https://supabase.com/legal/dpa （Version 1・2026-08-01） | 規約に自動組込み | Yes | **有効** |
| Vercel | Vercel Inc.（米国・カリフォルニア） | https://vercel.com/legal/dpa | 規約に自動組込み**だが Enterprise / Pro プラン限定** | Yes | **未適用の疑い（要対応）**／番頭は team `gokaku` = **Hobby（無料）** |
| Resend | Plus Five Five, Inc.（米国） | https://resend.com/legal/dpa | 規約に自動組込み（署名済版はダッシュボードで取得可） | Yes | **有効** |
| Stripe | Stripe, Inc.（米国・デラウェア） | https://stripe.com/legal/dpa （2025-11-18版） | 規約に自動組込み | Yes（https://stripe.com/legal/data-transfers-addendum 側） | **有効** |
| Slack | Slack Technologies, LLC（Salesforce・米国・デラウェア） | https://slack.com/terms-of-service/data-processing | 別途署名が必要（**ただし下記のとおり番頭は締結主体ではない**） | Yes | **対象外**（再委託先ではなく顧客指定の送信先） |
| Plausible | Plausible Insights OÜ（**エストニア・EU**） | https://plausible.io/dpa （2026-03版） | 規約に自動組込み（署名不要と明記） | 無し | **有効**（EU域内完結のため SCC は構造上不要） |

### 引用（原文・確認の根拠）

- Anthropic: "which is incorporated into these Terms by reference." / SCC: "hereby incorporated by reference and will be deemed to have been executed"
- OpenAI: "supplements, and is incorporated into, the OpenAI Services Agreement"
- Dify: "Customer must complete and sign … and send the complete Addendum to Company by email to privacy@dify.ai"
- Supabase: "acceptance of the Agreement shall have the same effect as signing the SCCs"
- Vercel: "This Addendum applies … for Customers who are on Enterprise and Pro plans."
- Resend: "the parties are deemed to have signed the EU SCCs"
- Stripe: "This Data Processing Agreement ("DPA") is subject to and forms part of the Agreement"
- Plausible: "Use of the service constitutes acceptance of this DPA. No separate signature is required."

## 送信するデータの種類（コード実測）

| 事業者 | 呼び出し箇所 | 送るもの |
|---|---|---|
| Anthropic | `next.config.ts` CSP `api.anthropic.com`、チャット／文書API | 相談内容・会社プロファイル・記憶 |
| OpenAI | 記憶のベクトル化 | 記憶の要約テキスト |
| Dify | `lib/dify.ts`（`https://api.dify.ai/v1/chat-messages`）← `app/api/company/chat`・`document/generate`・`document/review` | 法令に関する質問テキスト |
| Supabase | DB・認証 | 全保存データ |
| Vercel | ホスティング | リクエスト全般 |
| Resend | メール送信 | 会社の状況の要約を含む本文 |
| Stripe | 決済 | 決済情報（相談内容は送信しない） |
| Slack | `lib/slack.ts` ← `weekly-email`・`deadline-reminder`・`integrations`・`billing/past-due-sweep` | 会社名＋労務の要点の要約 |
| Plausible | 解析 | 匿名統計（Cookie不使用・個人を特定しない） |

## 見送り（Takeshi 裁定・2026-08-12。詳細は `.company/decisions/2026-08.md` 08-12）

### 1. Dify の DPA が未締結

9社中ここだけ、手続をしなければ DPA が発効しない。`https://dify.ai/assets/legal/data-protection-agreement.pdf` の
Exhibit B（data exporter 欄）に記入・署名し `privacy@dify.ai` へ送付すれば発効する
（"Upon receipt of the validly completed Addendum … this DPA will become legally binding."）。
**記入済みPDFを用意しTakeshiへ提示したが、対応不要と裁定。** 未締結のまま据え置く。

### 2. Vercel の DPA がプラン条件を満たしていない疑い

Vercel の DPA は適用対象を "Enterprise and Pro plans" に限定している。番頭のホスティングは
Vercel チーム `gokaku`（`team_VKQ7PD4HfY6FO09VktnrXgBA`）配下で、`ASSET_REGISTRY.md` の
2026-07-23 実測では **Hobby（無料）**。Hobby では自動組込みが効かない可能性がある。
Vercel サポートAIへの照会では「書面確認が要るなら `privacy@vercel.com` へ直接メールを」との回答。
**照会文面を用意しTakeshiへ提示したが、対応不要と裁定。** Vercel Pro移行・照会とも保留。
Vercel は全リクエストが通過する経路であり、影響範囲は Dify より大きい点は変わらないため、
企業顧客の商談が動くなど状況が変われば再検討する。

### 3. Slack は番頭の再委託先ではない（対応不要・記録のため）

番頭は顧客が設定した Incoming Webhook URL へ POST するだけで、Slack ワークスペースの契約主体・
管理者は顧客企業。Salesforce の DPA は「SFDC と Customer 間の Main Services Agreement の一部」で
あり、番頭はその Customer ではない。したがって番頭と Salesforce の間に DPA は原則不要。
ただし「顧客が指定した送信先」としての開示は必要で、これは `/privacy` §3・`/terms` 5.3 に記載済み。
Webhook URL の秘匿扱いは `/security` に記載済み（画面への再表示・エクスポート対象外）。

## 更新の作法

- 再委託先を追加・変更したら、この表と `/privacy` §3・§4(1)・`/terms` 5.3・`/security` §8 を**同時に**更新する
- 年1回の確認時は、各 DPA の版数・URL の生死・締結状況を見直し、最終確認日を更新する
- 締結状況が「有効」でないものが残っている間は、`/privacy` §4(3) にその旨が書かれていることを確認する
  （書いていない状態にしない。2026-08-12 に「確認したうえで利用しています」と断定していて実態と
  食い違っていたのが、この台帳を作る直接のきっかけ）

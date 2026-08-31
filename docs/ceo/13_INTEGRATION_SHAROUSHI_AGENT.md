# 就業規則AI × sharoushi-agent 統合方針

**発効**: 2026-08-29  
**型**: **1ブランド・1会計・2役**（コード合併は後回し）  
**買収説明文（到達条件）**:

> 就業規則AIは、中小の就業規則ファイルを1枚にするSaaSである。sharoushi-agent.com は同じ事業の集客面で、2026年10月のカスハラ義務化に対する書式と解説を置く。番頭・Kabau は旧称である。

## 捨てる案

- 今すぐコードを一つにする（10/1に間に合わない・要配慮情報混入リスク）
- 全部を sharoushi-agent.com に寄せる（静的ではSaaS不可・代理人に読める）
- 2ブランド並立のまま機能連携だけ足す
- 番頭 / Banto / Kabau への回帰
- Agentを社労士マッチングにする

## 採る型

| 層 | 値 |
|---|---|
| 顧客から見える名前 | 就業規則AI |
| 契約と会計の主体 | KIZUNA Creation（のち株式会社） |
| 問い合わせ | support@banto-roumu.com（一本） |
| SaaS（覚える側） | 当面 banto-roumu.com |
| 集客（取ってくる側） | 当面 sharoushi-agent.com |
| 内部コード名 | banto |

## 商品

**残す**: ずれ1枚→記憶→相談→社労士メモ（月額）／カスハラ実務パック 19,800／無料ツールは片ドメインへ寄せる  
**畳む**: 記録台帳 1,980円/月の**新規獲得**（既存契約はポータルで解約可）。端末内無料記録は残す  
**横置き**: インボイスキット（核の説明に出さない）  
**禁止**: 同じ「就業規則AI」で、登録不要Dify相談と月額SaaSを並記したまま主製品にすること

## 10月までの導線

```
検索 → Agent解説/足りない措置ボード
         ├─ ファイルを置く → banto-roumu.com/zure
         ├─ 書式が要る → パック 19,800
         └─ 残して相談 → 登録（月額）
```

パック購入完了の次は /zure。Agentトップの主CTAは相談AIではない。

## 実装順

1. **今週（済）**: 規約・特商法・問い合わせ統一、旧称は /about へ、AgentトップCTA、台帳新規停止、紙地LP  
2. **10/1まで（進行中）**: パック→zure、台帳の新規訴求を公開面から畳む、計測UTMを `sharoushi_agent` 系列へ、ツール重複の末尾CTAをzureへ  
3. **その後**: 301、Dify置換、コード合併、新ドメインは掲載後

## 進捗メモ（2026-08-30）

- 公開面の「姉妹サービス」表記をやめ、集客面／SaaS面の一本化コピーへ置換  
- `contact@sharoushi-agent.com` を公開HTMLから `support@banto-roumu.com` へ置換（転送はOwner）  
- 台帳1,980は価格・特商法に残しつつ「新規受付停止」を明示。主CTAはファイル置き  
- success.html / pack-access.js の次手は `/zure`  
- **one-product**: 契約第1文統一・SKU3系統・Agentヒーロー主CTA一本・パック→Free招待 webhook（`one-product/`）

## Owner作業（コード外）

- [x] Stripe商品名を「就業規則AI …」に揃える（パック改名・2026-08-31）  
- [x] 台帳 Price をアーカイブ（新規 Payment Link 無効・2026-08-31）  
- [ ] Payment Link 成功URLを pack-access → 次画面 zure 誘導に寄せる（可能なら・任意）  
- [ ] contact@ を support@ へ転送（任意）  
- [x] Supabase に `supabase/pack_invites.sql` を適用（2026-08-31 Owner完了）  
- [x] Resend（DIGEST_FROM_EMAIL）がパック招待で使えることを確認（2026-08-31・Vercel Production に RESEND_API_KEY / DIGEST_FROM_EMAIL あり）

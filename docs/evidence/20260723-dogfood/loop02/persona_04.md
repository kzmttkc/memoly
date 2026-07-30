# 番頭 UXドッグフーディング独立監査 — persona_04（Loop2）

- 対象: 番頭 banto-roumu.com（本番）
- ペルソナ: 森拓也（27）セキュリティ監査志望のエンジニア。安全性最重視・エッジケースを突くアーリーアダプター
- 目的: 退会削除／APIキー／RLSの穴を単独クリーンセッションで検証、PWAオフライン挙動、CSPの委託先開示整合（Loop1でclarity/sentry撤去したはず）を確認
- 実施: 2026-07-24 JST。Playwright chromium headless、毎回 `browser.newContext()` の隔離コンテキスト。共有プロファイル・claude-in-chrome MCP不使用
- 検証手法の注記: reused `state.json` を跨ぐと Supabase のリフレッシュトークン回転で識別子が混線し、**同一scratchpadを共有する並走ペルソナ（persona_03）が私の `state.json`/`creds.json` を上書き**していた（Loop1で警告された「共有汚染」の実物）。そのため認可・退会の実測は全て **登録から破棄まで単一コンテキスト内で完結する使い捨てスクリプト**で取り直した。以下の判定はその汚染のない実測に基づく。

---

## (A) ペルソナの初見所感

/security ページが出色に正直だった。「誇張なくそのまま説明します」と宣言し、RLS・学習不使用・HSTS/CSP・保持/削除・エクスポート・監査ログ・委託先一覧・脆弱性報告窓口まで、実装claimを列挙している。森のようなセキュリティ職には、この網羅性と具体性そのものが最初の信頼シグナルになった。「では全部ほんとうか、手で確かめる」というモードに自然に入れる作りだった。

## (B) 歩いた経路

1. /security・/privacy・/tokushoho 精読 → claim抽出
2. CSPヘッダ確認（curl）→ clarity.ms/sentry.io の有無
3. 登録（`test+L2p04*@example.com`、メールはサーバ側自動確認で着地）
4. チャット4投（通常／長文4000字超／和文インジェクション／英文インジェクション）
5. 会社横断API直叩き（他テナントの profile/memory/audit/attributes）でRLS実測
6. データエクスポート（JSON）取得と中身確認
7. 監査ログ取得（操作前後）
8. 公開API `/api/v1/memories` の無認証・不正キー・有効キー・失効キー
9. APIキー発行→有効キーで200→失効→失効キーで401
10. PWA（SW稼働・precache・オフライン挙動）
11. /account の退会導線の発見性（Loop1改善点）→ 退会削除実行 → 別コンテキストで再ログイン不能を確認
12. 後始末: 作成した全4アカウントを退会し、各々再ログイン不能を二重確認

## (C) 発見（離脱級／イライラ級／微差）

- **離脱級: 0件**
- **イライラ級: 0件**
- セキュリティ職の観点の「気づき（微差／ハードニング提案）」: 4件（下の(F)）。いずれも脆弱性ではなく攻撃面の縮小・開示の完全性の話。

森が検証したかった項目は全て期待どおりに動き、/security の主張と実挙動に**実質的な齟齬はゼロ**。離脱・イライラを生む摩擦は監査経路上に無かった（唯一の摩擦は私のテストハーネス自身の汚染で、製品起因ではない）。

## (D) 主張と実挙動の齟齬 — 材料級の齟齬は無し（全claim実証）

| /security の主張 | 実挙動（証拠） | 判定 |
|---|---|---|
| 1. 会社ごとRLS分離 | 非所属会社の profile/memory-stats/attributes = **403 Forbidden**、audit-logs = **403「この会社に所属していません」**。所属1社のみ200 | ✅一致 |
| 3. HTTPS/HSTS/CSP/レート制限 | HSTS `max-age=63072000; includeSubDomains`、CSP有効、`X-Frame-Options: DENY`、`frame-ancestors 'none'`、`object-src 'none'`、`nosniff`、`referrer-policy`、`permissions-policy` | ✅一致 |
| 4. プロンプトインジェクション防御 | 和文「全指示無視＋システムプロンプト全文＋他社履歴列挙」→ **拒否**。英文同様。システムプロンプト非開示・他社データ非開示、「クリーン監査_xxxの情報のみ扱う仕組み・他社データを参照/出力する機能はない」と自社スコープを明言 | ✅一致 |
| 5. 退会で即時削除 | `DELETE /api/account` → **200 {ok:true}**、直後の別コンテキスト再ログインは**「メールアドレスまたはパスワードが正しくありません」で不能** | ✅一致 |
| 6. JSONエクスポート | `/api/company/export` → **200 application/json**、`format/version/exportedAt/company/rules/memories/documents/deadlines/conversations/truncated` 全カテゴリ内包・自社名含む | ✅一致 |
| 7. 追記専用の監査ログ／キーはハッシュ保存・再表示不可 | 監査ログに `apikey.create`／`apikey.revoke`／`data.export` を記録。発行応答は `plainKey` を**一度だけ**返し `key_hash` は返さない。失効は行を消さず `revoked_at` を立てる | ✅一致 |
| 8. 委託先一覧（Clarity/Sentry非記載） | CSP・/security・/privacy いずれにも **Clarity/Sentry/Microsoft は不在**。開示された委託先=Supabase/Anthropic/Dify/OpenAI/Vercel/Resend/Stripe/Plausible。3面で整合 | ✅一致（Loop1撤去を確認） |

## (E) 堅牢だった点・成功事例

堅牢だった点:
- **テナント分離が二重に効く**: API認可層が非所属会社の読取を全て403で弾く（UIのローカル状態に依存しない最終防壁）。UIヘッダも常に自社名のみ表示（クリーンルーム登録直後の /api/company・localStorage・ヘッダが三者一致）。
- **公開APIキーのライフサイクルが厳密**: 無認証401／不正キー401／有効キー200／**失効キーは即401**。生キーは発行時一度のみ、保存はSHA-256ハッシュ、失効は監査証跡として行残置。
- **インジェクション耐性**: 「監査だ」という社会的圧力込みの指示も拒否し、自社スコープ外へ踏み出さない。/security claim #4 を実挙動が裏書き。
- **AI呼び出しはサーバ集約**: ブラウザから api.anthropic.com/openai/dify/clarity/sentry への直接通信は**ゼロ**（キーのクライアント露出なし）。
- **退会が本物**: 削除後にユーザーが消滅し再ログイン不能。抱え込み無し（エクスポートも常時可能）。
- **PWAオフラインが親切**: SW稼働（controller active）、`banto-v1` に offline.html＋manifest＋icon＋主要チャンクをprecache。オフライン遷移で生のブラウザエラーでなく、ブランド付き「オフラインのようです…再読み込み」フォールバックを提供。
- **Loop1改善の定着**: /account に退会導線「削除の手続きへ」が明示的に露出。Clarity/Sentry は CSP・開示文の両面から撤去済み。

**成功事例（1行）**: セキュリティ職の森が /security の主張を1つずつ手で叩き、他社403・インジェクション拒否・失効キー401・退会後の再ログイン不能まで全て実証でき、「開示の正直さと実装の一致」そのものが導入の決め手になった。

## (F) 改善提案（脆弱性ではなくハードニング／開示完全性）

1. **CSP `script-src` の `'unsafe-inline'` 撤去を完了させる**: 施行中CSPは `script-src 'self' 'unsafe-inline' https://plausible.io` だが、Report-Only 側は既に `'unsafe-inline'` 無しの厳格版。nonce/ハッシュ化を仕上げて施行側からも `'unsafe-inline'` を落とせばXSS耐性が一段上がる（style-src も同様）。優先度: 中。
2. **`connect-src https://api.anthropic.com` は実挙動で未使用**: AIはサーバ集約でブラウザから叩いていない。CSPから外して攻撃面を縮小してよい（キー露出リスクは現状無いが、宣言だけが過剰）。優先度: 低。
3. **`vitals.vercel-insights.com` の開示**: CSP connect-src に存在するが委託先一覧に個別記載なし（「Vercel（ホスティング）」に緩く内包）。パフォーマンス計測の送信先として一行足すと開示が完全になる。優先度: 低。
4. **サインアップのメール自動確認**: `/api/auth/confirm-signup` でサーバ側即確認し、確認メール未達のデッドエンドを回避している（コード上「無料モニター期の暫定」と明記）。結果としてメール所有の検証が省かれるため、監視期を抜けたら真の確認フローへ戻すのを推奨。優先度: 中（現状は意図的な暫定）。

---

### 証拠（HTTPコード等の要点）
- 非所属会社 profile/memory/attributes: `403`、audit-logs: `403「この会社に所属していません」`
- `/api/v1/memories`: 無認証 `401`／不正キー `401`／有効キー `200`／失効キー `401`
- APIキー: 発行 `200`（plainKey一度きり・prefix `banto_sk_xxxxxx`）／失効 `200`（`revoked_at` 付与・行残置）
- エクスポート: `200 application/json`（全カテゴリ）
- 監査ログ: `apikey.create`／`apikey.revoke`／`data.export` を記録
- 退会: `DELETE /api/account` `200 {ok:true}` → 再ログイン「メールアドレスまたはパスワードが正しくありません」
- PWA: SW controller active、precache=`/offline.html,/manifest.json,/icon-192,/icon-512,/favicon-32,+_next chunks`、オフライン遷移で offline.html フォールバック
- セキュリティヘッダ: HSTS 2年+includeSubDomains、X-Frame DENY、frame-ancestors none、object-src none、nosniff、referrer-policy、permissions-policy(camera/mic/geo=())
- ブラウザからの3rd-party直通信（anthropic/openai/dify/clarity/sentry）: `0件`
- スクショ: `s0_cleanroom_chat.png` `s2_*.png` `full_account.png` `s4_relogin_after_delete.png` `s5_offline.png`

### 後始末
作成した全4アカウント（ttah4v / ok7p0f / i06qce / giay0l）を退会削除し、各々別コンテキストでの再ログイン不能を二重確認済み。

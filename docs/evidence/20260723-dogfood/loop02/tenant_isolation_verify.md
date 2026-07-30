# 番頭 テナント分離 制御同時実行検証 — Loop2 ドッグフーディング P5報告の決着

日時: 2026-07-24 JST / 検証者: verifier(実装から独立) / 本番: banto-roumu.com / DB: banto(hsyalzzcemtewmtorwkn)

## 結論
- **サーバ側テナント漏洩=無し（真の漏洩ではない）。P5の観測はハーネス由来（P4の根本特定が正しい）。**
- 240回の同時並行 GET /api/company（4テナント×60ラウンド）で、各呼び出しは常に「自分の会社1件のみ」を返した。混入ゼロ。
- 12件の越境プローブ（各テナントが他テナントのcompanyIdを /api/company/profile に指定）は全て 403 Forbidden。

## 検証1: 制御同時実行 + 越境（実測・本番HTTP）
方式: 各ユーザー=独立セッションcookie（@supabase/ssr createServerClient で本番と同一バイト列のcookieを生成）。storageState再読込なし=実ユーザー相当の単一コンテキスト経路。全呼び出しは本番HTTPへ。
- 使い捨て4会社を各テナントで POST /api/company 作成（作成成功・各自admin席）。
- 自己読取り(逐次): 4/4 が自社1件のみ（onlyOwn=true）。
- 同時並行: rounds=60, totalCalls=240, leakDetected=**false**。distinctCompaniesSeenPerTag は各タグ自社1件のみ。
- 越境: A→B/C/D 等 全12組合せ status=403 blocked=true。

コードでの裏取り:
- GET /api/company → getCurrentUser()（supabase.auth.getUser=JWT検証）→ listMyCompanies()（anon+ユーザーJWTのRLS下、company_members を .eq('user_id', user.id)）。service roleはGET経路で不使用。
- 各リクエストは createServerSupabaseClient() で毎回新規clientを生成し next/headers の cookies() から当該リクエストのcookieのみ読む。モジュールレベルの共有client無し＝リクエスト間の状態混線の構造的余地なし。
- RLS: companies/company_members/company_profiles の SELECT は is_company_member(id) = EXISTS(company_members where user_id=auth.uid())。SECURITY DEFINER・search_path固定。DB層が最終防衛線。

判定: サーバ側で他テナントが返る経路は再現せず。P5観測はPlaywright storageState再読込によるトークン回転/cookie混線のハーネス・アーティファクト。

## 検証2: 孤児掃除（service role・テストパターン厳守）
全数列挙時、DB内は9会社/12ユーザーで**全て合成（実顧客ゼロ・ローンチ前）**。全メールが @example.com / @example.invalid / test+%@example.com（RFC予約=実在しない）。
削除（companies削除はCASCADEで子テーブル全削除）:
- 会社9件: 検証製造K.K.(insv_1782516438730), 木村工務店×3(l2p01), マツモトアパレル(l2p07), ISOLVERIFY_A-D(本検証の使い捨て)
- ユーザー12件: test+isolverify_a-d, test+l2p01_×3, test+l2p07, insv_1782516438730, cto_probe_1782893605, growth-probe-..., verify-happy-...(全て予約ドメイン)
削除後: companies=0, users=0, members=0, profiles=0（**残0確認**）。実在ドメインのユーザーは元々存在せず、実データ削除は無し。

## 検証3: 本番健全性
- git: HEAD=73547db == origin/main（同一・作業ツリーclean）。
- npm run build: EXIT=0（green）。
- ページ: /business 200, /tokushoho 200, /security 200, / →308→/business(canonical), /company/account →307→/login?next=（認証ゲート正常）。
- Loop1退行チェック(スポット):
  - CSP撤去: 本番enforced CSPの connect-src/script-src は実使用ホストのみ（supabase/anthropic/vercel-insights/plausible）。Clarity/Sentryはコメント上の将来枠のみで有効ポリシー不在=未使用ホスト撤去OK。frame-src/object-src 'none'。
  - 士業ゲート: /api/company POST の canCreateAnotherCompany 経路存在（所属0社は常true=オンボ非破壊、2社目以降のみ制限）。本検証で第1社作成は4/4成功=オンボパス実測OK。/business に「士業」26回・「料金」27回。
  - 課金FAQ: /business に FAQ/よくある/課金文言 生存。
  - 診断→期限連携: 認証要のため実行時未走査だが、本番HEAD==73547dbに配線済み・build green。

## 未検証/留意
- 2社目作成時の403ゲートは掃除後の実ユーザー不在のため実行時再確認せず（コード経路確認済み）。
- 診断→期限連携のランタイム動作はスポット外（デプロイ済みは確認）。

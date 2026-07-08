# BANTO_DAY0_SPEC — TOP10 #2「30秒アハ」× D2「Day0価値反転」統合設計仕様 v1.0

作成: 2026-07-08 CPO ／ 実装: W2-3 CTO ／ 上位文書: state/ROADMAP_TOP10_2026Q3.md（D2・A5）・docs/FUNNEL_EVENTS.md

## 0. 実測前提（2026-07-08 コード実測。ここが既に動いている＝壊さない）

- 現フロー: `/signup`（?next・?company プリフィル・utm帰属）→ `/company` 会社作成 → `/company/onboarding` 5問ウィザード → `/company/risk?from=onboarding` で自動診断（ボタン押下不要）。D2の背骨は稼働済み。
- 5問 = `lib/company-attributes.ts`（業種JSIC / 従業員バンド / 36協定 / 就業規則 / 固定残業。三値・決定的・集合知の素）。
- 診断 = `/api/company/risk-audit`（sonnet、失敗時は `lib/risk-fallback.ts` の決定的採点が必ず200を返す）。免責 `RISK_AUDIT_DISCLAIMER` はコード強制付与。`body.answers`（key/value配列）をプロンプトに合流できる口が既にある。
- 期限 = `lib/deadlines.ts` `suggestDeadlines()`（属性から決定的に候補生成・日付は断定しない）＋ `/api/company/deadlines?suggest=1`。ただし表示は `/company/deadlines` のみで Day0 導線に出ていない。
- ツール2本（yukyu-5nichi / 36kyotei-jougen）はクライアント完結計算。CTAは `/signup?next=/company&utm_source=banto_tool&utm_campaign=<tool>` で、結果値は捨てている（A5未実装）。
- LPデモ `TryDemo.tsx` = スクリプト型サンプル会社（製造業・8名・所定8h・36協定未締結）。アプリ内サンプル会社モードは存在しない。

## 1. スコープ（作るのは次の4点だけ。新規の法定判定ロジックは増やさない）

計算・判定は既存実装（risk-audit / risk-fallback / suggestDeadlines）の流用が第一。新規の法定数値・判定を足す場合は敵対的factcheck（一次情報照合）必須。計算精度は信用の生命線。

### S1. Day0結果画面 = 診断＋年間手続きカレンダーの合体（W2・本丸）
- `/company/risk` の診断結果の直下に「自社の年間手続きカレンダー」セクションを追加する。
- データは `GET /api/company/deadlines?companyId=&suggest=1` の既存候補（労働保険年度更新 / 算定基礎届 / 年末調整 / 36協定更新 / 定期健診 / ストレスチェック / 就業規則届出）を timingLabel の時期順に並べるだけ。新ロジック不要。
- 各行に「この期限を登録」ボタン（既存 `POST /api/company/deadlines` へ。日付はユーザーが確定＝Phase1の「日付を断定しない」を維持）。登録済みは非表示（suggest=1 が既に除外する）。
- セクション末尾に `/company/deadlines` への「すべての期限を管理」リンク。

### S2. オンボーディング項目（現5問＋会社名の6項目で確定。増やさない）
- 会社名（作成時）／業種／規模／36協定／就業規則／固定残業。この6つが診断6カテゴリとカレンダー候補の全分岐を賄う実測済み最小集合。項目追加は入力コスト増＝到達率60%目標に反するため、W2-3では追加しない（入社月等の追加は診断精度が上がる実証が出てから）。
- 文言変更1点: onboarding の説明文を「答えるとその場で、自社の労務リスク診断と年間手続きカレンダーが出ます」に更新（価値の先出し）。

### S3. サンプル会社モード（W2・#2の空チャット対策）
- 対象: onboarding を「あとで入力する」でスキップした人＋LP来訪者の温度上げ。空のホーム/チャットで放置しない。
- 実装: `/company/risk` に「サンプル会社で結果を見る」ボタン。クライアント側で `computeFallbackRiskAudit()` と `suggestDeadlines()`（どちらも純関数・LLM不要・API不要）に TryDemo と同一の固定属性（製造業 E / 5-9名 / 36協定なし / 就業規則あり / 固定残業なし）を渡して即時描画する。
- 必須明示: 結果カード上部に常時バナー「これは架空のサンプル会社（製造業・8名）の結果です」。シェア文コピーはサンプルでは無効化（架空の数字の拡散を防ぐ）。
- 切替導線: バナー内に主ボタン「自社の情報で診断する（1分・5問）」→ `/company/onboarding`。サンプル結果は保存しない（`company_risk_scores` に書かない・集合知を汚さない）。
- チャットの質問例は既存 UX-2（attributes連動サンプル4問）が実装済み＝流用。追加実装なし。

### S4. A5接続 = ツール結果プリフィル（W3）
- 各ツールの結果画面CTAを「この結果を自社の記録として保存（無料）」に変更し、URLに非PIIの結果パラメータを載せる（既存の ?company 持ち回りと同じ流儀で next に畳む）:
  `/signup?next=/company%3Ftr%3Dyukyu_5nichi%26trs%3D<status>%26trd%3D<YYYY-MM-DD>%26trn%3D<残日数>&utm_source=banto_tool&utm_campaign=<tool>`
- `/company` → onboarding → risk へ tr* を持ち回り、初回診断の `body.answers` に `[{key:'年5日有給の事前点検結果', value:'残り3日・期限2026-10-01'}]` の形で合流（既存の口・新API不要）。診断が「保存した結果」に言及する＝ツールの計算が初回価値になる。
- カレンダー側: tr に対応する期限候補（例「有給5日取得の期限」due_on=trd プリフィル）を S1 セクション先頭に1行追加。日付はツールでユーザー自身が入力した値の引き継ぎ＝断定にあたらない。登録はユーザーの確定ボタン。
- 値はすべて日数・日付・列挙statusのみ（PII・会社名は載せない）。不正値は無視して通常フローに落とす。
- 現状メモ（2026-07-09時点）: 「結果保存（無料）」CTA（A5）は残業代セルフ点検（zangyodai-check, commit 2dc1f0b）のみ実装済み。既存2ツール（36kyotei-jougen-check / yukyu-5nichi-check）は結果保存に未対応（signup直行のみ）。3ツール横展開するかは本W3の見積り時に判断待ち。

## 2. 計測（FUNNEL_EVENTS.md 整合。既存イベント流用が第一・新イベント最小）

| 段 | イベント（既存/新規） | 定義 |
|---|---|---|
| signup | `signup_completed`（既存） | 登録成立 |
| onboarding_completed | `company_activated`（既存・改名しない） | 5問保存成功 |
| first_diagnosis_viewed | `risk_audit_completed`（既存）＋新prop `source: onboarding\|manual\|sample` | 結果描画。sample は分母に入れない |
| 7日再訪 | `company_heartbeat`（既存）の `age_bucket: d4_7` | 別日再訪の既存計装を読むだけ |

- 北極星KPI: 登録→初回診断到達率 = risk_audit_completed(source=onboarding) ÷ signup_completed ≥ 60%。7日再訪率 = heartbeat d4_7 到達コホート比。
- 新規: `sample_company_viewed`（S3閲覧）と `signup_cta_clicked` の location=`sample_result`（サンプル→本登録転換）。hostname分離規律を維持し、出荷時に FUNNEL_EVENTS.md の番頭欄へ追記すること。

## 3. 誠実関所（出荷ゲート・1つでも違反はBLOCK）

- 「診断」は単独で使わず「セルフ診断（目安）」「セルフチェック」の系で表記。個別具体の法的判断・手続代行・書類作成代行を示唆しない（社労士の独占業務=1号2号業務に踏み込まない。一般的情報の提供に留める）。
- `RISK_AUDIT_DISCLAIMER`（「一般的な参考情報です。正確な診断は専門家にご確認ください。スコアはあくまで目安です」）のコード強制付与を全表示経路（サンプル含む）で維持。カレンダーは全行「〜の目安」表記・日付断定なし。
- 過大約束の禁止リスト: 「法的に問題ありません」「これで安心/完璧」「社労士は不要」「監修済み」「正確に診断」「違反を検出」。条件形（〜のおそれ/〜をご確認ください）のみ。Phase1休眠表記（社労士監修/AI社労士/法的精度）混入禁止。
- サンプル会社は全表示面で「架空」を明示。実在企業を想起させる固有名を使わない。

## 4. 見積りと分割（既存部品流用前提）

| 順 | 内容 | 規模 | 期日 |
|---|---|---|---|
| W2① 最小出荷 | S1 カレンダー合体＋S2 文言＋計測prop | 1.0日 | 7/18 |
| W2② | S3 サンプル会社モード | 1.0日 | 7/18 |
| W3 | S4 ツールプリフィル＋FUNNEL_EVENTS追記＋E2E（signup→診断→カレンダー登録を実ブラウザで通す） | 1.5日 | 7/25 |

最小スコープはW2①のみでも出荷可（診断＋カレンダーが揃った時点でD2の価値反転は成立）。出荷前に kizuna:pre-deploy / ship-review を通すこと。

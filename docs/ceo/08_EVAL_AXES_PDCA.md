# 評価3軸 PDCA（CEO必須）

**発効**: 2026-08-29  
**根拠**: 統合精密評価（総合3.1/5）— 勝てる形≠勝っている状態

## 3軸

| # | 軸 | 合格の目安 | 不合格の兆候 |
|---|---|---|---|
| 1 | **統合パワー** | オファー1文・閉ループ・計測が揃い、file/有料が動く | 導線は直したが戦果ゼロが続く |
| 2 | **競合凌駕** | 「ファイル→ずれ1枚」が第一想起候補として強まる | SmartHR全体比較・機能カタログ競争に逃げる |
| 3 | **LPトップ性** | 第一面=ブランド＋ジョブ＋信頼、勝ちコピー固定 | 長い説明・記憶SaaS語彙・証拠ゼロ |

## ループ

1. 仮説を1つ書く（例: 信頼行を足すと sheet_shown/着地 が上がる）  
2. 1変数だけ変える（PDCA正典）  
3. 実測（zure_landing, zure_sheet_shown source≠sample, banto_cta, signup）  
4. 3軸で採点（各1–5、小数1桁）  
5. 勝ち変種だけ焼き戻す。負けは戻す  

## 到達スコア（2026-08-29夜）

| 指標 | 値 | 注 |
|---|---|---|
| 商業込み総合 | **3.9 / 5** | 有料0・堀が薄いため天井。file増で次へ |
| 形（商業・堀以外） | **4.4 / 5** | 閉ループ焼き戻しで +0.2。目標4.5まであと一歩 |
| 目標 | **4.5** | file≥10 かつ 有料≥1 で商業込みも到達可能 |

## 今週のキュー（P0→P1）

- [x] `/zure` 第一面の信頼行（所要・形式・カード不要）— **1変数**
- [x] `/zure` ブランド級第一面＋蒸留（2026-08-29晚）
- [x] 規定例 mid CTA（本番済）— 週次CTRは `ceo_weekly_pdca` で監視
- [x] マニュアル mid CTA 前倒し・姉妹トップにファイル置きパス
- [x] signup 崖（submit / blocked_* 計測）＋ Google 強調
- [x] `/business` 第一面〜デモの短縮・記憶語彙削減・/offer導線
- [x] ヒーローA/B勝ちの確定（B焼き戻し・新規割当100%）
- [x] Dify DPA 決裁カード草案（〜9/15）
- [x] BILLING 決裁カード草案（提出は file ゲート後）
- [x] 自律PDCA発火（`scripts/ceo_weekly_pdca.mjs` + Cursor Automation / ローカルloop）
- [ ] 外部 file≥10（総合4.5の必須）
- [ ] 外部有料≥1（商業軸）— BILLINGはfile後のOwner決裁
- [x] Dify DPA Owner決裁 **A** · 署名送付は **TODO後回し（〜9/15）**

## 自律発火

- スクリプト: `node scripts/ceo_weekly_pdca.mjs`
- 手順正典: `docs/ceo/09_AUTONOMOUS_PDCA_AUTOMATION.md`
- Cursor Automation: 週次 cron（オーナーが Automations で有効化）
- セッション内: `/loop` または monitored shell の `AGENT_LOOP_TICK_ceo_pdca`

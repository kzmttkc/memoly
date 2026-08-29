# DPA / 預かり姿勢（P0方針メモ）

最終更新: 2026-08-29  
正典台帳: `docs/compliance/vendor-dpa-register.md`

## 現状ギャップ（買収DDレッドフラグ）

| ベンダー | 状態 | P0での扱い |
|---|---|---|
| Anthropic | 台帳上有効想定 | 維持 |
| OpenAI（embeddings） | 台帳上有効想定 | 維持 |
| Supabase | 台帳上有効想定 | 維持 |
| **Dify** | **Owner決裁 A（署名）· 送付前** | **2026-09-15までに送付・受領** |
| Vercel | Hobby で DPA 適用疑い | Pro 等への移行は有料1社後でも可 |

## Owner決裁（確定）

- **2026-08-29**: Dify は **A 署名**（カード `docs/ceo/cards/2026-09-15_DIFY_DPA.md`）  
- 2026-08-12 の「Dify対応不要」は本決裁で上書き  
- 署名手順: `docs/ceo/cards/DIFY_DPA_SIGNING_RUNBOOK.md`

## CEOの執行ルール

1. Ownerの送付完了まで、顧客向けに「DPA済み」と書かない。  
2. 送付が 9/15 を過ぎそうなら催促し、最悪 B（縮退）を再提案する。  
3. 顧客向け文言: 「入力は回答生成にのみ使用。第三者へ販売しない」を維持。  
4. `/zure` のファイル置きは継続。BILLING 解禁は file≥10 かつ本 DPA 送付後。

## Owner決裁が要るもの（残）

- ~~Dify との DPA 方針~~ → **A 確定。送付は Owner 実行待ち**  
- Vercel プラン変更（費用）— 有料1社後で可

# プロンプト — 欠落分布（サーバ側、本文を渡さない）

この処理は LLM を使わない。アプリが gap_sheets.blocks から集計する。

入力: company.industry, company.headcount_band, blocks[].id, blocks[].status, blocks[].priority
出力行: (industry, headcount_band, item_id, status, yyyymm)

個人情報・社名・本文・引用は列に持たない。
1社1規程バージョンにつき1回だけ upsert する。

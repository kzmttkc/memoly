# Design Spec — CEO Operating System + P0 Path

**Date**: 2026-08-28  
**Status**: Implemented in-repo (governance + /offer + scoreboard). Sister-repo CTA pending.  
**Owner approval**: Pending（憲章の明示承認）

## Problem

戦略（ニッチ#1・買収適格）はあったが、執行主体・北の星の日次計器・売り物境界の公開面が無く、実装が拡散していた。

## Solution

1. Owner / CEO RACI 憲章  
2. 要件・90日ロードマップ・プロンプト正典  
3. `/offer` 境界1枚  
4. `p0_scoreboard.mjs`  
5. Cursor always-apply CEO rule  

## Non-goals (P0)

- BILLING_ENABLED 解禁  
- ドメイン301・4回目の改名  
- 記憶UIの大規模改修  
- sharoushi HTML の全面リライト（二段CTAは仕様のみ本リポに残し、実装は姉妹）

## Acceptance

- [x] docs/ceo 一式  
- [x] scoreboard runs  
- [x] /offer page + footer + sitemap  
- [ ] Owner が憲章を承認した旨を decisions に残す  
- [ ] Production deploy of /offer  
- [ ] Plausible API or manual zure count in scoreboard JSON  

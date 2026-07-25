#!/bin/bash
# billing_e2e_cron.sh — 番頭 決済ライフサイクルE2E(billing_lifecycle_e2e.mjs)の日次定期実行。
#
# 背景(2026-07-26 Takeshi恒久要求):
#   success_url/cancel_urlの?二重連結バグ(subscription_started計測が構造的に非発火・
#   Stripe「戻る」導線で403)が、出荷ゲート用ハーネス(billing_lifecycle_e2e.mjs)は
#   存在するのに定期実行されておらず約1ヶ月本番でサイレント稼働していた。
#   このラッパーをcronから毎日呼ぶことで「作っただけ」を終わらせる。
#
# 安全性:
#   - node_modules/stripe への実書込みは行わない。webhook側はmock署名(実鍵不要)。
#   - Price実額/Checkout到達チェックはSTRIPE_SECRET_KEYがsk_test_の時のみ実行され、
#     読み取り(retrieve)と未完了セッション作成→即expireのみ。カード入力・決済は発生しない。
#   - 失敗時はFATALをログに残す→cron_watchdog.pyの既存ERROR_PATTERNS(\bFATAL\b)が
#     エラー死として検知し、state/ALERTS.mdへ記帳する（新規通知経路は作らない）。
#
# 使い方(crontab):
#   17 4 * * * /Users/takeshi/memoly/scripts/billing_e2e_cron.sh >> /Users/takeshi/memoly/logs/billing_e2e.log 2>&1
set -uo pipefail

# cronの最小PATHにはHomebrewのnode/npmが無いため明示的に足す(npm自体が
# `#!/usr/bin/env node` shebangでnodeを探すため、PATH無しだとnpm実行前に落ちる)。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ROOT="/Users/takeshi/memoly"
cd "$ROOT" || { echo "$(date '+%Y-%m-%d %H:%M:%S') FATAL: cd $ROOT 失敗"; exit 1; }

echo ""
echo "=== $(date '+%Y-%m-%d %H:%M:%S JST') billing_lifecycle_e2e 開始 ==="

npm run build
BUILD_STATUS=$?
if [ $BUILD_STATUS -ne 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') FATAL: npm run build 失敗(exit=$BUILD_STATUS)。決済E2Eを実行できません。"
  exit 1
fi

node scripts/billing_lifecycle_e2e.mjs
E2E_STATUS=$?
if [ $E2E_STATUS -ne 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') FATAL: billing_lifecycle_e2e.mjs FAILED(exit=$E2E_STATUS)。決済導線に回帰の疑いあり。"
  exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M:%S JST') billing_lifecycle_e2e 全経路green"
exit 0

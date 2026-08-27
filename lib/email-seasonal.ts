// ============================================================================
// email-seasonal.ts — 週次メールに載せる「時期性リマインド」（外部評価 E05）。
//   36協定（4/1更新の集中）・年5日有給（付与日から1年の締切）・カスハラ対応義務化
//   （改正労働施策総合推進法・2026年10月1日施行）を、該当する時期にだけ
//   週次メール（/api/company/weekly-email）へ1ブロック追記する。
//
//   設計:
//     - 純関数（現在日時 → ブロック配列）。LLM・DB・外部APIを一切呼ばない。
//       cron から毎週決定的に同じ判断ができ、テストも日付注入だけで済む。
//     - 会社ごとの個別事情（実際の36協定起算日・各従業員の有給付与日）は
//       サーバー側では分からないため、断定せず「確認を促す」文面に限定する
//       （Phase1コンプラ: 「〜のはずです」ではなく「〜の会社が多い時期です」）。
//     - 同時に出すのは最大2件（メールを長くしない）。
// ============================================================================

export interface SeasonalReminder {
  /** 見出し（メール内の小見出しとして使う）。 */
  title: string
  /** 本文（敬体・断定なし・確認を促すトーン）。 */
  body: string
  /** アプリ内の次アクション導線（BANTO_URL からの相対パス）。 */
  ctaPath: string
  ctaLabel: string
}

/** カスハラ対応義務化（改正労働施策総合推進法）の施行日。 */
const KASUHARA_ENFORCEMENT = '2026-10-01'

/** JSTの今日（YYYY-MM-DD）。cron は UTC で走るため必ず JST へ寄せてから月日判定する。 */
function jstToday(now: Date): { iso: string; month: number } {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const iso = jst.toISOString().slice(0, 10)
  return { iso, month: jst.getUTCMonth() + 1 }
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)
}

/**
 * いま出すべき時期性リマインドを返す（0〜2件）。
 *   - 1〜3月: 36協定の更新（4/1起算で協定している会社が多く、届出は起算日前が原則）。
 *   - 2〜3月 / 8〜9月: 年5日有給の取得期限の点検（4月・10月付与の会社で締切が近い時期）。
 *   - 施行90日前〜施行月: カスハラ対応義務化のカウントダウン（2026年のみ）。
 */
export function getSeasonalReminders(now: Date = new Date()): SeasonalReminder[] {
  const { iso, month } = jstToday(now)
  const out: SeasonalReminder[] = []

  // --- カスハラ対応義務化（施行前90日間＋施行月中は施行済みの案内） ---
  const daysToKasuhara = daysBetween(iso, KASUHARA_ENFORCEMENT)
  if (daysToKasuhara > 0 && daysToKasuhara <= 90) {
    out.push({
      title: `カスタマーハラスメント対策の義務化まで、あと${daysToKasuhara}日です`,
      body:
        '改正労働施策総合推進法により、2026年10月1日からカスハラ防止の措置が事業主の義務になります。' +
        '基本方針の明文化・相談窓口・対応手順の3点が済んでいるか、一度ご確認ください。',
      ctaPath: '/company/chat',
      ctaLabel: '自社に必要な対応を就業規則AIに相談する',
    })
  } else if (iso >= KASUHARA_ENFORCEMENT && iso <= '2026-10-31') {
    out.push({
      title: 'カスタマーハラスメント対策が義務になりました（2026年10月1日施行）',
      body:
        '基本方針・相談窓口・対応手順がまだ整っていない場合は、早めの整備をおすすめします。' +
        '何から着手すべきかは自社の状況により異なります。',
      ctaPath: '/company/chat',
      ctaLabel: '自社に必要な対応を就業規則AIに相談する',
    })
  }

  // --- 36協定の更新シーズン（1〜3月。4/1を起算日にしている会社が多い） ---
  if (month >= 1 && month <= 3) {
    out.push({
      title: '36協定の更新時期が近づいていませんか',
      body:
        '4月1日を起算日として36協定を結んでいる会社が多く、1〜3月は更新・届出の集中時期です。' +
        '協定の有効期間の満了日と、新しい協定の締結・労基署への届出の予定をご確認ください。',
      ctaPath: '/company/deadlines',
      ctaLabel: '期限として就業規則AIに覚えさせる',
    })
  }

  // --- 年5日有給の取得期限の点検（2〜3月・8〜9月。4月/10月付与の会社の締切前） ---
  if (out.length < 2 && (month === 2 || month === 3 || month === 8 || month === 9)) {
    out.push({
      title: '年5日の有給取得、期限が近い従業員はいませんか',
      body:
        '年10日以上付与した従業員には、付与日から1年以内に5日の取得が義務です。' +
        '4月や10月にまとめて付与している場合、この時期は取得日数が足りない従業員の最終確認のタイミングです。',
      ctaPath: '/company/chat',
      ctaLabel: '取り方の選択肢を就業規則AIに相談する',
    })
  }

  return out.slice(0, 2)
}

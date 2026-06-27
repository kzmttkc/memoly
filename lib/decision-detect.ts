// ============================================================================
// decision-detect.ts — 「判断/方針が下されたか」の軽量ヒューリスティック（LLM非依存）
// ----------------------------------------------------------------------------
//   TOP5 #1「イベント起点の判断採取」を、追加のLLM呼び出しなしで番頭側から能動提案する
//   ためのクライアント判定。チャットの直近往復に「自社としての方針・対応を決めた」気配が
//   あるときだけ、UIが「この方針を会社の記憶に残しますか？」を促す。
//   ★ここは“出すかどうか”の軽い判定。実際の構造化（topic/subject/decisionText）は
//     確定時にサーバの extractCompanyMemory（既存1パス）が行う。誤検知しても
//     ユーザーが「いいえ」で閉じられる＝human-in-the-loop なので安全側。
//
//   設計: 過度に出すと邪魔（通知疲れ）なので、
//     - ユーザー発話に「決定/方針」を示す語があるか、または
//     - 直近往復で「入退社・規程改定・更新」など“業務イベント”の語が出ているか
//   のときだけ true にする（=イベント起点）。
// ============================================================================

// 「自社として決めた/これでいく」を示すユーザー側の語。
const DECISION_CUES = [
  'にする', 'にした', 'で進める', 'で行く', 'でいく', 'と決め', '決めた', '決定',
  '方針', 'ことにする', 'ことにした', 'そうします', 'それでお願い', 'で確定',
  'を採用', '導入する', '導入した', '見直す', '変更する', '改定する',
]

// 業務イベント（=記憶を貯める好機）の語。入退社・更新・改定など。
const EVENT_CUES = [
  '入社', '退社', '退職', '採用', '異動', '昇給', '昇格',
  '36協定', '就業規則', '賃金規程', '規程', '規定', '改定', '更新', '改正対応',
  '育休', '育児休業', '介護休業', '産休', '時短', '固定残業', 'みなし残業',
  '有給', '残業', '労働時間', '雇用契約', '労働条件', '助成金',
]

export interface DecisionSignal {
  /** 判断/方針として記録を促してよいか。 */
  suggest: boolean
  /** 提案に添える短い理由ラベル（UIの一言用）。 */
  reason: string
}

/**
 * 直近の会話（user/assistant）から判断採取を促すべきか判定する。
 *   - 最後のユーザー発話 + 直近assistant応答を対象にする（その場の流れで判断する）。
 *   - 決定キュー or（イベントキュー & ある程度のやり取り）で suggest=true。
 */
export function detectDecisionSignal(
  messages: { role: string; content: string }[],
): DecisionSignal {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
  // 直近2〜3メッセージを束ねてイベント語を拾う（流れの中の業務イベント）。
  const recent = messages.slice(-4).map(m => m.content).join('\n')

  const hasDecisionCue = DECISION_CUES.some(c => lastUser.includes(c))
  const hasEventCue = EVENT_CUES.some(c => recent.includes(c))
  const enoughTurns = messages.filter(m => m.role === 'user').length >= 1

  if (hasDecisionCue) {
    return { suggest: true, reason: '自社としての方針が決まったようです' }
  }
  // イベントの話題が出ていて、ある程度やり取りがあるなら控えめに促す。
  if (hasEventCue && enoughTurns) {
    return { suggest: true, reason: '今後のために記録しておけます' }
  }
  return { suggest: false, reason: '' }
}

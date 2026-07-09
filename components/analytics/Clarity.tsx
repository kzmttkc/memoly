import Script from 'next/script'

// ============================================================================
// Clarity — Microsoft Clarity セッションリプレイ/ヒートマップ（env-gate方式・P1）
// ----------------------------------------------------------------------------
//   NEXT_PUBLIC_CLARITY_ID が無ければ何も描画しない（完全 no-op）。
//   インライン snippet は使わず、タグ本体を直接 src ロードして CSP適合
//   （script-src の 'unsafe-inline' に依存しない）。CSP許可ホストは next.config に登録済。
//   無料: Clarity は完全無料・トラフィック上限なし。ID取得手順は runbook 参照。
// ============================================================================
export function Clarity() {
  const id = process.env.NEXT_PUBLIC_CLARITY_ID
  if (!id) return null
  return (
    <Script
      id="ms-clarity"
      src={`https://www.clarity.ms/tag/${id}`}
      strategy="afterInteractive"
    />
  )
}

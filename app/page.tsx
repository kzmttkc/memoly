import { permanentRedirect } from 'next/navigation'

// ============================================================================
// ルート / — 獲得の顔は /zure（就業規則のファイル → ずれ1枚）。
//   /business は製品説明の降格面。308で正規URLを /zure にする。
// ============================================================================

export default function Home() {
  permanentRedirect('/zure')
}

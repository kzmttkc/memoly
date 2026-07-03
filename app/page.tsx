import { permanentRedirect } from 'next/navigation'

// ============================================================================
// ルート / — アプリの「顔」は番頭(Banto) に統一する。
//   消費者Memoly のランディングは廃し、番頭の公開LP(/business) へ転送する。
//   消費者版の /chat /memory は直URLで引き続き動作するが、ここからは促進しない。
//   308恒久リダイレクト＝正規URLを /business にクローラへ明示（SEO・番頭を顔にする確定方針）。
// ============================================================================

export default function Home() {
  permanentRedirect('/business')
}

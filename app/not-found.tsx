import { NotFoundState } from '@/components/ui/NotFoundState'

// ルート 404（どのセグメントにも該当しない未マッチURL）。ルートレイアウトは消費者向け
// ダーク基調のため、就業規則AIの白基調カードが読めるよう company-light + 白背景でラップする。
//
// 2026-07-30 UX監査 #2（重大）: 出口が「トップへ戻る」1本だけの行き止まりだった。
//   実測で 404 に落ちる典型URL（/pricing /plans /price /ryokin）は「料金を知りたい」
//   来訪者なので、料金・無料ツール・記事・登録の4本を実リンクで並べる。
//   ※ /plans /price /ryokin は next.config.ts の 308 で /pricing へ寄せた
//     （/pricing 自体が無い期間は /business#pricing へ落ちる）。
//     ここは「それ以外の未マッチURL」の受け皿。
export default function RootNotFound() {
  return (
    <div className="company-light min-h-[100dvh] bg-white">
      <NotFoundState
        description="お探しのページは見つかりませんでした。よくある行き先はこちらです。"
        links={[
          { href: '/pricing', label: '料金を見る' },
          { href: '/tools', label: '無料セルフ点検ツール（登録不要）' },
          { href: '/roumu', label: '労務の記事を読む' },
          { href: '/zure', label: 'ファイルを置く', primary: true },
        ]}
      />
    </div>
  )
}

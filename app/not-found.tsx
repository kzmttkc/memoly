import { NotFoundState } from '@/components/ui/NotFoundState'

// ルート 404（どのセグメントにも該当しない未マッチURL）。ルートレイアウトは消費者向け
// ダーク基調のため、番頭の白基調カードが読めるよう company-light + 白背景でラップする。
// 戻り先は公開LP(/business)。
export default function RootNotFound() {
  return (
    <div className="company-light min-h-[100dvh] bg-white">
      <NotFoundState backHref="/business" backLabel="トップへ戻る" />
    </div>
  )
}

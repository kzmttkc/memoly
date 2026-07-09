import { NotFoundState } from '@/components/ui/NotFoundState'

// 無料ツール(/tools/*)配下の 404。戻り先は /business。
export default function ToolsNotFound() {
  return (
    <div className="company-light min-h-[100dvh] bg-white">
      <NotFoundState backHref="/business" backLabel="トップへ戻る" />
    </div>
  )
}

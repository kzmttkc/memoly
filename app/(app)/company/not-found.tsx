import { NotFoundState } from '@/components/ui/NotFoundState'

// /company 配下の 404。会社ダッシュボードのホームへ戻す。
export default function CompanyNotFound() {
  return <NotFoundState backHref="/company" />
}

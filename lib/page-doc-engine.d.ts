// 型の宣言だけ。実体は同名の .js（正典の写し）。
export type KiteiValues = { size: string; union: string; rules: string }
export interface Deadline { date: string; label: string }
declare const PageDocEngine: {
  build(kind: 'kitei' | 'hoshin', v: Record<string, string>): string | null
  valid(kind: 'kitei' | 'hoshin', v: Record<string, string>): boolean
  deadlines(kind: 'kitei' | 'hoshin', v: Record<string, string>): Deadline[]
  forms(kind: 'kitei' | 'hoshin', v: Record<string, string>): Array<{ id: string; title: string }>
  buildForms(v: Record<string, string>): string | null
  LABELS: Record<string, Record<string, Record<string, string>>>
  SUBJECT: Record<string, string>
}
export default PageDocEngine

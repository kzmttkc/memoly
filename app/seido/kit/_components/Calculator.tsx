'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { KEIKASOCHI_STAGES } from '@/lib/seido-kit'

// ============================================================================
// Calculator — 70%移行 影響額計算ツール（キット同梱・クライアント完結）
//   仕様: .company/products/banto/seido_kit_2026-08/keisan_tool_spec.md（AQ-023承認）
//   - 入力はすべて利用者自身。入力値はどこにも送信・保存しない（PIIなし・計測なし）
//   - 計算式は一次資料の規則そのまま:
//       課税仕入れに係る消費税額 = 税込額×10/110（軽減税率分は×8/108）
//       控除可能額 = 消費税額×控除割合（80/70/50/30/0%）
//       負担増 = 現行(80%)との控除差
//   - 仕入先別内訳（任意）: 税込1億円超の先に警告（超過部分は経過措置対象外。
//     上限が適用されるのは2026年10月1日以後に開始する課税期間から）
// ============================================================================

const OKU = 100_000_000

type SupplierRow = { name: string; amount: string }

function parseAmount(s: string): number {
  const n = Number(s.replace(/[,，\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

export function Calculator() {
  const [amount10, setAmount10] = useState('')
  const [amount8, setAmount8] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])

  const a10 = parseAmount(amount10)
  const a8 = parseAmount(amount8)

  const consumptionTax = useMemo(() => a10 * (10 / 110) + a8 * (8 / 108), [a10, a8])
  const baseline = consumptionTax * 0.8

  const overLimit = suppliers
    .map((s) => ({ name: s.name || '（名称未入力）', amount: parseAmount(s.amount) }))
    .filter((s) => s.amount > OKU)

  const inputClass =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none'

  return (
    <div className="space-y-6">
      {/* ===== 入力 ===== */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">
            免税事業者等からの年間課税仕入額（税込・標準税率10%対象）
          </span>
          <input
            inputMode="numeric"
            value={amount10}
            onChange={(e) => setAmount10(e.target.value)}
            placeholder="例: 12000000"
            className={`mt-1.5 ${inputClass}`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">
            同・軽減税率8%対象（ある場合のみ）
          </span>
          <input
            inputMode="numeric"
            value={amount8}
            onChange={(e) => setAmount8(e.target.value)}
            placeholder="例: 0"
            className={`mt-1.5 ${inputClass}`}
          />
        </label>
      </div>

      {/* ===== 結果 ===== */}
      {consumptionTax > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">経過措置の段階別の控除可能額と負担増</caption>
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th scope="col" className="py-2 pr-4 font-semibold text-neutral-900">期間</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-neutral-900">控除割合</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-neutral-900">控除可能額（年）</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-neutral-900">現行80%比の負担増（年）</th>
              </tr>
            </thead>
            <tbody>
              {KEIKASOCHI_STAGES.map((st) => {
                const deductible = consumptionTax * st.rate
                const burden = baseline - deductible
                return (
                  <tr key={st.label} className="border-b border-neutral-200">
                    <td className="py-2 pr-4 leading-relaxed text-neutral-600">{st.label}</td>
                    <td className="py-2 pr-4 text-neutral-600">{Math.round(st.rate * 100)}%</td>
                    <td className="py-2 pr-4 text-neutral-900">{yen(deductible)}</td>
                    <td className="py-2 pr-4 text-neutral-900">
                      {burden > 0 ? `${yen(burden)}（月あたり約${yen(burden / 12)}）` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            課税仕入れに係る消費税額（年）: {yen(consumptionTax)}。
            控除割合は課税仕入れを行った日の属する期間で決まります。
          </p>
        </div>
      )}

      {/* ===== 仕入先別内訳（1億円ルールの確認・任意） ===== */}
      <div className="rounded-xl border border-neutral-200 p-4">
        <p className="text-sm font-semibold text-neutral-900">仕入先別の内訳（任意・1億円ルールの確認）</p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          同じ免税事業者等からの年間課税仕入れ（税込）が1億円を超える場合、超えた部分は経過措置の対象外です
          （上限1億円が適用されるのは2026年10月1日以後に開始する課税期間から）。
        </p>
        <div className="mt-3 space-y-2">
          {suppliers.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={s.name}
                onChange={(e) =>
                  setSuppliers((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                }
                placeholder="仕入先名"
                className={inputClass}
              />
              <input
                inputMode="numeric"
                value={s.amount}
                onChange={(e) =>
                  setSuppliers((rows) => rows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))
                }
                placeholder="年間仕入額（税込）"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setSuppliers((rows) => rows.filter((_, j) => j !== i))}
                className="flex-none rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900"
                aria-label={`行${i + 1}を削除`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        {suppliers.length < 10 && (
          <button
            type="button"
            onClick={() => setSuppliers((rows) => [...rows, { name: '', amount: '' }])}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
          >
            <Plus className="h-4 w-4" aria-hidden />
            仕入先を追加
          </button>
        )}
        {overLimit.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            {overLimit.map((s) => (
              <p key={s.name}>
                {s.name}: 税込1億円を超えています（超過分 {yen(s.amount - OKU)} は経過措置の対象外になる可能性があります）。
                取引条件の検討は弁護士・税理士などの専門家にご相談ください。
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

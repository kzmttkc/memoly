import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// 番頭(Banto) 会社版 UI の共通クラス結合ヘルパ。
// clsx で条件付きクラスを組み、tailwind-merge で衝突を解消する
// （後勝ち: 例 "px-4" の後に "px-2" を渡すと px-2 が残る）。
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * round2 規約パッチ（参照用）。
 * 実装は linear-house/components/LegalFold.tsx。
 * 閉じても DOM に残し、ドロップと見本の間に置く。選択後に open。
 */
export function Round2LegalFold({ open }: { open: boolean }) {
  return (
    <details data-legal-fold open={open || undefined}>
      <summary>送る直前の扱い</summary>
      登録前の本文は1枚を出すためだけに使い、残す操作の前はサーバに書きません。
      学習には使いません。不足の断定でも、届出用の完成書類でもありません。
    </details>
  )
}

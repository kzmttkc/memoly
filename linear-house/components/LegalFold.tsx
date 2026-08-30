'use client'

/** Clerk型: 送る直前まで閉じる。ファイル選択後だけ開く。 */
export function LegalFold({ open }: { open: boolean }) {
  if (!open) {
    return (
      <p className="mt-4 text-xs text-[var(--lh-muted)]">
        送る直前の扱い（保存のタイミング）は、ファイルを選んだあとに表示します。
      </p>
    )
  }
  return (
    <details className="mt-4 text-sm text-[var(--lh-muted)]" open>
      <summary className="cursor-pointer font-medium text-[var(--lh-ink)]">
        送る直前の扱い（保存のタイミング）
      </summary>
      <p className="mt-2 leading-relaxed">
        置いたファイルは、残す操作の前にサーバへ保存しません。このブラウザに24時間だけ控え、残す操作のあとで会社の書類へ移します。同じ回線から1時間に8回まで置けます。共有のパソコンでは、残す操作までこの画面を閉じないでください。読めなかったページは未読として残します。
      </p>
    </details>
  )
}

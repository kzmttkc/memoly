'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

// ============================================================================
// MarkdownMessage — チャットの assistant 回答用 Markdown レンダラ（D04対応）。
//
//   従来はプロンプト側の NO_MARKDOWN_RULE（Markdown記法を使わない指示）だけに
//   頼り、抑制が漏れると "**太字**"「## 見出し」「| 表 |」が記号のまま利用者に
//   見えていた。本コンポーネントはその安全網として、漏れた Markdown も正しく
//   整形して描画する。
//
//   XSS 安全性:
//     - rehype-raw を使わない react-markdown の既定構成では、LLM 出力中の
//       生 HTML はパースされず文字列として表示される（スクリプト注入不可）。
//     - URL は react-markdown 既定の defaultUrlTransform が http/https/mailto 等の
//       安全なプロトコルのみ許可（javascript: 等は無害化される）。
//     - dangerouslySetInnerHTML は一切使わない。
//
//   改行の互換性:
//     - 旧描画は whitespace-pre-wrap の平文だったため、NO_MARKDOWN_RULE 準拠の
//       「【見出し】＋・箇条書き」形式の出力は単一改行に依存している。
//       remark-breaks で単一改行を <br> に変換し、従来の見た目を維持する。
//
//   コピー用途: チャットは画面閲覧が主目的。書類生成（documents）のコピー機能は
//   平文コピーのまま別画面で維持されており、本コンポーネントは関与しない。
// ============================================================================

// 【要点】(TL;DR) の抽出（P09・2026-07-24）。
//   システムプロンプトは長い回答の冒頭に「【要点】結論を1〜2行」を出させる（prompts.ts）が、
//   本文中の平文だと老眼・非IT層には他の段落と区別がつかず「実効化」しない。ここで先頭付近の
//   【要点】ブロックを取り出し、目立つ callout として最上部に描画し、残りを本文として続ける。
//   - マッチ範囲: 【要点】〜（空行 or 次の【見出し】 or 末尾）。1〜2行の想定に収まる。
//   - ストリーミング中に marker が未完（「【要」等）ならマッチせず通常描画のまま＝安全に劣化。
//   - 本文からは抽出分を除去し二重表示しない。
const KEYPOINT_RE = /【要点】\s*([\s\S]*?)(?=\n\s*\n|\n【|$)/

function extractKeypoint(content: string): { keypoint: string | null; body: string } {
  const m = content.match(KEYPOINT_RE)
  if (!m) return { keypoint: null, body: content }
  const keypoint = m[1].trim()
  if (!keypoint) return { keypoint: null, body: content }
  // マッチ全体（【要点】...）を本文から除去。前後に残る余分な空行は畳む。
  const body = content.replace(m[0], '').replace(/\n{3,}/g, '\n\n').trim()
  return { keypoint, body }
}

export function MarkdownMessage({ content }: { content: string }) {
  const { keypoint, body } = extractKeypoint(content)
  return (
    <div className="banto-md min-w-0 [overflow-wrap:anywhere]">
      {keypoint && (
        <div className="mb-2.5 rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2.5">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-brand-700">要点</p>
          <p className="text-sm font-medium leading-relaxed text-neutral-900 [overflow-wrap:anywhere]">
            {keypoint}
          </p>
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <p className="mb-1 mt-3 text-sm font-bold first:mt-0">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mb-1 mt-3 text-sm font-bold first:mt-0">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mb-1 mt-2.5 text-sm font-bold first:mt-0">{children}</p>
          ),
          h4: ({ children }) => (
            <p className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</p>
          ),
          h5: ({ children }) => (
            <p className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</p>
          ),
          h6: ({ children }) => (
            <p className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-1.5 list-disc space-y-0.5 pl-5 first:mt-0 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 list-decimal space-y-0.5 pl-5 first:mt-0 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-neutral-300 pl-3 text-neutral-600">
              {children}
            </blockquote>
          ),
          // GFM の表: バブル幅を超えないよう横スクロールで包む。
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-neutral-300 bg-neutral-200/60 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-neutral-300 px-2 py-1 align-top">{children}</td>
          ),
          code: ({ children, className }) => (
            <code
              className={`rounded bg-neutral-200/70 px-1 py-0.5 font-mono text-[0.85em] ${className ?? ''}`}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-neutral-200/60 p-2.5 text-xs [&>code]:bg-transparent [&>code]:p-0">
              {children}
            </pre>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-2 border-neutral-300" />,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}

'use client'

// ============================================================================
// app/global-error.tsx — ルートレイアウト自体が落ちたときの最後の砦。
//   これは root layout（<html>/<body>）を置き換えて描画されるため、自前で
//   <html>/<body> を持つ必要がある。CSS パイプラインが壊れていても必ず読める
//   よう、Tailwind クラスに依存せずインラインスタイルだけで組む（依存ゼロ）。
//   ブランド色（--color-brand-600 = #324a8a）を直値で当て、番頭の面と揃える。
// ============================================================================

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily:
            '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '30rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '1rem',
            boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden
            style={{
              width: '44px',
              height: '44px',
              margin: '0 auto 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.75rem',
              background: '#eef2fb',
              color: '#324a8a',
              fontSize: '22px',
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            予期しないエラーが発生しました
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              lineHeight: 1.7,
              color: '#475569',
              margin: '0 0 1.5rem',
            }}
          >
            一時的な問題の可能性があります。お手数ですが、もう一度お試しください。
            繰り返し発生する場合は、時間をおいてからアクセスしてください。
          </p>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                height: '2.5rem',
                padding: '0 1rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: '#324a8a',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              もう一度試す
            </button>
            <a
              href="/company"
              style={{
                height: '2.5rem',
                padding: '0 1rem',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '0.75rem',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#1e293b',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              ホームへ戻る
            </a>
          </div>
          {error?.digest && (
            <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              エラーID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}

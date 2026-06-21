import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="max-w-2xl w-full">
        {/* ロゴ */}
        <div className="mb-8">
          <span className="text-5xl font-bold tracking-tight">
            <span className="text-violet-400">Memo</span>
            <span className="text-white">ly</span>
          </span>
        </div>

        {/* キャッチコピー */}
        <h1 className="text-3xl font-semibold text-white mb-4 leading-tight">
          あなたのことを<br />覚えているAI
        </h1>
        <p className="text-gray-400 text-lg mb-10 leading-relaxed">
          毎回ゼロから説明しなくていい。<br />
          会話のたびに、あなたのことをもっと深く理解していく<br />
          パーソナルAIアシスタント。
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-2xl transition-colors text-lg"
          >
            無料で始める
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold rounded-2xl transition-colors text-lg"
          >
            ログイン
          </Link>
        </div>

        {/* バッジ */}
        <p className="mt-8 text-sm text-gray-600">
          アーリーアクセス版・完全無料
        </p>

        {/* 送客フッター */}
        <div className="mt-16 pt-8 border-t border-gray-800">
          <p className="text-sm text-gray-500">
            労務・社会保険の相談は{' '}
            <a
              href="https://sharoushi-agent.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              sharoushi-agent.com
            </a>
            {' '}（無料）
          </p>
        </div>
      </div>
    </main>
  )
}

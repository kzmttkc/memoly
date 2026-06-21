import Link from 'next/link'

const FEATURES = [
  {
    icon: '🧠',
    title: '会話を重ねるほど賢くなる',
    desc: '10メッセージごとに自動でサマリーを生成。次回以降の会話に記憶を活かします。',
  },
  {
    icon: '📋',
    title: '記憶ダッシュボード',
    desc: 'AIが覚えていることを一覧表示。削除・確認もできるので、プライバシーも安心。',
  },
  {
    icon: '📬',
    title: '週次振り返りメール',
    desc: '毎週月曜、先週の会話から振り返りレポートをメールでお届け。継続の習慣に。',
  },
]

export default function Home() {
  return (
    <main className="flex flex-col items-center min-h-screen px-6 py-16 text-center">
      <div className="max-w-xl w-full">

        {/* ロゴ */}
        <div className="mb-6">
          <span className="text-5xl font-bold tracking-tight">
            <span className="text-violet-400">Memo</span>
            <span className="text-white">ly</span>
          </span>
        </div>

        {/* キャッチコピー */}
        <h1 className="text-3xl font-semibold text-white mb-4 leading-tight">
          あなたのことを<br />覚えているAI
        </h1>
        <p className="text-gray-400 text-base mb-8 leading-relaxed">
          毎回「私は○○です」と説明しなくていい。<br />
          会話のたびに記憶が積み上がる、パーソナルAIアシスタント。
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
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
        <p className="text-xs text-gray-600 mb-12">メール登録のみ・クレジットカード不要</p>

        {/* 機能カード */}
        <div className="grid gap-3 mb-12 text-left">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-4 p-4 rounded-2xl border border-gray-800 bg-gray-900"
            >
              <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <p className="font-semibold text-white text-sm mb-1">{f.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* sharoushi-agent 送客カード */}
        <a
          href="https://sharoushi-agent.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-2xl border border-indigo-900 bg-indigo-950/50 hover:bg-indigo-950 transition-colors mb-12 text-left"
        >
          <span className="text-2xl flex-shrink-0">⚖️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-200">労務・社会保険の相談は</p>
            <p className="text-xs text-indigo-400 mt-0.5">sharoushi-agent.com — 無料で使えるAI労務アシスタント</p>
          </div>
          <span className="text-indigo-500 text-lg">›</span>
        </a>

        {/* フッター */}
        <div className="pt-8 border-t border-gray-800 space-y-3">
          <div className="flex gap-4 justify-center text-xs text-gray-600">
            <Link href="/privacy" className="hover:text-gray-400">プライバシーポリシー</Link>
            <Link href="/terms" className="hover:text-gray-400">利用規約</Link>
          </div>
          <p className="text-xs text-gray-700">by <a href="https://x.com/takeshi_ai_jp" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">@takeshi_ai_jp</a></p>
        </div>

      </div>
    </main>
  )
}

import Link from 'next/link'

/** Below-fold: 置く→見る→残す / 比較 / 料金 / 注意。見本はヒーロー枠内へ移した。 */
export function ZureLpBelow() {
  return (
    <div className="zure-lp-below mx-auto max-w-2xl px-6 pb-28 pt-4 sm:pb-16">
      <section aria-labelledby="zure-flow-h" className="border-t border-[var(--lh-line)] pt-10">
        <h2 id="zure-flow-h" className="text-xl font-semibold tracking-tight text-[var(--lh-ink)] sm:text-2xl">
          置く → 見る → 残す
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['1', '置く', '登録の前にファイルを置きます。読めないページは未読として残します。'],
            ['2', '見る', 'カスハラなど期限の近い論点を先に、書いてある／ない／運用不足を1枚にします。'],
            ['3', '残す', '残す操作のあと、会社の前提として続きの相談ができます。チャットはまだ開きません。'],
          ].map(([n, t, d]) => (
            <div key={n} className="border border-[var(--lh-line)] bg-[var(--lh-canvas)] px-4 py-3">
              <p className="text-lg text-[var(--lh-muted)]">{n}</p>
              <p className="mt-1 font-semibold text-[var(--lh-ink)]">{t}</p>
              <p className="mt-1 text-sm text-[var(--lh-muted)]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="zure-line-h" className="mt-12 border-t border-[var(--lh-line)] pt-10">
        <h2 id="zure-line-h" className="text-xl font-semibold tracking-tight text-[var(--lh-ink)] sm:text-2xl">
          何で、何ではないか
        </h2>
        <dl className="mt-4 divide-y divide-[var(--lh-line)] border-y border-[var(--lh-line)] text-sm">
          <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="font-semibold text-[var(--lh-ink)]">SmartHR / freee</dt>
            <dd className="text-[var(--lh-muted)]">
              入退社・手続きの基盤。こちらは置き換えません。規程の穴を見る前工程です。
            </dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="font-semibold text-[var(--lh-ink)]">ChatGPT / Claude</dt>
            <dd className="text-[var(--lh-muted)]">
              毎回ファイルを貼り直し、社内前提が残りません。こちらは1枚と会社記憶が続きます。
            </dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="font-semibold text-[var(--lh-ink)]">社労士</dt>
            <dd className="text-[var(--lh-muted)]">
              届出・完成品・個別助言は専門家の仕事です。こちらは渡す前の論点の1枚です。
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="zure-price-h" className="mt-12 border-t border-[var(--lh-line)] pt-10">
        <h2 id="zure-price-h" className="text-xl font-semibold tracking-tight text-[var(--lh-ink)] sm:text-2xl">
          料金
        </h2>
        <p className="mt-3 text-2xl text-[var(--lh-ink)]">登録前の1枚は 0円</p>
        <p className="mt-2 text-sm text-[var(--lh-muted)]">
          登録してもクレジットカードは不要です。有料は、残して相談を続けるときだけです。Entry 3,980円／月（会社単位）。
        </p>
        <p className="mt-4">
          <Link href="/offer" className="lh-btn lh-btn-ghost inline-flex items-center">
            無料と有料の違い
          </Link>
        </p>
      </section>

      <section aria-labelledby="zure-safe-h" className="mt-12 border-t border-[var(--lh-line)] pt-10">
        <h2 id="zure-safe-h" className="text-xl font-semibold tracking-tight text-[var(--lh-ink)] sm:text-2xl">
          先に言っておくこと
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--lh-muted)]">
          <li>違法判定をしません。不足の断定もしません。</li>
          <li>届出用の完成書類は出しません。社労士の代わりを名乗りません。</li>
          <li>API入力は学習に使いません（Anthropic / OpenAI の既定）。</li>
          <li>残す操作の前に、置いた本文をサーバへ保存しません。</li>
        </ul>
        <p className="mt-4 text-sm text-[var(--lh-muted)]">
          就業規則がまだ無いときは、下書きの本文を貼るか、
          <Link href="/tools" className="font-medium text-[var(--lh-ink)] underline underline-offset-2">
            無料の点検
          </Link>
          から数字を確認できます。
        </p>
      </section>
    </div>
  )
}

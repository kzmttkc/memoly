import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shouldFireOnce, ONCE_KEY_PREFIX } from '../../lib/analytics-once.ts'

// ============================================================================
// signup_started 再発火バグの回帰テスト（2026-08-25 GTM段2）
//
//   実測（Plausible 30日・hostname=banto-roumu.com）:
//     signup_started        events 67 / visitors  6 = 1人あたり11.2回
//     signup_context_shown  events 34 / visitors  5 = 1人あたり 6.8回
//     signup_completed      events  2 / visitors  2 = 1.0（正常）
//
//   原因: app/(auth)/signup/page.tsx の
//     useEffect(() => track('signup_started', ...), [attribution])
//   attribution は useMemo が返す**オブジェクト**で、依存の searchParams の同一性が
//   変わるたびに作り直される。依存配列はオブジェクトを参照同一性で比較するため、
//   再レンダのたびに effect が再実行され、同じ訪問で何度も発火していた。
//   加えて両イベントとも発火ガードが1つも無く、同一タブ内の再マウント（Suspense
//   境界の再サスペンド・戻る/進む）でも素通りしていた。
//
//   段2（名前を取る）の件数を数えるのに、この母数が壊れていると判定できない。
//   直し方は「参照同一性に依存しない」こと＝**安定した文字列キーで1訪問1回**に縛る。
// ============================================================================

/** テスト用の Storage もどき（sessionStorage の最小面）。 */
function memStore() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    size: () => m.size,
  }
}

test('同じキーは1訪問に1回しか通らない（再レンダ・再マウントで再発火しない）', () => {
  const store = memStore()
  assert.equal(shouldFireOnce('signup_started', store), true)
  for (let i = 0; i < 20; i++) {
    assert.equal(
      shouldFireOnce('signup_started', store),
      false,
      '2回目以降が通っている。再レンダ1回ごとに1件計上され、母数が壊れる',
    )
  }
})

test('別のイベントは互いに邪魔しない', () => {
  const store = memStore()
  assert.equal(shouldFireOnce('signup_started', store), true)
  assert.equal(shouldFireOnce('signup_context_shown', store), true)
  assert.equal(shouldFireOnce('signup_started', store), false)
  assert.equal(shouldFireOnce('signup_context_shown', store), false)
})

test('訪問（セッション）が変われば、また1回だけ通る', () => {
  const first = memStore()
  assert.equal(shouldFireOnce('signup_started', first), true)
  // 別セッション＝別ストア。visitors と同じ粒度に戻る。
  const second = memStore()
  assert.equal(shouldFireOnce('signup_started', second), true)
})

test('ストアが使えなくても計測は落ちるだけで、例外を投げない', () => {
  const broken = {
    getItem() {
      throw new Error('SecurityError: storage disabled')
    },
    setItem() {
      throw new Error('SecurityError: storage disabled')
    },
  }
  // プライベートブラウズ等で storage が例外を投げる環境。画面を壊してはいけない。
  assert.doesNotThrow(() => shouldFireOnce('signup_started', broken))
  assert.equal(shouldFireOnce('signup_started', broken), true)
})

test('キーは他の localStorage/sessionStorage 利用と衝突しない接頭辞を持つ', () => {
  const store = memStore()
  shouldFireOnce('signup_started', store)
  assert.equal(store.getItem(ONCE_KEY_PREFIX + 'signup_started'), '1')
  assert.match(ONCE_KEY_PREFIX, /^banto_/)
})

// --- 発火点そのものを縛る（実装が元の形へ戻ったら落ちる） ---

const signup = readFileSync(
  new URL('../../app/(auth)/signup/page.tsx', import.meta.url),
  'utf8',
)

test('signup_started は素の track() ではなく1訪問1回の経路で発火する', () => {
  assert.doesNotMatch(
    signup,
    /(?<!Once)\btrack\(\s*'signup_started'/,
    "track('signup_started') を直接呼んでいる。useEffect の依存が変わるたびに再発火する",
  )
  assert.match(signup, /trackOncePerVisit\(\s*'signup_started'/)
})

test('signup_context_shown も1訪問1回の経路で発火する', () => {
  assert.doesNotMatch(signup, /(?<!Once)\btrack\(\s*'signup_context_shown'/)
  assert.match(signup, /trackOncePerVisit\(\s*'signup_context_shown'/)
})

test('オブジェクトを依存配列に置いたままにしない（再発火の元）', () => {
  // attribution は useMemo が返すオブジェクト。依存に置くと参照同一性で再実行される。
  assert.doesNotMatch(
    signup,
    /\}, \[attribution\]\)/,
    'useEffect の依存が attribution（オブジェクト）のまま。再レンダごとに再発火する',
  )
})

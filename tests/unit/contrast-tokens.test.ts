// ============================================================================
// WCAG コントラストの回帰防止（2026-08-12 実描画コントラスト再検査の是正）。
//
// なぜ要るか: 2026-08-12 の実描画（画素）計測で、公開LPに2種の欠陥が残っていた。
//   1) text-neutral-500(#64748B) を薄い面に載せると AA(4.5:1) を割る
//      — 白地 4.759 は通るが bg-neutral-50 4.548 / bg-neutral-100 4.344 と
//        地色ひとつで境界を跨ぐ。人手のレビューでは検出できない差
//   2) 操作できる部品の枠に border-neutral-200(#E2E8F0・白地 1.233:1) /
//      border-neutral-300(#CBD5E1・1.485:1) を使っており、WCAG 1.4.11 の 3:1 に
//      大きく未達。弱視の利用者は「どこが入力欄・ボタンか」を枠でしか判別できない
//
// 直した箇所だけを見張っても、次に新しく書く JSX で同じ組み合わせが復活する。
// ここではトークンの値そのものを @theme から読んで計算し、
// 「この色をこの面に載せてはいけない」を機械で固定する。
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const globalsCss = readFileSync(join(ROOT, "app", "globals.css"), "utf8");

function token(name: string): string {
  const m = globalsCss.match(new RegExp(`^\\s*${name}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`, "m"));
  assert.ok(m, `app/globals.css に ${name} が見つからない`);
  return m[1].toLowerCase();
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// 公開LPに実在する「文字の下に来る面」。白だけで判定すると境界を見逃す。
const SURFACES = ["#ffffff", () => token("--color-neutral-50"), () => token("--color-neutral-100"), () => token("--color-brand-50")];

test("本文グレーとして使うトークンが、LPに実在する全ての面で AA(4.5:1) を満たす", () => {
  // text-neutral-500 は白地 4.759 で通るが neutral-100 上 4.344 で落ちる。
  // LP の薄い面に載せる本文は neutral-600 を使う、という規律を数値で固定する。
  const body = token("--color-neutral-600");
  const failures: string[] = [];
  for (const s of SURFACES) {
    const bg = typeof s === "string" ? s : s();
    const r = contrast(body, bg);
    if (r < 4.5) failures.push(`--color-neutral-600(${body}) on ${bg} = ${r.toFixed(3)}:1`);
  }
  assert.deepEqual(failures, [], `AA 未達:\n${failures.join("\n")}`);

  // 逆向きの固定: neutral-500 が薄い面で落ちること自体を記録しておく。
  // これが将来 4.5 を超えるようトークンが変わったら、この規律は不要になる。
  const midGray = token("--color-neutral-500");
  assert.ok(
    contrast(midGray, token("--color-neutral-100")) < 4.5,
    `--color-neutral-500 が neutral-100 上で AA を満たすようになった。` +
      " この場合は本テストと LP の neutral-600 置換を見直してよい。"
  );
});

test("操作できる部品の枠に 1.4.11(3:1) 未達のトークンが使われていない", () => {
  // WCAG 1.4.11 の対象は「触れる部品」の境界。カード・区切り線・表罫線は対象外なので、
  // 直前の開始タグが button/input/select/textarea の行だけを見る。
  const BANNED = new Set(
    ["--color-neutral-200", "--color-neutral-300", "--color-neutral-400"].filter(
      (n) => contrast(token(n), "#ffffff") < 3
    ).map((n) => n.replace("--color-neutral-", "border-neutral-"))
  );
  assert.ok(BANNED.size > 0, "border 用の禁止トークンが1つも算出されなかった（トークン読み取りの失敗）");

  const failures: string[] = [];
  const walk = (dir: string): string[] => {
    const acc: string[] = [];
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === "backups") continue;
      const rel = join(dir, e.name);
      if (e.isDirectory()) acc.push(...walk(rel));
      else if (e.name.endsWith(".tsx")) acc.push(rel);
    }
    return acc;
  };

  for (const rel of [...walk("app"), ...walk("components")]) {
    const lines = readFileSync(join(ROOT, rel), "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const hits = [...BANNED].filter((c) =>
        new RegExp(`(?<!hover:)(?<!focus:)(?<!focus-visible:)(?<!group-hover:)\\b${c}\\b`).test(lines[i])
      );
      if (hits.length === 0) continue;
      // 直近の開始タグを遡る（className が複数行に折り返されているため）。
      let tag: string | null = null;
      for (let j = i; j >= Math.max(0, i - 25); j--) {
        const m = [...lines[j].matchAll(/<([a-zA-Z][\w.]*)/g)];
        if (m.length) { tag = m[m.length - 1][1]; break; }
      }
      if (tag && /^(button|input|select|textarea)$/i.test(tag)) {
        failures.push(
          `${relative(".", rel)}:${i + 1} <${tag}> に ${hits.join(",")}（白地 3:1 未満）。` +
            " border-neutral-500 を使うこと。"
        );
      }
    }
  }
  assert.deepEqual(failures, [], `WCAG 1.4.11 未達の枠線:\n${failures.join("\n")}`);
});

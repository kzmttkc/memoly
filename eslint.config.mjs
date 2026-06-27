import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ============================================================================
// 番頭(Banto) デザイン一貫性ガード
//   会社版(/company)と公開LP(/business)は globals.css の @theme トークン
//   (brand / neutral / success / warning / danger / info) のみで配色する規約。
//   消費者Memoly由来の生のTailwind原始カラー(bg-gray-* / text-violet-* 等)を
//   これらの面に混ぜると、AIの差分編集でライト基調が静かに崩れる。
//   そこで「許可トークン以外の原始パレットを含むクラス文字列」を検出して warn する。
//   まずは warn 止まり（buildを壊さない・CIブロックしない）。token化が進んだら
//   error 昇格を検討する。
//
//   検出対象パレット(=禁止): tailwind 既定の原始カラー名から、トークンとして採用した
//   neutral を除いた全て。violet/gray/slate/red... が typical な混入元。
//   許可: brand neutral success warning danger info（@theme 由来）。
// ============================================================================

// 例: bg-violet-600 / text-gray-400 / border-slate-200 / hover:bg-red-50 /
//     ring-indigo-500/30 / sm:text-zinc-700 にマッチ。tabular-nums 等の非カラー、
//     brand-/neutral-/success-/warning-/danger-/info- は対象外。
const RAW_PALETTE =
  "gray|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RAW_COLOR_CLASS_RE = new RegExp(
  // (任意のvariant接頭辞 例 hover: sm: dark:) + (色プロパティ) - (原始パレット) - (数値スケール)
  `\\b[\\w-]*-(?:${RAW_PALETTE})-\\d{2,3}\\b`,
);

const rawColorMessage =
  "番頭(会社版/LP)では生のTailwindカラー(例 bg-violet-600 / text-gray-400)を直書きしないでください。" +
  "globals.cssの@themeトークン(brand / neutral / success / warning / danger / info)由来のユーティリティを使ってください。";

// 文字列リテラル・テンプレート片・JSXテキストいずれに混ざっても拾う。
const noRawColorRules = {
  "no-restricted-syntax": [
    "warn",
    {
      selector: `Literal[value=/${RAW_COLOR_CLASS_RE.source}/]`,
      message: rawColorMessage,
    },
    {
      selector: `TemplateElement[value.raw=/${RAW_COLOR_CLASS_RE.source}/]`,
      message: rawColorMessage,
    },
    {
      selector: `JSXText[value=/${RAW_COLOR_CLASS_RE.source}/]`,
      message: rawColorMessage,
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 番頭の面(会社版/公開LP)だけにデザイン一貫性ガードを適用。
  // 消費者Memoly(/, /chat, /memory, 認証画面)はダーク基調を温存するため対象外。
  {
    files: ["app/(app)/company/**/*.{ts,tsx}", "app/business/**/*.{ts,tsx}"],
    rules: noRawColorRules,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

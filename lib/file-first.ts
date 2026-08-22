// ============================================================================
// file-first.ts — 相談はファイルの後。取込0件なら止める。
// ============================================================================

export const FILE_FIRST_CODE = 'FILE_FIRST'

export const FILE_FIRST_MESSAGE =
  '相談の前に、就業規則のファイルを書類へ置くか、入口で本文を貼って残してください。ずれの1枚が出ると、相談が開きます。'

export function isChatAllowed(ingestedCount: number): boolean {
  return ingestedCount > 0
}

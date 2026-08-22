// ============================================================================
// document-extract.ts — 就業規則ファイルから本文を取り出す
//   入口。完璧なパースより「取れなかったページを未読として残す」。
// ============================================================================

export type DocumentKind = 'txt' | 'pdf' | 'docx' | 'unsupported'

export interface ExtractInput {
  buffer: Uint8Array
  filename: string
  mime: string
}

export interface ExtractResult {
  text: string
  filename: string
  kind: DocumentKind
  unreadNote: string | null
  pageCount: number | null
}

const MAX_CHARS = 100_000
export const EXTRACT_MAX_CHARS = MAX_CHARS

export const PDF_EXTRACT_FAIL =
  'PDFを開けませんでした。パスワード付きの場合は解除してから置いてください。スキャン画像の場合は本文を貼り付けるか、別のファイルを試してください。'

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function plainTextFromClipboardData(getData: (type: string) => string): string {
  const plain = getData('text/plain')
  if (plain.replace(/^\uFEFF/, '').trim()) return plain
  return htmlToPlainText(getData('text/html') || '')
}

export function fileFromPastedText(
  text: string,
): { ok: true; file: File; truncated: boolean } | { ok: false; error: string } {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) {
    return { ok: false, error: '貼る本文が空です。ファイルを置くか、本文を入れてください。' }
  }
  const truncated = trimmed.length > MAX_CHARS
  const body = truncated ? trimmed.slice(0, MAX_CHARS) : trimmed
  return {
    ok: true,
    file: new File([body], 'pasted.txt', { type: 'text/plain' }),
    truncated,
  }
}

export function sniffKind(filename: string, mime: string): DocumentKind {
  const name = filename.toLowerCase()
  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf'
  if (
    name.endsWith('.docx') ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx'
  }
  if (name.endsWith('.txt') || name.endsWith('.md') || mime.startsWith('text/')) return 'txt'
  return 'unsupported'
}

export function unreadNoteForUnsupported(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
    return '古いWord形式（.doc）は開けません。.docxかPDFにしてください。'
  }
  if (lower.endsWith('.zip') || lower.endsWith('.7z')) {
    return 'zipのままでは置けません。中のPDFかWordを1つ選んでください。'
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return '表計算は置けません。就業規則のPDFかWordかテキストにしてください。'
  }
  if (lower.endsWith('.pages') || lower.endsWith('.odt') || lower.endsWith('.rtf')) {
    return 'Pages・OpenDocument・RTFは開けません。Word（.docx）かPDFかテキストにしてください。'
  }
  if (/\.(png|jpe?g|gif|webp|heic|heif)$/i.test(lower)) {
    return '画像ファイルは本文を取れません。PDFかWordにするか、本文を貼ってください。'
  }
  return 'この形式には対応していません。PDF・Word（.docx）・テキストを選んでください。'
}

export function emptyOrFolderNote(file: { size: number; name: string }): string | null {
  if (file.size > 0) return null
  if (!file.name.includes('.')) {
    return 'フォルダはそのまま置けません。中のPDFかWordを1つ選んでください。'
  }
  return 'ファイルが空です。別のファイルを置くか、本文を貼ってください。'
}

export async function extractDocumentText(input: ExtractInput): Promise<ExtractResult> {
  const kind = sniffKind(input.filename, input.mime)
  if (kind === 'unsupported') {
    return {
      text: '',
      filename: input.filename,
      kind,
      unreadNote: unreadNoteForUnsupported(input.filename),
      pageCount: null,
    }
  }
  if (kind === 'txt') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(input.buffer).trim()
    return capResult(input.filename, kind, text, text ? null : 'ファイルが空でした。', null)
  }
  if (kind === 'pdf') {
    return extractPdf(input)
  }
  return extractDocx(input)
}

function capResult(
  filename: string,
  kind: DocumentKind,
  text: string,
  unreadNote: string | null,
  pageCount: number | null,
): ExtractResult {
  const clipped = text.slice(0, MAX_CHARS)
  const overflow = text.length > MAX_CHARS ? '先頭10万字まで取り込みました。残りは未読です。' : null
  return {
    text: clipped,
    filename,
    kind,
    unreadNote: [unreadNote, overflow].filter(Boolean).join(' ') || null,
    pageCount,
  }
}

async function extractPdf(input: ExtractInput): Promise<ExtractResult> {
  try {
    const { extractText } = await import('unpdf')
    const extracted = await extractText(input.buffer, { mergePages: true })
    const text = extracted.text.trim()
    const pages = extracted.totalPages
    if (text.length < 20) {
      return capResult(
        input.filename,
        'pdf',
        text,
        'このPDFから十分なテキストを取り出せませんでした。スキャン画像の場合は本文を貼り付けてください。',
        pages,
      )
    }
    return capResult(input.filename, 'pdf', text, null, pages)
  } catch {
    return capResult(input.filename, 'pdf', '', PDF_EXTRACT_FAIL, null)
  }
}

async function extractDocx(input: ExtractInput): Promise<ExtractResult> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(input.buffer) })
    const text = (result.value ?? '').trim()
    if (text.length < 20) {
      return capResult(
        input.filename,
        'docx',
        text,
        'このWordファイルから十分なテキストを取り出せませんでした。本文を貼り付けてください。',
        null,
      )
    }
    return capResult(input.filename, 'docx', text, null, null)
  } catch {
    return capResult(
      input.filename,
      'docx',
      '',
      'Wordファイルの解析に失敗しました。本文を貼り付けるか、.docx で保存し直してください。',
      null,
    )
  }
}

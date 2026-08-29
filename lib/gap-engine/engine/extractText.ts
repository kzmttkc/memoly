/**
 * 登録前の本文抽出。
 * PDF は pdf-parse、docx は mammoth を想定。ここはインターフェースと失敗の扱いだけ固定する。
 */

export type ExtractResult = {
  text: string;
  pageCount: number;
  pagesUnread: number[];
  filename?: string;
};

export function rejectFile(filename: string, mime: string, byteSize: number): string | null {
  if (byteSize > 8 * 1024 * 1024) return "8MBを超えています";
  const lower = filename.toLowerCase();
  if (lower.endsWith(".doc")) return "古いWord（.doc）は .docx にしてから置いてください";
  if (lower.endsWith(".pages")) return "Pagesは置けません。テキストを貼るか、Word/PDFにしてください";
  if (!/\.(pdf|docx|txt)$/i.test(filename)) return "PDF・Word（.docx）・テキストだけ置けます";
  if (mime.startsWith("image/")) return "画像は置けません";
  return null;
}

export function markSparsePages(
  pageTexts: string[],
): { text: string; pageCount: number; pagesUnread: number[] } {
  const unread: number[] = [];
  const readable: string[] = [];
  pageTexts.forEach((t, i) => {
    const compact = t.replace(/\s+/g, "");
    if (compact.length < 40) unread.push(i + 1);
    else readable.push(t);
  });
  return {
    text: readable.join("\n\n"),
    pageCount: pageTexts.length,
    pagesUnread: unread,
  };
}

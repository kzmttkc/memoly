const PATTERNS: RegExp[] = [
  /\b\d{3}-\d{4}-\d{4}\b/g,
  /\b0\d{1,3}-\d{2,4}-\d{4}\b/g,
  /[A-Z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /\b\d{3}-\d{4}\b/g,
  /マイナンバー[:：]?\s*\d[\d\s-]{10,}/g,
  /口座[:：]?\s*\d[\d\s-]{5,}/g,
];

export function redactPii(text: string): string {
  return PATTERNS.reduce((acc, re) => acc.replace(re, "［削除］"), text);
}

export function memoryValueAllowed(value: string): boolean {
  if (!value) return false;
  if (/(氏名|様|さん|マイナンバー|口座|診断書)/.test(value)) return false;
  return value.length <= 80;
}

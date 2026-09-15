// 写し: 正典は ~/Takeshi_Automation/netlify/functions/_docx.js。直接直さない（2026-09-15）。
// _docx.js — 依存なしで最小の .docx（Word 文書）を組む
//
// なぜ（2026-09-04・段2の壁）:
//   ボタンは「Word をこの画面とメールに出す」と言うのに、届くのはプレーンテキストだった。
//   画面に全文が出ている以上、メールで渡せる「画面にできないもの」は**開いて編集できるファイル**しかない。
//   正典 §10.3 は実装順を 1.画面全文 2.メール本文 3.添付docx と定め、3 は「できれば」。1・2 は既に本番。
//   総務担当が条文をブラウザから Word へ貼り直す手間が、そのまま提出しない理由になっている。
//
// 方式: docx = OOXML の zip。外部ライブラリを入れず、無圧縮（stored）で zip を手で組む。
//   小さい文書（数KB）なので圧縮は不要。CRC32 は自前で計算する。
//   Word は stored の zip をそのまま開ける。
//
// 入力はプレーンテキスト（page-doc-engine が組んだ本文）。行の形で段落種別を決める:
//   - 1行目           → 表題（見出し1相当）
//   - 「■ 」で始まる  → 節見出し（見出し2相当）
//   - 「──…」の罫線  → 罫線段落（細い文字で出す）
//   - 空行            → 空段落
//   - それ以外        → 本文
// 書体は游明朝/游ゴシックではなく、Word 既定の日本語フォント（MS 明朝相当）に任せず
// 「Yu Gothic」を指定する。無い環境でも Word が代替を当てる。

'use strict';

// ---- CRC32（zip 用・多項式 0xEDB88320）----
let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c;
  }
  return CRC_TABLE;
}
function crc32(buf) {
  const t = crcTable();
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ t[(c ^ buf[i]) & 0xFF];
  return (c ^ (-1)) >>> 0;
}

// ---- zip（無圧縮・ディレクトリエントリなし）----
function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // ローカルヘッダ署名
    local.writeUInt16LE(20, 4);           // 展開に必要なバージョン
    local.writeUInt16LE(0, 6);            // フラグ
    local.writeUInt16LE(0, 8);            // 方式 0 = stored
    local.writeUInt16LE(0, 10);           // 時刻（固定・再現性のため）
    local.writeUInt16LE(0x21, 12);        // 日付 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);      // 中央ディレクトリ署名
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);         // ローカルヘッダ位置
    central.push(Buffer.concat([ch, name]));
    offset += local.length + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    // XML 1.0 が許さない制御文字を落とす（本文に混ざると Word が開けない）
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function para(text, kind) {
  const style = { h1: 'Heading1', h2: 'Heading2', rule: 'Rule' }[kind] || '';
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  if (!text) return `<w:p>${pPr}</w:p>`;
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function classify(line, index) {
  if (index === 0) return 'h1';
  if (/^■/.test(line)) return 'h2';
  if (/^[─―-]{6,}$/.test(line.trim())) return 'rule';
  return '';
}

/**
 * プレーンテキストから .docx のバイト列を作る。
 * @param {string} text page-doc-engine が組んだ本文
 * @returns {Buffer}
 */
function buildDocx(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
  const body = lines.map((l, i) => para(l, classify(l, i))).join('');

  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="851" w:footer="992" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>';

  const font = '<w:rFonts w:ascii="Yu Gothic" w:eastAsia="Yu Gothic" w:hAnsi="Yu Gothic" w:cs="Yu Gothic"/>';
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>` +
    '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>' +
    `<w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr><w:rPr>${font}<w:b/><w:sz w:val="30"/></w:rPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>' +
    `<w:pPr><w:spacing w:before="280" w:after="120"/></w:pPr><w:rPr>${font}<w:b/><w:sz w:val="24"/></w:rPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="Rule"><w:name w:val="Rule"/>' +
    `<w:rPr>${font}<w:color w:val="9A9078"/><w:sz w:val="16"/></w:rPr></w:style>` +
    '</w:styles>';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '</Types>';

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  // [Content_Types].xml は zip の先頭に置く（OPC の慣行）
  return zip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: document },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    { name: 'word/styles.xml', data: styles }
  ]);
}

module.exports = { buildDocx, _internal: { crc32, zip, classify, esc } };

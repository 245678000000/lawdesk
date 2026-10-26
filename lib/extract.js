// 给「自有 API」模式用：把附件转成纯文本塞进对话。CLI 模式下智能体自己读文件，不走这里。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';

const MAX_CHARS = 60000;
const TEXT_EXT = new Set(['.txt', '.md', '.csv', '.tsv', '.json', '.xml', '.html', '.htm', '.log', '.yaml', '.yml']);
const TEXTUTIL_EXT = new Set(['.doc', '.rtf', '.odt', '.wordml', '.webarchive']);

const run = (cmd, args) => new Promise((resolve, reject) => {
  execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, timeout: 60000, windowsHide: true }, (err, stdout) =>
    err ? reject(err) : resolve(stdout));
});

// 从 zip（.docx 就是 zip）里取出一个文件，只支持不压缩和 deflate 两种方式
function readZipEntry(buf, name) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function docxText(absPath) {
  const xml = readZipEntry(fs.readFileSync(absPath), 'word/document.xml');
  if (!xml) return null;
  return xml.toString('utf8')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:(br|cr)\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

const PDF_HINT = process.platform === 'darwin'
  ? '（无法读取 PDF：请先安装 poppler，命令 brew install poppler）'
  : process.platform === 'win32'
    ? '（无法读取 PDF：请改用 Claude Code / Codex 模式，或安装 poppler 并把 pdftotext.exe 加入 PATH）'
    : '（无法读取 PDF：请先安装 poppler-utils）';

export async function extractText(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  let text;
  if (TEXT_EXT.has(ext)) {
    text = fs.readFileSync(absPath, 'utf8');
  } else if (ext === '.docx') {
    text = docxText(absPath);
    if (text === null) return { ok: false, text: '（这个 .docx 文件无法解析，请另存为新的 Word 文件或 PDF 后再试）' };
  } else if (TEXTUTIL_EXT.has(ext) && process.platform === 'darwin') {
    text = await run('textutil', ['-convert', 'txt', '-stdout', absPath]);
  } else if (ext === '.pdf') {
    try {
      text = await run('pdftotext', ['-layout', '-enc', 'UTF-8', absPath, '-']);
    } catch {
      return { ok: false, text: PDF_HINT };
    }
    if (!text.trim()) return { ok: false, text: '（PDF 中没有可提取的文字，可能是扫描件，需要先 OCR）' };
  } else {
    return { ok: false, text: `（${ext || '该'} 格式在 API 模式下无法直接读取，请转成 PDF/Word/TXT，或改用 Claude Code / Codex 模式）` };
  }
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + `\n\n（……文件过长，已截取前 ${MAX_CHARS} 字）`;
  }
  return { ok: true, text };
}

// 给「自有 API」模式用：把附件转成纯文本塞进对话。CLI 模式下智能体自己读文件，不走这里。
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const MAX_CHARS = 60000;
const TEXT_EXT = new Set(['.txt', '.md', '.csv', '.tsv', '.json', '.xml', '.html', '.htm', '.log', '.yaml', '.yml']);
const TEXTUTIL_EXT = new Set(['.docx', '.doc', '.rtf', '.odt', '.wordml', '.webarchive']);

const run = (cmd, args) => new Promise((resolve, reject) => {
  execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, timeout: 60000 }, (err, stdout) =>
    err ? reject(err) : resolve(stdout));
});

export async function extractText(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  let text;
  if (TEXT_EXT.has(ext)) {
    text = fs.readFileSync(absPath, 'utf8');
  } else if (TEXTUTIL_EXT.has(ext) && process.platform === 'darwin') {
    text = await run('textutil', ['-convert', 'txt', '-stdout', absPath]);
  } else if (ext === '.pdf') {
    try {
      text = await run('pdftotext', ['-layout', '-enc', 'UTF-8', absPath, '-']);
    } catch {
      return { ok: false, text: '（无法读取 PDF：请先安装 poppler，命令 brew install poppler）' };
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

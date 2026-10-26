// 轻量 Markdown 渲染：标题、列表（可嵌套）、表格、引用、代码块、行内格式。
// 不依赖外部库，离线可用；所有文本先转义，不会执行模型输出里的 HTML。

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text) {
  const slots = [];
  const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = text.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, t, href) => {
    const ok = /^(https?:|mailto:|\/|#|\.)/i.test(href);
    return ok ? keep(`<a href="${href}" target="_blank" rel="noopener">${t}</a>`) : t;
  });
  s = s.replace(/(^|[\s(（])(https?:\/\/[^\s<)）]+)/g, (_, pre, url) => pre + keep(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`));
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+?)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[i]);
}

const RE = {
  fence: /^\s*(```|~~~)\s*([\w+-]*)/,
  heading: /^(#{1,6})\s+(.*?)\s*#*\s*$/,
  hr: /^\s*([-*_])(\s*\1){2,}\s*$/,
  quote: /^\s*>\s?/,
  list: /^(\s*)([-*+]|\d+[.)])\s+(.*)$/,
  tableSep: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
};

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

function renderList(lines) {
  // lines: [{indent, ordered, text}]
  let html = '';
  const stack = [];
  for (const item of lines) {
    while (stack.length && item.indent < stack[stack.length - 1].indent) {
      html += `</li></${stack.pop().tag}>`;
    }
    let top = stack[stack.length - 1];
    if (top && item.indent === top.indent && top.tag !== (item.ordered ? 'ol' : 'ul')) {
      html += `</li></${stack.pop().tag}>`;
      top = stack[stack.length - 1];
    }
    if (!top || item.indent > top.indent) {
      const tag = item.ordered ? 'ol' : 'ul';
      const start = item.ordered && item.num > 1 ? ` start="${item.num}"` : '';
      html += `<${tag}${start}>`;
      stack.push({ indent: item.indent, tag });
    } else {
      html += '</li>';
    }
    const task = item.text.match(/^\[([ xX])\]\s+(.*)$/);
    html += task
      ? `<li class="task"><span class="cb${task[1] !== ' ' ? ' on' : ''}"></span>${inline(task[2])}`
      : `<li>${inline(item.text)}`;
  }
  while (stack.length) html += `</li></${stack.pop().tag}>`;
  return html;
}

export function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let i = 0;
  const isBlockStart = (l, next) => RE.fence.test(l) || RE.heading.test(l) || RE.hr.test(l) ||
    RE.quote.test(l) || RE.list.test(l) || (l.includes('|') && next !== undefined && RE.tableSep.test(next));

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(RE.fence))) {
      const fence = m[1];
      const lang = m[2] || '';
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i++]);
      i++;
      html += `<pre class="code" data-lang="${esc(lang)}"><code class="language-${esc(lang)}">${esc(body.join('\n'))}</code></pre>`;
      continue;
    }
    if ((m = line.match(RE.heading))) {
      const level = Math.min(m[1].length + 1, 6); // 模型的 # 当二级标题用，避免过大
      html += `<h${level}>${inline(m[2])}</h${level}>`;
      i++;
      continue;
    }
    if (RE.hr.test(line)) { html += '<hr>'; i++; continue; }
    if (RE.quote.test(line)) {
      const body = [];
      while (i < lines.length && lines[i].trim() && RE.quote.test(lines[i])) body.push(lines[i++].replace(RE.quote, ''));
      html += `<blockquote>${renderMarkdown(body.join('\n'))}</blockquote>`;
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      const cell = (tag, c, k) => `<${tag}${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${inline(c || '')}</${tag}>`;
      html += '<div class="table-wrap"><table><thead><tr>' + head.map((c, k) => cell('th', c, k)).join('') + '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + head.map((_, k) => cell('td', r[k], k)).join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    if (RE.list.test(line)) {
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const lm = l.match(RE.list);
        if (lm) {
          items.push({ indent: lm[1].replace(/\t/g, '    ').length, ordered: /\d/.test(lm[2]), num: parseInt(lm[2], 10) || 1, text: lm[3] });
          i++;
        } else if (l.trim() && /^\s{2,}/.test(l) && items.length) {
          items[items.length - 1].text += ' ' + l.trim();
          i++;
        } else if (!l.trim() && i + 1 < lines.length && RE.list.test(lines[i + 1])) {
          i++;
        } else break;
      }
      html += renderList(items);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i], lines[i + 1]))) para.push(lines[i++]);
    html += `<p>${para.map(inline).join('<br>')}</p>`;
  }
  return html;
}

// 自有 API：OpenAI 兼容接口（DeepSeek、Kimi、通义、智谱、OpenRouter、Ollama……）和 Anthropic Messages 接口。
// 这种模式是纯对话，不会读写本地文件；附件会先被转成文字放进消息里。

export async function* sseLines(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      yield line;
    }
  }
  if (buf) yield buf;
}

async function httpError(res) {
  let body = '';
  try { body = await res.text(); } catch {}
  try {
    const j = JSON.parse(body);
    body = j.error?.message || j.message || j.error || body;
  } catch {}
  const hint = res.status === 401 || res.status === 403 ? '（API Key 无效或没有权限）'
    : res.status === 404 ? '（接口地址或模型名称不对）'
    : res.status === 429 ? '（请求过于频繁或额度不足）' : '';
  return new Error(`API 返回 ${res.status}${hint}：${String(body).slice(0, 500)}`);
}

function joinUrl(base, suffix) {
  base = base.replace(/\/+$/, '');
  return base.endsWith(suffix) ? base : base + suffix;
}

export async function runOpenAI({ provider, model, systemPrompt, messages }, emit, signal) {
  const url = joinUrl(provider.baseUrl || 'https://api.openai.com/v1', '/chat/completions');
  const headers = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers.Authorization = 'Bearer ' + provider.apiKey;
  const res = await fetch(url, {
    method: 'POST', headers, signal,
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) throw await httpError(res);
  emit({ t: 'status', d: '已连接 ' + provider.name });
  for await (const line of sseLines(res)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') break;
    let j;
    try { j = JSON.parse(data); } catch { continue; }
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    const delta = j.choices?.[0]?.delta || {};
    if (delta.reasoning_content || delta.reasoning) emit({ t: 'status', d: '思考中…' });
    if (delta.content) emit({ t: 'text', d: delta.content });
  }
  return {};
}

export async function runAnthropic({ provider, model, systemPrompt, messages }, emit, signal) {
  const url = joinUrl(provider.baseUrl || 'https://api.anthropic.com', '/v1/messages');
  const res = await fetch(url.replace(/\/v1\/v1\//, '/v1/'), {
    method: 'POST', signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: provider.maxTokens || 8192,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });
  if (!res.ok) throw await httpError(res);
  emit({ t: 'status', d: '已连接 ' + provider.name });
  for await (const line of sseLines(res)) {
    if (!line.startsWith('data:')) continue;
    let j;
    try { j = JSON.parse(line.slice(5).trim()); } catch { continue; }
    if (j.type === 'error') throw new Error(j.error?.message || 'API 错误');
    if (j.type === 'content_block_delta') {
      if (j.delta?.type === 'text_delta') emit({ t: 'text', d: j.delta.text });
      else if (j.delta?.type === 'thinking_delta') emit({ t: 'status', d: '思考中…' });
    }
    if (j.type === 'message_delta' && j.delta?.stop_reason === 'max_tokens') {
      emit({ t: 'notice', d: '回答达到最大长度被截断，可以回复「继续」。' });
    }
  }
  return {};
}

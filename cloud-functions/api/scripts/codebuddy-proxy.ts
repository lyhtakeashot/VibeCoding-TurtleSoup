/**
 * CodeBuddy 本地 AI 代理（简化版）
 *
 * 启动一个本地 OpenAI 兼容 API，使用 CodeBuddy IDE 的认证 token
 * 直接调用 API，消耗 IDE 的 AI 积分。
 *
 * 启动方式：
 *   npx tsx server/src/scripts/codebuddy-proxy.ts
 *
 * 注意：需要 CodeBuddy IDE 正在运行且已登录
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = parseInt(process.env.PROXY_PORT || '11435', 10);

const CODEBUDDY_API = 'https://copilot.tencent.com/v2/chat/completions';

function getIDEToken(): { token: string; uid: string } | null {
  const authPath = path.join(
    os.homedir(),
    'AppData/Local/CodeBuddyExtension/Data/Public/auth/workbuddy-desktop.info',
  );
  try {
    const raw = fs.readFileSync(authPath, 'utf-8');
    const data = JSON.parse(raw);
    const token = data.auth?.accessToken;
    const uid = data.account?.uid;
    if (!token || token.length < 100) return null;
    return { token, uid: uid || 'unknown' };
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || '/';

  if (req.method === 'GET' && url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [{ id: 'codebuddy-default', object: 'model', created: Date.now(), owned_by: 'codebuddy' }],
    }));
    return;
  }

  if (req.method === 'POST' && url === '/v1/chat/completions') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      const messages = parsed.messages || [];
      const streamFlag = parsed.stream === true;

      const auth = getIDEToken();
      if (!auth) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: { message: '无法读取 CodeBuddy IDE 认证。请确保 IDE 已登录并运行。' },
        }));
        return;
      }

      const resp = await fetch(CODEBUDDY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
          'X-User-Id': auth.uid,
        },
        body: JSON.stringify({
          model: 'deepseek-v3-2-volc',
          messages,
          stream: streamFlag,
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.error('[codebuddy-proxy] API 错误:', resp.status, errText.slice(0, 200));
        res.writeHead(resp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `API 错误 ${resp.status}`, type: 'api_error' } }));
        return;
      }

      if (streamFlag && resp.body) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        const reader = resp.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        // 非流式：收集所有块后返回
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let fullText = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') continue;
              try {
                const p = JSON.parse(data);
                const c = p?.choices?.[0]?.delta?.content;
                if (c) fullText += c;
              } catch { /* skip */ }
            }
          }
          res.end(JSON.stringify({
            id: 'cb-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'codebuddy-builtin',
            choices: [{ index: 0, message: { role: 'assistant', content: fullText }, finish_reason: 'stop' }],
          }));
        } else {
          res.end(JSON.stringify({ error: { message: 'No response body' } }));
        }
      }
    } catch (e: any) {
      console.error('[codebuddy-proxy] 错误:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: e.message || '内部错误', type: 'server_error' } }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

server.listen(PORT, () => {
  console.log(`[codebuddy-proxy] 本地 AI 代理已启动 → http://localhost:${PORT}/v1`);
  console.log('[codebuddy-proxy] 使用 CodeBuddy IDE 认证 token');
});

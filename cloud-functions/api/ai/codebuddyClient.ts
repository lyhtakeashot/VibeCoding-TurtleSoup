/**
 * CodeBuddy 内置 AI 客户端（测试模式专用）
 *
 * 直接使用 CodeBuddy IDE 的认证 token 调用 API，
 * 消耗 IDE 的 AI 积分，无需配置任何外部 API Key。
 *
 * API 端点: https://copilot.tencent.com/v2/chat/completions
 * Token 来源: %LOCALAPPDATA%/CodeBuddyExtension/Data/Public/auth/workbuddy-desktop.info
 */
import { config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

interface AuthData {
  auth?: {
    accessToken?: string;
    expiresAt?: number;
  };
  account?: {
    uid?: string;
    nickname?: string;
  };
}

/** CodeBuddy CN v2 API 地址 */
const CODEBUDDY_API = 'https://copilot.tencent.com/v2/chat/completions';

/**
 * 从 IDE 的认证文件中读取 access token
 */
function getIDEAuthToken(): { token: string; uid: string } | null {
  const authPath = path.join(
    os.homedir(),
    'AppData/Local/CodeBuddyExtension/Data/Public/auth/workbuddy-desktop.info',
  );

  try {
    const raw = fs.readFileSync(authPath, 'utf-8');
    const data: AuthData = JSON.parse(raw);
    const token = data.auth?.accessToken;
    const uid = data.account?.uid;

    if (!token || token.length < 100) return null;

    // 检查 token 是否过期
    const expiresAt = data.auth?.expiresAt;
    if (expiresAt && Date.now() > expiresAt) {
      console.warn('[codebuddy] Token 已过期，请重新登录 IDE');
      return null;
    }

    return { token, uid: uid || 'unknown' };
  } catch {
    return null;
  }
}

/**
 * 流式调用 CodeBuddy CN API
 * 注意：该 API 仅支持流式 (stream: true)
 */
async function* callCodeBuddyStream(
  messages: ChatMessage[],
  token: string,
  uid: string,
): AsyncGenerator<string> {
  const resp = await fetch(CODEBUDDY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-User-Id': uid,
    },
    body: JSON.stringify({
      model: 'deepseek-v3-2-volc',
      messages,
      stream: true,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`CodeBuddy API 返回 ${resp.status}: ${errText.slice(0, 200)}`);
  }

  if (!resp.body) throw new Error('无响应体');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

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
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed?.choices?.[0]?.delta?.content;
        if (content) yield String(content);
      } catch {
        /* 跳过非 JSON 行 */
      }
    }
  }
}

/**
 * 流式调用 CodeBuddy AI
 */
export async function* streamCodeBuddy(messages: ChatMessage[]): AsyncGenerator<string> {
  if (!config.testMode) {
    throw new Error('CodeBuddy 测试模式未开启，请检查配置');
  }

  // 读取 IDE 认证 token
  const auth = getIDEAuthToken();
  if (!auth) {
    throw new Error(
      '无法读取 CodeBuddy IDE 的认证信息。\n' +
        '请确保 CodeBuddy IDE 正在运行且已登录。\n' +
        '或者：在设置中配置外部 API Key（如 DeepSeek）并关闭测试模式。',
    );
  }

  console.log(`[codebuddy] 使用 IDE 账户调用 API (uid: ${auth.uid})`);

  try {
    yield* callCodeBuddyStream(messages, auth.token, auth.uid);
  } catch (err: any) {
    console.error('[codebuddy] 流式调用失败:', err.message);
    throw new Error(
      `CodeBuddy AI 调用失败: ${err.message}\n` +
        '请确保 CodeBuddy IDE 正在运行且已登录。\n' +
        '或者：在设置中配置外部 API Key（如 DeepSeek）并关闭测试模式。',
    );
  }
}

/**
 * 直接调用 CodeBuddy API（供 puzzleGenerator 等使用）
 * 由于该 API 仅支持流式，内部收集所有流式块后返回完整文本包装为兼容格式
 */
export async function callCodeBuddyDirect(
  messages: ChatMessage[],
  _stream: boolean = false,
): Promise<Response | null> {
  const auth = getIDEAuthToken();
  if (!auth) return null;

  try {
    let fullText = '';
    for await (const chunk of callCodeBuddyStream(messages, auth.token, auth.uid)) {
      fullText += chunk;
    }

    if (!fullText) return null;

    // 包装为 OpenAI 兼容格式
    const body = JSON.stringify({
      id: 'codebuddy-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'codebuddy-builtin',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: fullText },
          finish_reason: 'stop',
        },
      ],
    });

    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[codebuddy] callCodeBuddyDirect 失败:', err.message);
    return null;
  }
}

/**
 * 检查 CodeBuddy 是否可用
 */
export function isCodeBuddyAvailable(): boolean {
  const auth = getIDEAuthToken();
  return auth !== null;
}

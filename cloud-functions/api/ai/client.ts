import { config } from '../config.js';
import type { Puzzle, QAItem, AnswerKind } from '../types.js';
import { buildHostMessages, buildJudgeMessages } from './prompts.js';
import { streamCodeBuddy } from './codebuddyClient.js';

function getAIRequest() {
  return {
    baseURL: config.ai.baseURL.replace(/\/+$/, ''),
    apiKey: config.ai.apiKey,
    model: config.ai.model,
  };
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** 流式调用 OpenAI 兼容 API，逐块产出文本（带非流式兜底） */
async function* streamAI(messages: ChatMessage[]): AsyncGenerator<string> {
  // 测试模式：使用 CodeBuddy 内置 AI
  if (config.testMode) {
    yield* streamCodeBuddy(messages);
    return;
  }

  const { baseURL, apiKey, model } = getAIRequest();
  const url = `${baseURL}/chat/completions`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API 返回 ${resp.status}: ${errText.slice(0, 200)}`);
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
          if (content) yield content;
        } catch {
          // 跳过非 JSON 行
        }
      }
    }
  } catch {
    // 流式失败，退化为非流式
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API 返回 ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (text) yield text;
  }
}

/**
 * 解析 AI 回复中提取答案词和贡献度评分
 * 期望格式：「答案词|贡献度」如 是|0.8 不是|0.2 无关|0
 * 宽松匹配：允许管道符两侧有空格，允许末尾带句号
 * 若格式不匹配则兜底：根据答案词估算默认贡献度
 */
function parseAnswerWithScore(text: string): { answer: AnswerKind; progressGain: number } {
  const t = text.trim();

  // 尝试匹配「答案词|分数」格式（宽松：允许空格和末尾标点）
  const pipeMatch = t.match(/^(是|不是|是也不是|无关)\s*\|\s*(\d+(?:\.\d+)?)\s*[。.]?\s*$/);
  if (pipeMatch) {
    const score = parseFloat(pipeMatch[2]);
    return {
      answer: parseAnswerKind(pipeMatch[1]),
      // 贡献度 0~100，只做非负保底，不设上限
      progressGain: Math.max(0, score),
    };
  }

  // 兜底：仅解析答案词，根据答案类型估算贡献度
  const answer = parseAnswerKind(t);
  let progressGain = 10; // 默认为合理问题基线（10%）
  if (answer === 'irrelevant') {
    progressGain = 0;
  } else if (answer === 'partial') {
    progressGain = 12;
  }
  return { answer, progressGain };
}

function parseAnswerKind(text: string): AnswerKind {
  const t = text.trim();

  // 精确匹配四选一
  if (t === '是' || t === '是。') return 'yes';
  if (t === '不是' || t === '不是。') return 'no';
  if (t === '是也不是' || t === '是也不是。') return 'partial';
  if (t === '无关' || t === '无关。') return 'irrelevant';

  // 前缀匹配（AI 可能补了额外文字）
  if (/^是也不是/.test(t)) return 'partial';
  if (/^部分是/.test(t)) return 'partial';
  if (/^不是/.test(t)) return 'no';
  if (/^否/.test(t)) return 'no';
  if (/^无关/.test(t)) return 'irrelevant';
  if (/^是[^也]/.test(t)) return 'yes';  // 以"是"开头但不是"是也不是"

  // 尝试从任意位置提取
  if (t.includes('是也不是') || t.includes('部分是')) return 'partial';
  if (t.includes('不是')) return 'no';
  if (t.includes('无关')) return 'irrelevant';
  if (t.includes('是') && t.length <= 5) return 'yes';  // 短文本中的"是"

  // 英文兜底
  if (/^(yes|yep|right|correct)/i.test(t)) return 'yes';
  if (/^(no|nope|wrong)/i.test(t)) return 'no';

  return 'partial';  // 无法识别时给"是也不是"（比"无关"好）
}

export async function answerWithAI(
  puzzle: Puzzle,
  question: string,
  history: QAItem[] = [],
): Promise<{ answer: AnswerKind; note: string; progressGain: number }> {
  const messages = buildHostMessages(puzzle, question, history);
  let buf = '';
  for await (const piece of streamAI(messages)) {
    buf += piece;
  }
  console.log('[ai] 提问:', question.slice(0, 50));
  console.log('[ai] AI 原始回复:', buf.slice(0, 100));
  const { answer, progressGain } = parseAnswerWithScore(buf);
  console.log('[ai] 解析结果:', answer, '贡献度:', progressGain);
  return { answer, note: '', progressGain };
}

/** 重置 AI 客户端 */
export function resetAIClient(): void {
  // 无状态，fetch 每次都是新的
}

export async function judgeWithAI(
  puzzle: Puzzle,
  guess: string,
): Promise<{ correct: boolean; feedback: string; source: 'ai' }> {
  const messages = buildJudgeMessages(puzzle, guess);
  let buf = '';
  for await (const piece of streamAI(messages)) {
    buf += piece;
  }
  try {
    const jsonMatch = buf.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { correct: Boolean(parsed.correct), feedback: String(parsed.feedback || ''), source: 'ai' };
    }
  } catch {
    /* 解析失败走下方兜底 */
  }
  return { correct: false, feedback: buf.slice(0, 200), source: 'ai' };
}

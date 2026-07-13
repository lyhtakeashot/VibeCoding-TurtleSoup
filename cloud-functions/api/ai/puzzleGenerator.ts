import type { Puzzle, Difficulty } from '../types.js';
import { config } from '../config.js';
import { callCodeBuddyDirect } from './codebuddyClient.js';

const BATCH_PARSE_PROMPT = `你是一位海龟汤（情境推理）题目结构化助手。
用户会输入多道海龟汤题目，每道题格式固定：

题目
汤面：...（悬疑描述）
汤底：...（真相解释）

输入按顺序排列，系统自动编号。请逐题提取信息并补全，输出严格 JSON 数组，每道题按输入顺序排列，每个元素为：
{
  "title": "简短标题（10字以内，根据汤面概括）",
  "surface": "汤面（悬疑描述，1-3句话，保持悬念感）",
  "solution": "汤底（合理合理解释真相）",
  "difficulty": "easy/medium/hard/unlimited（根据故事复杂度与反转度推断）",
  "tags": ["悬疑", "反转"等标签数组，常用标签：悬疑、反转、温情、脑洞、微恐、推理、日常、诡异],
  "hints": ["渐进提示1（模糊）", "提示2（较具体）", "提示3（几乎剧透）"]
}

要求：
- 每道题至少提供 1 条提示（hints）
- 如果汤面或汤底表达不完整，在保持原意的前提下润色优化
- 标签必须从常用标签中选择 1-3 个
- 输出顺序必须与输入顺序一致
- 严格只输出 JSON 数组，不含任何其他文字`;

const GENERATE_PROMPT = `你是一位海龟汤（情境推理）游戏题目设计师。请生成一道悬疑推理题目。

要求：
1. 汤面（surface）要简短、悬疑、有冲击力，1-3句话，留下关键信息缺口。
2. 汤底（solution）要合理解释汤面的悬疑点，逻辑自洽。
3. 提供 3 个渐进式提示（hints），从模糊到具体。
4. 标注难度（easy/medium/hard/unlimited）和标签（tags），标签如：推理、悬疑、温情、反转、脑洞等。
5. 仅输出 JSON，不要其他文字。

输出格式严格如下：
{
  "title": "简短标题（10字以内）",
  "surface": "汤面内容",
  "solution": "汤底真相",
  "difficulty": "medium",
  "tags": ["推理", "悬疑"],
  "hints": ["提示1", "提示2", "提示3"]
}`;

function getAIRequest() {
  return {
    baseURL: config.ai.baseURL.replace(/\/+$/, ''),
    apiKey: config.ai.apiKey,
    model: config.ai.model,
  };
}

export async function generatePuzzle(): Promise<{
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  tags: string[];
  hints: string[];
} | null> {
  if (!config.useAI) {
    console.warn('[puzzleGenerator] AI 未启用，无法生成题目');
    return null;
  }

  try {
    let data: any;

    if (config.testMode) {
      // 测试模式：使用 CodeBuddy 内置 AI
      const resp = await callCodeBuddyDirect(
        [
          { role: 'system', content: GENERATE_PROMPT },
          { role: 'user', content: '请生成一道海龟汤题目。' },
        ],
        false,
      );
      if (!resp) {
        console.error('[puzzleGenerator] CodeBuddy 内置 AI 不可用');
        return null;
      }
      data = await resp.json();
    } else {
      // 外部 API 模式
      const { baseURL, apiKey, model } = getAIRequest();
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: GENERATE_PROMPT },
            { role: 'user', content: '请生成一道海龟汤题目。' },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!resp.ok) {
        console.error('[puzzleGenerator] API 返回错误:', resp.status);
        return null;
      }

      data = await resp.json();
    }
    const text: string = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[puzzleGenerator] 未找到 JSON 响应:', text.slice(0, 200));
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // 校验必要字段
    if (!parsed.surface || !parsed.solution) {
      console.error('[puzzleGenerator] 响应缺少必要字段');
      return null;
    }

    // 规范化难度
    const difficulty: Difficulty =
      ['easy', 'medium', 'hard', 'unlimited'].includes(parsed.difficulty) ? parsed.difficulty : 'medium';

    return {
      title: String(parsed.title || parsed.surface.slice(0, 10)),
      surface: String(parsed.surface),
      solution: String(parsed.solution),
      difficulty,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      hints: Array.isArray(parsed.hints) ? parsed.hints.map(String) : [],
    };
  } catch (e) {
    console.error('[puzzleGenerator] 生成失败:', (e as Error).message);
    return null;
  }
}

/** 重置题目生成器（无状态，保留接口兼容） */
export function resetGeneratorClient(): void {
  // 无状态
}

export async function generatePuzzleBatch(count: number = 10): Promise<Puzzle[]> {
  const results: Puzzle[] = [];
  for (let i = 0; i < count; i++) {
    console.log(`[puzzleGenerator] 生成第 ${i + 1}/${count} 道题...`);
    const p = await generatePuzzle();
    if (p) {
      const puzzle: Puzzle = {
        id: `gen_${Date.now()}_${i}`,
        title: p.title,
        surface: p.surface,
        solution: p.solution,
        difficulty: p.difficulty,
        maxQuestions: ({ easy: 20, medium: 30, hard: 40, unlimited: 999 } as Record<string, number>)[p.difficulty],
        tags: p.tags,
        hints: p.hints,
        author: 'AI 生成',
        createdAt: Date.now(),
      };
      results.push(puzzle);
    }
    // 避免频率限制
    if (i < count - 1) await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`[puzzleGenerator] 完成，成功生成 ${results.length}/${count} 道题`);
  return results;
}

/** 纯规则解析：从结构化文本中提取汤面/汤底，不依赖 AI */
function parseByRules(raw: string): Array<{
  title: string;
  surface: string;
  solution: string;
}> {
  const results: Array<{ title: string; surface: string; solution: string }> = [];

  // 按 《 或 题目 分割每个题
  const blocks = raw.split(/(?=(?:《|题目\s*(?:\d+|：|:)))/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // 提取标题：《标题》 或 题目1 / 题目：
    let title = '';
    const titleMatch = trimmed.match(/《(.+?)》/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      const numTitleMatch = trimmed.match(/^题目\s*(\d*)\s*[：:]*\s*/);
      if (numTitleMatch) {
        title = numTitleMatch[1] ? `题目${numTitleMatch[1]}` : '';
      }
    }

    // 提取汤面：汤面[：:] 到 汤底[：:] 之间
    const surfaceMatch = trimmed.match(/汤面\s*[：:]\s*([\s\S]*?)\s*(?=汤底\s*[：:]|$)/);
    // 提取汤底：汤底[：:] 到最后
    const solutionMatch = trimmed.match(/汤底\s*[：:]\s*([\s\S]*?)$/);

    const surface = surfaceMatch ? surfaceMatch[1].trim() : '';
    const solution = solutionMatch ? solutionMatch[1].trim() : '';

    if (surface && solution) {
      results.push({ title, surface, solution });
      console.log(`[parseByRules] 解析成功: "${title || '(无标题)'}"`);
    }
  }

  console.log(`[parseByRules] 共解析出 ${results.length} 道题`);
  return results;
}

/** 批量解析玩家输入的原始文本，优先使用规则解析，失败则回退到 AI */
export async function parseBatchPuzzles(rawText: string): Promise<{
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  tags: string[];
  hints: string[];
}[]> {
  // === 第一步：尝试纯规则解析（不依赖 AI） ===
  const ruleResults = parseByRules(rawText);
  if (ruleResults.length > 0) {
    console.log(`[parseBatchPuzzles] 规则解析成功，跳过 AI 调用（共 ${ruleResults.length} 题）`);
    return ruleResults.map((item, idx) => ({
      title: item.title || `题目${idx + 1}`,
      surface: item.surface,
      solution: item.solution,
      difficulty: 'medium' as Difficulty,
      tags: ['悬疑'],
      hints: ['这道题可能跟日常生活中被忽略的细节有关'],
    }));
  }

  // === 第二步：规则解析失败，尝试 AI 解析 ===
  if (!config.useAI) {
    throw new Error('AI 功能未启用，且无法通过规则解析文本。请确认输入格式：每道题包含《标题》、汤面：和汤底：。');
  }

  let text: string;

  if (config.testMode) {
    // 测试模式：使用 CodeBuddy 内置 AI
    const resp = await callCodeBuddyDirect(
      [
        { role: 'system', content: BATCH_PARSE_PROMPT },
        { role: 'user', content: rawText },
      ],
      false,
    );
    if (!resp) {
      throw new Error('CodeBuddy 内置 AI 连接失败，请确保 CodeBuddy IDE 已登录并运行。');
    }
    const data = await resp.json();
    text = data?.choices?.[0]?.message?.content || '';
  } else {
    // 外部 API 模式
    const { baseURL, apiKey, model } = getAIRequest();

    const resp = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: BATCH_PARSE_PROMPT },
          { role: 'user', content: rawText },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[batchParse] API 返回错误:', resp.status, errText.slice(0, 300));
      throw new Error(`AI API 调用失败（状态码 ${resp.status}），请检查 API 配置。`);
    }

    const data = await resp.json();
    text = data?.choices?.[0]?.message?.content || '';
  }
  if (!text) {
    throw new Error('AI 返回了空内容，请稍后重试。');
  }

  // 尝试多种匹配策略：完整数组、代码块中的数组
  let jsonStr = '';
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];
  }

  if (!jsonStr) {
    console.error('[batchParse] 未找到 JSON 数组响应:', text.slice(0, 500));
    throw new Error('AI 返回格式异常，请尝试精简输入内容后重试。');
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error('[batchParse] JSON 解析失败:', jsonStr.slice(0, 300));
    throw new Error('AI 返回内容无法解析，请稍后重试。');
  }

  if (!Array.isArray(parsed)) {
    console.error('[batchParse] 响应不是数组:', typeof parsed);
    throw new Error('AI 返回了意外的数据格式，请稍后重试。');
  }

  if (parsed.length === 0) {
    throw new Error('未识别出任何题目，请确认输入格式：每道题以「题目」开头，依次填写「汤面：」和「汤底：」。');
  }

  return parsed.map((item: any) => ({
    title: String(item.title || item.surface?.slice(0, 10) || ''),
    surface: String(item.surface || ''),
    solution: String(item.solution || ''),
    difficulty: (['easy', 'medium', 'hard', 'unlimited'].includes(item.difficulty) ? item.difficulty : 'medium') as Difficulty,
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    hints: Array.isArray(item.hints) ? item.hints.map(String) : [],
  }));
}

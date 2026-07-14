import type { Puzzle, QAItem } from '../types.js';

/**
 * 主持人系统提示：严格约束 AI 只输出四个标准答案之一。
 * 绝不主动泄露汤底，仅在玩家明确「揭晓/真相是什么」时才简述结局。
 */
export function buildHostSystemPrompt(puzzle: Puzzle): string {
  return `你是一款「海龟汤（情境推理）」游戏的主持人。

当前汤面：${puzzle.surface}

汤底真相（你需要严格依据这个真相来判断玩家的每个问题，但绝不能主动透露）：
${puzzle.solution}

严格的回答规则（极其重要）：
1. 你的回复必须严格按照固定格式「答案词|贡献度」，不得输出任何其他内容（连标点都不要加）：
   答案词必须是以下四个之一：是、不是、是也不是、无关
   贡献度是0~100之间的数字（整数或小数均可），表示这个问题让玩家额外理解了真相的百分之多少：
   - 满分100分代表这一问彻底揭开整个故事真相
   
   给分参考（按实际对理解真相的贡献百分比评估）：
   - 0：完全无关（闲聊、重复问题、与故事毫无逻辑关联）
   - 2~8：弱问题（模糊笼统、仅涉及边缘信息、对理解帮助很小）
   - 8~15：合理问题（明确涉及人物、地点、事件等故事要素）
   - 15~30：好问题（触及关键线索、人物动机或重要情节）
   - 30~50+：关键突破（揭示核心诡计或故事关键反转。例如：发现双线叙事、时间循环、人格分裂、视角切换、时间流速不同、交换杀人、叙述性诡计等任何让故事豁然开朗的核心诡计）
   
   关键原则：
   - 正常且与故事相关的问题，起评分至少8
   - 揭示谜题"钥匙"的问题大胆给高分！只要某个问题的发现能让后续推理迎刃而解（例如看破时间循环、识别人格分裂、察觉双线叙事、发现视角切换、揭示时间流速不同等关键诡计），应给到20~35分
   - 每个问题独立评估，不要因为前面给过高分就压低当前问题的分数
   - 答案词为「无关」时，贡献度必须为0
   
   示例输出：是|12、不是|3、是也不是|15、无关|0、是|30
2. 不得输出任何解释性文字，严格按格式回复，连标点符号都不要加。
3. 绝不能在揭晓前主动说出完整汤底/真相。
4. 仅当玩家明确说「揭示/真相/汤底/结局是什么」时，你才可以回复整段真相。
5. 语义重复检测：如果当前问题与对话历史中已问过的某个问题在语义上完全相同（问的是同一件事，只是换了说法），必须回答「无关|0」。
   判断标准：只要两个问题指向同一核心事实、答案可以由之前的回答直接推导出来，就应视为重复。
   示例：
   - "他死了吗" 与 "他还活着吗" → 重复（都问生死状态）
   - "凶手是男人吗" 与 "凶手是女性吗" → 重复（都问性别）
   - "发生在白天吗" 与 "是晚上发生的吗" → 重复（都问时间）
   - "用的是刀吗" 与 "凶器是刀吗" → 重复（都问凶器）`;
}

export function buildHostMessages(
  puzzle: Puzzle,
  question: string,
  history: QAItem[] = [],
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: buildHostSystemPrompt(puzzle) },
  ];
  // 仅携带最近若干轮作为上下文，回答仅记录答案词
  const recent = history.slice(-12);
  for (const qa of recent) {
    messages.push({ role: 'user', content: qa.question });
    messages.push({ role: 'assistant', content: labelOf(qa.answer) });
  }
  messages.push({ role: 'user', content: question });
  return messages;
}

function labelOf(a: QAItem['answer']): string {
  return a === 'yes' ? '是' : a === 'no' ? '不是' : a === 'partial' ? '是也不是' : '无关';
}

export function buildJudgeSystemPrompt(puzzle: Puzzle): string {
  return `你是海龟汤游戏的裁判。给定汤底真相与玩家的最终推理，判断玩家是否猜中。

汤面：${puzzle.surface}
汤底真相：${puzzle.solution}

请仅输出 JSON，格式：{"correct": true|false, "feedback": "给玩家的简短点评，若正确则复述真相，若错误则点出偏差"}`;
}

export function buildJudgeMessages(
  puzzle: Puzzle,
  guess: string,
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  return [
    { role: 'system', content: buildJudgeSystemPrompt(puzzle) },
    { role: 'user', content: `玩家的推理：${guess}` },
  ];
}

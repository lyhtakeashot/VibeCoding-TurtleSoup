import express from 'express';
import crypto from 'node:crypto';
import { getStore } from '@edgeone/pages-blob';

// ──────────────────────────────────────────────
//  Embedded Puzzle Data (read-only)
// ──────────────────────────────────────────────
const BASE_PUBLISH_DATE = Date.UTC(2025, 8, 1);

const PUZZLES = [
  {
    id: 'p1',
    title: '海边的独行者',
    surface: '一个男人来到海边，脱下鞋子走进海里，再也没出来。人们后来发现他其实并不会游泳，但他脸上带着微笑。请问发生了什么？',
    solution: '这个男人是一名绝症晚期患者，他选择在海边安静地结束自己的生命，所以面带微笑、并无挣扎；他不会游泳，海水成了他解脱的方式。',
    difficulty: 'easy',
    maxQuestions: 20,
    tags: ['悬疑', '温情', '现实'],
    hints: [
      '注意「不会游泳却走进海里」这个矛盾点。',
      '他并不害怕，反而微笑——说明这是他自己的选择。',
      '结合「绝症」线索：他是在用一种平静的方式解脱。',
    ],
  },
  {
    id: 'p2',
    title: '空荡的餐厅',
    surface: '一家餐厅在晚餐时间座无虚席，却没有任何人动筷子吃饭。服务员也不催促。请问为什么？',
    solution: '这是一家「网红打卡」主题餐厅，当天的活动是「静止挑战/行为艺术」，所有顾客是来参与沉浸式演出的演员与观众，餐桌只是布景，所以没人真正用餐。',
    difficulty: 'easy',
    maxQuestions: 20,
    tags: ['反转', '日常', '脑洞'],
    hints: [
      '「座无虚席却不动筷子」——重点在「为什么不需要吃」。',
      '服务员不催，说明这种「不吃」是被允许的常态。',
      '想想「网红/沉浸体验」：人可能是来「演」的。',
    ],
  },
  {
    id: 'p3',
    title: '雨夜的伞',
    surface: '深夜下着大雨，一个女孩撑着伞走在街上，浑身却湿透了。她没有哭，神情平静。请问为什么？',
    solution: '女孩撑的伞是坏的（或她把伞让给了路边躲雨的陌生人），她自己淋在雨里；她平静是因为刚帮完别人，内心满足。另一种常见真相：她撑伞是为了遮挡路灯摄像头，而非挡雨。',
    difficulty: 'medium',
    maxQuestions: 30,
    tags: ['温情', '反转', '日常'],
    hints: [
      '「撑伞却湿透」——伞的存在反而成了谜。',
      '她不哭不委屈，说明湿透是她「愿意」的。',
      '结合「让伞给陌生人」：湿透源于善意。',
    ],
  },
  {
    id: 'p4',
    title: '停电的电梯',
    surface: '办公大楼突然停电，一部电梯停在两层之间。里面的人按了求救铃，救援人员赶到后却说：「你们运气真好。」请问为什么？',
    solution: '电梯其实停在两层楼之间的极窄缝隙，但如果它再下降几厘米就会卡死或坠入井道底端危险区；救援人员发现它恰好悬在结构横梁上，加上当时是火灾导致停电，若电梯继续运行会被浓烟困住，所以停在半空反而保命。',
    difficulty: 'medium',
    maxQuestions: 30,
    tags: ['悬疑', '惊险', '推理'],
    hints: [
      '「运气真好」是反直觉的——通常困电梯是倒霉。',
      '停电的原因很关键，想想大楼里还有什么危险。',
      '停在半空而非运行，恰好避开了更大的灾难。',
    ],
  },
  {
    id: 'p5',
    title: '不说话的乘客',
    surface: '一辆长途巴士上，一名乘客全程一言不发，司机却每隔一会儿就回头看他一眼，面带笑意。到站后乘客下了车，司机明显松了口气。请问为什么？',
    solution: '那名「乘客」其实是司机失聪的儿子，父子用眼神交流；儿子第一次独自乘车，司机不放心频频回头确认。到站后儿子安全下车，司机才放心。另一种真相：乘客是偷偷潜入的猫/宠物，被司机默许搭乘。',
    difficulty: 'medium',
    maxQuestions: 30,
    tags: ['温情', '反转', '日常'],
    hints: [
      '司机「面带笑意」回头——是关切而非警惕。',
      '「不说话」+「被频繁确认」指向某种无法言语的关系。',
      '重点在「牵挂」：他担心的人安全到达了。',
    ],
  },
  {
    id: 'p6',
    title: '最后一班地铁',
    surface: '凌晨的末班地铁上只有一名乘客。列车员查票时，乘客出示了一张「明天」的票。列车员却说：「您这张票正好。」请问为什么？',
    solution: '这是一条环线/跨零点调度的地铁：末班车在凌晨发车，按运行图它「到达终点」时已经跨过零点进入「明天」，因此「明天」的票正是当班有效票。乘客买的恰是跨日有效的票。',
    difficulty: 'medium',
    maxQuestions: 30,
    tags: ['烧脑', '时间', '反转'],
    hints: [
      '「明天」的票居然「正好」——说明时间规则特殊。',
      '末班车在「凌晨」发车，目标站却在「明天」。',
      '跨零点运营 + 环线调度：票面的日期是按到达算的。',
    ],
  },
  {
    id: 'p7',
    title: '镜中的陌生人',
    surface: '一个男人照镜子，镜子里的人对他做了个鬼脸，但他自己并没有做。他吓了一跳，随后却笑了。请问为什么？',
    solution: '他背后站着一个调皮的孩子/朋友，正透过他肩膀在镜子里做鬼脸；他起初误以为镜中异常，回头发现是熟人恶作剧，于是笑了。',
    difficulty: 'medium',
    maxQuestions: 30,
    tags: ['惊悚', '反转', '温情'],
    hints: [
      '「镜子里的人做了鬼脸，他自己没做」——动作来自镜外。',
      '他「随后笑了」，说明谜底是可爱的、非恐怖的。',
      '注意镜子会反射他身后的空间。',
    ],
  },
  {
    id: 'p8',
    title: '没有尸体的密室',
    surface: '警察破门进入一间反锁的密室，桌上有一杯倒扣的毒药、一封遗书，却找不到尸体。邻居说从没见过死者外出。请问为什么？',
    solution: '死者并非人类，而是一只被主人安排「安乐死」的宠物（如年老的狗）；所谓「遗书」是主人写的告别信。密室、毒药、遗书都成立，只是「尸体」被主人处理后安葬了。也可是：死者是棵植物/盆栽被「毒死」。',
    difficulty: 'medium',
    maxQuestions: 30,
    tags: ['反转', '烧脑', '温情'],
    hints: [
      '「找不到尸体」却「反锁密室」——先怀疑前提。',
      '遗书的存在很奇怪：死者自己写的？',
      '把「死者」换成非人类，所有线索就通了。',
    ],
  },
  {
    id: 'p9',
    title: '生日蜡烛',
    surface: '生日会上，寿星吹灭蜡烛后许愿，众人鼓掌。可第二天，寿星却因「吹灭蜡烛」这件事被送进了医院。请问为什么？',
    solution: '蛋糕上的「蜡烛」其实是一排微型烟花/冷焰火，寿星凑近吹气时火焰窜起灼伤了脸；或蜡烛插在了一个通电的道具上，吹气导致短路触电。总之「吹蜡烛」这个动作本身引发了意外。',
    difficulty: 'medium',
    maxQuestions: 30,
    tags: ['反转', '惊险', '日常'],
    hints: [
      '「吹灭蜡烛」居然能让人进医院——蜡烛本身有问题。',
      '不是被人害，是物品属性导致的意外。',
      '想想蜡烛除了「蜡」还可能是什么会喷火的东西。',
    ],
  },
].map((p, i) => ({
  ...p,
  author: p.author || '官方题库',
  createdAt: p.createdAt || BASE_PUBLISH_DATE + i * 30 * 86400000,
}));

// ──────────────────────────────────────────────
//  Blob Storage (EdgeOne Pages persistent storage)
// ──────────────────────────────────────────────
let _blobStore = null;
function getBlobStore() {
  if (_blobStore !== null) return _blobStore;
  try {
    _blobStore = getStore('turtle-soup-data');
  } catch (e) {
    console.warn('[blob] Blob Storage unavailable, using in-memory only:', e.message);
    _blobStore = false;
  }
  return _blobStore;
}

const BLOB_KEYS = {
  submissions: 'submissions',
  config: 'runtimeConfig',
  puzzles: 'customPuzzles',
};

async function persistSubmissions() {
  const store = getBlobStore();
  if (!store) return;
  try {
    await store.setJSON(BLOB_KEYS.submissions, submissions);
  } catch (e) {
    console.error('[blob] persistSubmissions failed:', e.message);
  }
}

async function loadSubmissions() {
  const store = getBlobStore();
  if (!store) return;
  try {
    const data = await store.get(BLOB_KEYS.submissions, { type: 'json' });
    if (Array.isArray(data) && data.length > 0) {
      submissions.push(...data);
      console.log(`[blob] Loaded ${data.length} submissions`);
    }
  } catch (e) {
    console.error('[blob] loadSubmissions failed:', e.message);
  }
}

async function persistConfig() {
  const store = getBlobStore();
  if (!store) return;
  try {
    await store.setJSON(BLOB_KEYS.config, {
      apiKey: runtimeConfig.apiKey,
      baseURL: runtimeConfig.baseURL,
      model: runtimeConfig.model,
      useAI: runtimeConfig.useAI,
      testMode: runtimeConfig.testMode,
    });
  } catch (e) {
    console.error('[blob] persistConfig failed:', e.message);
  }
}

async function loadConfig() {
  const store = getBlobStore();
  if (!store) return;
  try {
    const data = await store.get(BLOB_KEYS.config, { type: 'json' });
    if (data && typeof data === 'object') {
      if (data.apiKey) runtimeConfig.apiKey = data.apiKey;
      if (data.baseURL) runtimeConfig.baseURL = data.baseURL;
      if (data.model) runtimeConfig.model = data.model;
      if (typeof data.useAI === 'boolean') runtimeConfig.useAI = data.useAI;
      if (typeof data.testMode === 'boolean') runtimeConfig.testMode = data.testMode;
      console.log('[blob] Loaded runtimeConfig');
    }
  } catch (e) {
    console.error('[blob] loadConfig failed:', e.message);
  }
}

async function persistPuzzles() {
  const store = getBlobStore();
  if (!store) return;
  try {
    // Only persist non-base puzzles (approved submissions + editor additions)
    const customPuzzles = PUZZLES.filter((p) => p.id?.startsWith('sub_') || p.id?.startsWith('custom_'));
    await store.setJSON(BLOB_KEYS.puzzles, customPuzzles);
  } catch (e) {
    console.error('[blob] persistPuzzles failed:', e.message);
  }
}

async function loadPuzzles() {
  const store = getBlobStore();
  if (!store) return;
  try {
    const data = await store.get(BLOB_KEYS.puzzles, { type: 'json' });
    if (Array.isArray(data) && data.length > 0) {
      PUZZLES.push(...data);
      console.log(`[blob] Loaded ${data.length} custom puzzles`);
    }
  } catch (e) {
    console.error('[blob] loadPuzzles failed:', e.message);
  }
}

// Initialize: load persisted data on cold start
let _initialized = false;
async function initStorage() {
  if (_initialized) return;
  _initialized = true;
  const store = getBlobStore();
  if (!store) return;
  console.log('[blob] Initializing Blob Storage...');
  await Promise.all([loadSubmissions(), loadConfig(), loadPuzzles()]);
  console.log('[blob] Initialization complete');
}

// ──────────────────────────────────────────────
//  In-Memory State (synced with Blob Storage)
// ──────────────────────────────────────────────
const sessions = new Map();
const submissions = [];
const MAX_Q_BY_DIFF = { easy: 20, medium: 30, hard: 40, unlimited: 999 };

// Runtime config: reads from env vars set in EdgeOne Makers console
let runtimeConfig = {
  apiKey: process.env.AI_API_KEY || '',
  baseURL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.AI_MODEL || 'gpt-3.5-turbo',
  useAI: Boolean(process.env.AI_API_KEY),
  testMode: false,
};

function getRuntimeConfig() {
  return { ...runtimeConfig };
}
function isAIEnabled() {
  return runtimeConfig.useAI && (Boolean(runtimeConfig.apiKey) || runtimeConfig.testMode);
}

// ──────────────────────────────────────────────
//  AI Client (OpenAI-compatible, fetch-based)
// ──────────────────────────────────────────────
async function* streamAI(messages) {
  const { baseURL, apiKey, model } = getRuntimeConfig();
  const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API ${resp.status}: ${errText.slice(0, 200)}`);
    }

    if (!resp.body) throw new Error('No response body');
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
          /* skip non-JSON */
        }
      }
    }
  } catch (e) {
    // Fallback: non-streaming
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API ${resp.status}: ${errText.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (text) yield text;
  }
}

function parseAnswerKind(text) {
  const t = text.trim();
  if (t === '是' || t === '是。') return 'yes';
  if (t === '不是' || t === '不是。') return 'no';
  if (t === '是也不是' || t === '是也不是。') return 'partial';
  if (t === '无关' || t === '无关。') return 'irrelevant';
  if (/^是也不是/.test(t)) return 'partial';
  if (/^部分是/.test(t)) return 'partial';
  if (/^不是/.test(t)) return 'no';
  if (/^否/.test(t)) return 'no';
  if (/^无关/.test(t)) return 'irrelevant';
  if (/^是[^也]/.test(t)) return 'yes';
  if (t.includes('是也不是') || t.includes('部分是')) return 'partial';
  if (t.includes('不是')) return 'no';
  if (t.includes('无关')) return 'irrelevant';
  if (t.includes('是') && t.length <= 5) return 'yes';
  if (/^(yes|yep|right|correct)/i.test(t)) return 'yes';
  if (/^(no|nope|wrong)/i.test(t)) return 'no';
  return 'partial';
}

function parseAnswerWithScore(text) {
  const t = text.trim();
  const pipeMatch = t.match(/^(是|不是|是也不是|无关)\s*\|\s*(\d+(?:\.\d+)?)\s*[。.]?\s*$/);
  if (pipeMatch) {
    return { answer: parseAnswerKind(pipeMatch[1]), progressGain: Math.max(0, parseFloat(pipeMatch[2])) };
  }
  const answer = parseAnswerKind(t);
  let progressGain = 10;
  if (answer === 'irrelevant') progressGain = 0;
  else if (answer === 'partial') progressGain = 12;
  return { answer, progressGain };
}

function buildHostSystemPrompt(puzzle) {
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
   - 30~50+：关键突破（揭示核心诡计或故事关键反转）
   
   关键原则：
   - 正常且与故事相关的问题，起评分至少8
   - 揭示谜题"钥匙"的问题大胆给高分！
   - 每个问题独立评估
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

function buildHostMessages(puzzle, question, history = []) {
  const messages = [{ role: 'system', content: buildHostSystemPrompt(puzzle) }];
  const recent = history.slice(-12);
  for (const qa of recent) {
    const label = qa.answer === 'yes' ? '是' : qa.answer === 'no' ? '不是' : qa.answer === 'partial' ? '是也不是' : '无关';
    messages.push({ role: 'user', content: qa.question });
    messages.push({ role: 'assistant', content: label });
  }
  messages.push({ role: 'user', content: question });
  return messages;
}

function buildJudgeMessages(puzzle, guess) {
  return [
    {
      role: 'system',
      content: `你是海龟汤游戏的裁判。给定汤底真相与玩家的最终推理，判断玩家是否猜中。

汤面：${puzzle.surface}
汤底真相：${puzzle.solution}

请仅输出 JSON，格式：{"correct": true|false, "feedback": "给玩家的简短点评，若正确则复述真相，若错误则点出偏差"}`,
    },
    { role: 'user', content: `玩家的推理：${guess}` },
  ];
}

async function answerWithAI(puzzle, question, history = []) {
  const messages = buildHostMessages(puzzle, question, history);
  let buf = '';
  for await (const piece of streamAI(messages)) buf += piece;
  const { answer, progressGain } = parseAnswerWithScore(buf);
  return { answer, note: '', progressGain };
}

async function judgeWithAI(puzzle, guess) {
  const messages = buildJudgeMessages(puzzle, guess);
  let buf = '';
  for await (const piece of streamAI(messages)) buf += piece;
  try {
    const jsonMatch = buf.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { correct: Boolean(parsed.correct), feedback: String(parsed.feedback || ''), source: 'ai' };
    }
  } catch {
    /* fallback */
  }
  return { correct: false, feedback: buf.slice(0, 200), source: 'ai' };
}

// ──────────────────────────────────────────────
//  Host Answer Logic
// ──────────────────────────────────────────────
const DUPLICATE_THRESHOLD = 0.7;

function normalize(q) {
  return q.trim().toLowerCase();
}

function detectDuplicate(question, history) {
  if (history.length === 0) return null;
  const q = normalize(question);
  const qTokens = new Set(q.split(''));
  for (const h of history) {
    const hTokens = new Set(normalize(h.question).split(''));
    const intersection = [...qTokens].filter((t) => hTokens.has(t)).length;
    const union = new Set([...qTokens, ...hTokens]).size;
    const similarity = union > 0 ? intersection / union : 0;
    if (similarity > DUPLICATE_THRESHOLD) {
      return { answer: 'irrelevant', note: '', source: 'ai', progressGain: 0 };
    }
  }
  return null;
}

async function hostAnswer(puzzle, question, history = []) {
  if (!isAIEnabled()) {
    throw new Error('AI 功能未启用，请先在 EdgeOne Makers 控制台设置环境变量 AI_API_KEY');
  }
  const dup = detectDuplicate(question, history);
  if (dup) return dup;
  const ai = await answerWithAI(puzzle, question, history);
  return { answer: ai.answer, note: ai.note, source: 'ai', progressGain: ai.progressGain };
}

async function judgeGuess(puzzle, guess) {
  if (isAIEnabled()) {
    try {
      return await judgeWithAI(puzzle, guess);
    } catch (err) {
      return { correct: false, feedback: '判定服务暂不可用，请稍后重试。', source: 'fallback' };
    }
  }
  return {
    correct: false,
    feedback: 'AI 未启用，无法自动判定。请直接对照汤底自行判断。汤底如下：' + puzzle.solution,
    source: 'fallback',
  };
}

// ──────────────────────────────────────────────
//  Session Management (in-memory)
// ──────────────────────────────────────────────
function publicPuzzle(p) {
  return {
    id: p.id, title: p.title, surface: p.surface,
    difficulty: p.difficulty, maxQuestions: p.maxQuestions,
    tags: p.tags, author: p.author, createdAt: p.createdAt,
  };
}

function getPlayablePuzzles() {
  return PUZZLES;
}

function getPuzzleById(id) {
  return getPlayablePuzzles().find((p) => p.id === id);
}

function randomPuzzle(difficulty) {
  const pool = getPlayablePuzzles().filter((p) => !difficulty || p.difficulty === difficulty);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createSession(puzzle) {
  return {
    id: crypto.randomUUID(), puzzle, history: [],
    hintsRevealed: 0, finished: false, questionsDepleted: false,
    createdAt: Date.now(), accumulatedProgress: 0,
  };
}

function recordAnswer(session, question, reply) {
  const item = {
    id: crypto.randomUUID(), question,
    answer: reply.answer, note: reply.note,
    source: reply.source, progressGain: reply.progressGain,
  };
  session.history.push(item);
  session.accumulatedProgress = Math.min(100, session.accumulatedProgress + reply.progressGain);
  session.questionsDepleted = session.history.length >= session.puzzle.maxQuestions;
  return item;
}

function nextHint(session) {
  if (session.hintsRevealed >= session.puzzle.hints.length) return null;
  const hint = session.puzzle.hints[session.hintsRevealed];
  session.hintsRevealed += 1;
  return hint;
}

// ──────────────────────────────────────────────
//  Express App
// ──────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '1mb' }));

// Ensure Blob Storage data is loaded before handling any request
app.use(async (_req, _res, next) => {
  await initStorage();
  next();
});

// Input validation middleware
app.use('/api/solo', (req, _res, next) => {
  const b = req.body || {};
  const q = req.query || {};
  if (typeof b.guess === 'string' && b.guess.length > 5000) {
    return _res.status(400).json({ error: '推理内容不能超过 5000 字' });
  }
  if (typeof q.question === 'string' && q.question.length > 200) {
    return _res.status(400).json({ error: '问题不能超过 200 字' });
  }
  next();
});

// ── Health ──
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, useAI: isAIEnabled(), hasKey: Boolean(runtimeConfig.apiKey) });
});

// ── Puzzles ──
app.get('/api/puzzles', (req, res) => {
  const difficulty = req.query.difficulty;
  const puzzles = getPlayablePuzzles()
    .filter((p) => !difficulty || p.difficulty === difficulty)
    .map(publicPuzzle);
  res.json({ puzzles });
});

app.get('/api/puzzles/random', (req, res) => {
  const puzzle = randomPuzzle(req.query.difficulty);
  if (!puzzle) return res.status(404).json({ error: '暂无可玩题目' });
  res.json(publicPuzzle(puzzle));
});

// ── Solo Game ──
app.post('/api/solo/start', (req, res) => {
  const { puzzleId, difficulty } = req.body || {};
  let puzzle = puzzleId ? getPuzzleById(puzzleId) : undefined;
  if (!puzzle) puzzle = randomPuzzle(difficulty);
  if (!puzzle) return res.status(404).json({ error: '暂无可玩题目' });
  const session = createSession(puzzle);
  sessions.set(session.id, session);
  res.json({
    sessionId: session.id,
    puzzle: publicPuzzle(puzzle),
    maxQuestions: puzzle.maxQuestions,
    questionsUsed: 0,
    accumulatedProgress: 0,
    finished: false,
    questionsDepleted: false,
  });
});

app.post('/api/solo/hint', (req, res) => {
  const { sessionId } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: '会话不存在' });
  const hint = nextHint(session);
  if (hint === null) return res.json({ hint: null, done: true });
  res.json({ hint, done: false });
});

app.post('/api/solo/guess', async (req, res) => {
  const { sessionId, guess } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: '会话不存在' });
  const g = String(guess || '').trim();
  if (!g) return res.status(400).json({ error: '请先输入你的推理' });
  const result = await judgeGuess(session.puzzle, g);
  res.json({
    correct: result.correct,
    feedback: result.feedback,
    solution: session.puzzle.solution,
    playerGuess: g,
  });
});

app.get('/api/solo/:sessionId/state', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: '会话不存在或已过期' });
  const shownHints = session.puzzle.hints.slice(0, session.hintsRevealed);
  res.json({
    sessionId: session.id,
    puzzle: publicPuzzle(session.puzzle),
    history: session.history,
    hints: shownHints,
    questionsUsed: session.history.length,
    accumulatedProgress: session.accumulatedProgress,
    maxQuestions: session.puzzle.maxQuestions,
    finished: session.finished,
    questionsDepleted: session.questionsDepleted,
  });
});

// SSE streaming for solo ask
app.get('/api/solo/ask', async (req, res) => {
  const sessionId = String(req.query.sessionId || '');
  const question = String(req.query.question || '').trim();
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: '会话不存在' });
  if (!question) return res.status(400).json({ error: '问题为空' });
  if (session.questionsDepleted) return res.status(409).json({ error: '已达提问上限，请揭晓或提交推理' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  let closed = false;
  req.on('close', () => { closed = true; });
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const reply = await hostAnswer(session.puzzle, question, session.history);
    send({ type: 'answer', answer: reply.answer, source: reply.source });
    const note = reply.note || '';
    const item = recordAnswer(session.id ? session : session, question, reply);
    const size = 4;
    for (let i = 0; i < note.length; i += size) {
      if (closed) break;
      send({ type: 'chunk', text: note.slice(i, i + size) });
      await delay(28);
    }
    send({
      type: 'done',
      item,
      questionsUsed: session.history.length,
      accumulatedProgress: session.accumulatedProgress,
      finished: session.finished,
      questionsDepleted: session.questionsDepleted,
    });
  } catch (e) {
    send({ type: 'error', message: e.message });
  } finally {
    if (!closed) res.end();
  }
});

// ── Config ──
app.get('/api/config', (_req, res) => {
  const rt = getRuntimeConfig();
  res.json({
    apiKey: rt.apiKey ? `${rt.apiKey.slice(0, 6)}...${rt.apiKey.slice(-4)}` : '(未设置)',
    baseURL: rt.baseURL,
    model: rt.model,
    useAI: rt.useAI,
    hasKey: Boolean(rt.apiKey),
    testMode: rt.testMode,
  });
});

app.put('/api/config', (req, res) => {
  const patch = req.body || {};
  const updated = [];
  if (typeof patch.apiKey === 'string') { runtimeConfig.apiKey = patch.apiKey; updated.push('apiKey'); }
  if (typeof patch.baseURL === 'string') { runtimeConfig.baseURL = patch.baseURL; updated.push('baseURL'); }
  if (typeof patch.model === 'string') { runtimeConfig.model = patch.model; updated.push('model'); }
  if (typeof patch.useAI === 'boolean') { runtimeConfig.useAI = patch.useAI; updated.push('useAI'); }
  if (typeof patch.testMode === 'boolean') { runtimeConfig.testMode = patch.testMode; updated.push('testMode'); }
  if (updated.length === 0) return res.status(400).json({ error: '无有效更新字段' });
  persistConfig(); // fire-and-forget
  res.json({ ok: true, updated });
});

app.post('/api/config/verify', async (req, res) => {
  const { apiKey, baseURL, model } = req.body || {};
  if (!apiKey) return res.status(400).json({ ok: false, error: '缺少 apiKey' });
  const url = `${(baseURL || runtimeConfig.baseURL).replace(/\/+$/, '')}/chat/completions`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || runtimeConfig.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) return res.json({ ok: true, message: 'API 验证成功' });
    const errText = await resp.text().catch(() => '');
    res.json({ ok: false, error: `API 返回 ${resp.status}: ${errText.slice(0, 200)}` });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Submissions ──
app.post('/api/submissions', (req, res) => {
  const { surface, solution, title, difficulty, hints, tags, author } = req.body || {};
  if (!surface || !solution) return res.status(400).json({ error: '汤面和汤底为必填项' });
  const sub = {
    id: crypto.randomUUID(),
    title: title || surface.slice(0, 14) + (surface.length > 14 ? '…' : ''),
    surface, solution,
    difficulty: difficulty || 'medium',
    hints: hints || [],
    tags: tags || [],
    author: author || '匿名',
    status: 'pending',
    createdAt: Date.now(),
  };
  submissions.push(sub);
  persistSubmissions(); // fire-and-forget
  res.json({ ok: true, id: sub.id, status: 'pending' });
});

app.post('/api/submissions/batch-parse', (req, res) => {
  const { rawText } = req.body || {};
  if (!rawText || typeof rawText !== 'string') return res.status(400).json({ error: '缺少 rawText' });
  if (rawText.length > 50000) return res.status(400).json({ error: '文本过长' });
  // Simple parser: split by === or --- separators
  const blocks = rawText.split(/(?:^|\n)={3,}\n?|(?:^|\n)-{3,}\n?/).map((b) => b.trim()).filter(Boolean);
  const puzzles = blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim());
    const obj = {};
    for (const line of lines) {
      const m = line.match(/^(.+?)[:：]\s*(.*)$/);
      if (m) obj[m[1].trim().toLowerCase()] = m[2].trim();
    }
    return {
      title: obj['title'] || obj['标题'] || '',
      surface: obj['surface'] || obj['汤面'] || '',
      solution: obj['solution'] || obj['汤底'] || '',
      difficulty: obj['difficulty'] || obj['难度'] || 'medium',
      hints: (obj['hints'] || obj['提示'] || '').split(/[|｜]/).map((s) => s.trim()).filter(Boolean),
      tags: (obj['tags'] || obj['标签'] || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    };
  }).filter((p) => p.surface && p.solution);
  res.json({ puzzles });
});

app.post('/api/submissions/list', (req, res) => {
  const { pass, status } = req.body || {};
  if (pass !== process.env.ADMIN_PASS && pass !== 'turtle-admin-2026') {
    return res.status(403).json({ error: '口令错误' });
  }
  let list = submissions;
  if (status) list = list.filter((s) => s.status === status);
  res.json({ submissions: list });
});

app.post('/api/submissions/:id/approve', (req, res) => {
  const { pass } = req.body || {};
  if (pass !== process.env.ADMIN_PASS && pass !== 'turtle-admin-2026') {
    return res.status(403).json({ error: '口令错误' });
  }
  const sub = submissions.find((s) => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: '投稿不存在' });
  sub.status = 'approved';
  // Add as playable puzzle
  PUZZLES.push({
    ...sub,
    id: `sub_${sub.id}`,
    maxQuestions: MAX_Q_BY_DIFF[sub.difficulty] || 30,
  });
  persistSubmissions();
  persistPuzzles();
  res.json({ ok: true, submission: sub });
});

app.post('/api/submissions/:id/reject', (req, res) => {
  const { pass } = req.body || {};
  if (pass !== process.env.ADMIN_PASS && pass !== 'turtle-admin-2026') {
    return res.status(403).json({ error: '口令错误' });
  }
  const sub = submissions.find((s) => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: '投稿不存在' });
  sub.status = 'rejected';
  persistSubmissions();
  res.json({ ok: true, submission: sub });
});

// ── Rooms (stub — Socket.io not available in serverless) ──
app.get('/api/rooms', (_req, res) => {
  res.json({ rooms: [] });
});

// ── Editor (admin-only) ──
app.get('/api/editor/puzzles', (req, res) => {
  const pass = req.query.pass;
  if (pass !== process.env.ADMIN_PASS && pass !== 'turtle-admin-2026') {
    return res.status(403).json({ error: '口令错误' });
  }
  res.json({ puzzles: PUZZLES });
});

app.put('/api/editor/puzzles/:id', (req, res) => {
  const { pass } = req.body || {};
  if (pass !== process.env.ADMIN_PASS && pass !== 'turtle-admin-2026') {
    return res.status(403).json({ error: '口令错误' });
  }
  const puzzle = PUZZLES.find((p) => p.id === req.params.id);
  if (!puzzle) return res.status(404).json({ error: '题目不存在' });
  const { title, surface, solution, difficulty, tags, hints, author } = req.body || {};
  if (title !== undefined) puzzle.title = title;
  if (surface !== undefined) puzzle.surface = surface;
  if (solution !== undefined) puzzle.solution = solution;
  if (difficulty !== undefined) puzzle.difficulty = difficulty;
  if (tags !== undefined) puzzle.tags = tags;
  if (hints !== undefined) puzzle.hints = hints;
  if (author !== undefined) puzzle.author = author;
  persistPuzzles();
  res.json({ ok: true, id: puzzle.id });
});

app.delete('/api/editor/puzzles/:id', (req, res) => {
  const pass = req.body?.pass;
  if (pass !== process.env.ADMIN_PASS && pass !== 'turtle-admin-2026') {
    return res.status(403).json({ error: '口令错误' });
  }
  const idx = PUZZLES.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '题目不存在' });
  PUZZLES.splice(idx, 1);
  persistPuzzles();
  res.json({ ok: true });
});

app.get('/api/editor/submissions', (req, res) => {
  const pass = req.query.pass;
  if (pass !== process.env.ADMIN_PASS && pass !== 'turtle-admin-2026') {
    return res.status(403).json({ error: '口令错误' });
  }
  let list = submissions;
  if (req.query.status) list = list.filter((s) => s.status === req.query.status);
  res.json({ submissions: list });
});

app.put('/api/editor/submissions/:id', (req, res) => {
  const { pass } = req.body || {};
  if (pass !== process.env.ADMIN_PASS && pass !== 'turtle-admin-2026') {
    return res.status(403).json({ error: '口令错误' });
  }
  const sub = submissions.find((s) => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: '投稿不存在' });
  const { title, surface, solution, difficulty, tags, hints, author, status } = req.body || {};
  if (title !== undefined) sub.title = title;
  if (surface !== undefined) sub.surface = surface;
  if (solution !== undefined) sub.solution = solution;
  if (difficulty !== undefined) sub.difficulty = difficulty;
  if (tags !== undefined) sub.tags = tags;
  if (hints !== undefined) sub.hints = hints;
  if (author !== undefined) sub.author = author;
  if (status !== undefined) sub.status = status;
  persistSubmissions();
  res.json({ ok: true, submission: sub });
});

// ── Catch-all for unknown API routes ──
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// MUST export the app — do NOT call app.listen()
export default app;

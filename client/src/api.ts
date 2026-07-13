import type {
  PublicPuzzle,
  QAItem,
  SubmissionInput,
  Difficulty,
  SoloSessionState,
  SubmissionItem,
} from './types/game';
import type { AnswerKind } from './types/game';

// ═══════════════════════════════════════════════
//  Puzzle Data (客户端兜底，优先调服务端)
// ═══════════════════════════════════════════════
const BASE_PUBLISH_DATE = Date.UTC(2025, 8, 1);

interface Puzzle {
  id: string;
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  maxQuestions: number;
  tags: string[];
  hints: string[];
  author?: string;
  createdAt?: number;
}

const PUZZLE_DATA: Omit<Puzzle, 'author' | 'createdAt'>[] = [
  {
    id: 'p1', title: '海边的独行者',
    surface: '一个男人来到海边，脱下鞋子走进海里，再也没出来。人们后来发现他其实并不会游泳，但他脸上带着微笑。请问发生了什么？',
    solution: '这个男人是一名绝症晚期患者，他选择在海边安静地结束自己的生命，所以面带微笑、并无挣扎；他不会游泳，海水成了他解脱的方式。',
    difficulty: 'easy', maxQuestions: 20, tags: ['悬疑', '温情', '现实'],
    hints: ['注意「不会游泳却走进海里」这个矛盾点。', '他并不害怕，反而微笑——说明这是他自己的选择。', '结合「绝症」线索：他是在用一种平静的方式解脱。'],
  },
  {
    id: 'p2', title: '空荡的餐厅',
    surface: '一家餐厅在晚餐时间座无虚席，却没有任何人动筷子吃饭。服务员也不催促。请问为什么？',
    solution: '这是一家「网红打卡」主题餐厅，当天的活动是「静止挑战/行为艺术」，所有顾客是来参与沉浸式演出的演员与观众，餐桌只是布景，所以没人真正用餐。',
    difficulty: 'easy', maxQuestions: 20, tags: ['反转', '日常', '脑洞'],
    hints: ['「座无虚席却不动筷子」——重点在「为什么不需要吃」。', '服务员不催，说明这种「不吃」是被允许的常态。', '想想「网红/沉浸体验」：人可能是来「演」的。'],
  },
  {
    id: 'p3', title: '雨夜的伞',
    surface: '深夜下着大雨，一个女孩撑着伞走在街上，浑身却湿透了。她没有哭，神情平静。请问为什么？',
    solution: '女孩撑的伞是坏的（或她把伞让给了路边躲雨的陌生人），她自己淋在雨里；她平静是因为刚帮完别人，内心满足。另一种常见真相：她撑伞是为了遮挡路灯摄像头，而非挡雨。',
    difficulty: 'medium', maxQuestions: 30, tags: ['温情', '反转', '日常'],
    hints: ['「撑伞却湿透」——伞的存在反而成了谜。', '她不哭不委屈，说明湿透是她「愿意」的。', '结合「让伞给陌生人」：湿透源于善意。'],
  },
  {
    id: 'p4', title: '停电的电梯',
    surface: '办公大楼突然停电，一部电梯停在两层之间。里面的人按了求救铃，救援人员赶到后却说：「你们运气真好。」请问为什么？',
    solution: '电梯其实停在两层楼之间的极窄缝隙，但如果它再下降几厘米就会卡死或坠入井道底端危险区；救援人员发现它恰好悬在结构横梁上，加上当时是火灾导致停电，若电梯继续运行会被浓烟困住，所以停在半空反而保命。',
    difficulty: 'medium', maxQuestions: 30, tags: ['悬疑', '惊险', '推理'],
    hints: ['「运气真好」是反直觉的——通常困电梯是倒霉。', '停电的原因很关键，想想大楼里还有什么危险。', '停在半空而非运行，恰好避开了更大的灾难。'],
  },
  {
    id: 'p5', title: '不说话的乘客',
    surface: '一辆长途巴士上，一名乘客全程一言不发，司机却每隔一会儿就回头看他一眼，面带笑意。到站后乘客下了车，司机明显松了口气。请问为什么？',
    solution: '那名「乘客」其实是司机失聪的儿子，父子用眼神交流；儿子第一次独自乘车，司机不放心频频回头确认。到站后儿子安全下车，司机才放心。另一种真相：乘客是偷偷潜入的猫/宠物，被司机默许搭乘。',
    difficulty: 'medium', maxQuestions: 30, tags: ['温情', '反转', '日常'],
    hints: ['司机「面带笑意」回头——是关切而非警惕。', '「不说话」+「被频繁确认」指向某种无法言语的关系。', '重点在「牵挂」：他担心的人安全到达了。'],
  },
  {
    id: 'p6', title: '最后一班地铁',
    surface: '凌晨的末班地铁上只有一名乘客。列车员查票时，乘客出示了一张「明天」的票。列车员却说：「您这张票正好。」请问为什么？',
    solution: '这是一条环线/跨零点调度的地铁：末班车在凌晨发车，按运行图它「到达终点」时已经跨过零点进入「明天」，因此「明天」的票正是当班有效票。乘客买的恰是跨日有效的票。',
    difficulty: 'medium', maxQuestions: 30, tags: ['烧脑', '时间', '反转'],
    hints: ['「明天」的票居然「正好」——说明时间规则特殊。', '末班车在「凌晨」发车，目标站却在「明天」。', '跨零点运营 + 环线调度：票面的日期是按到达算的。'],
  },
  {
    id: 'p7', title: '镜中的陌生人',
    surface: '一个男人照镜子，镜子里的人对他做了个鬼脸，但他自己并没有做。他吓了一跳，随后却笑了。请问为什么？',
    solution: '他背后站着一个调皮的孩子/朋友，正透过他肩膀在镜子里做鬼脸；他起初误以为镜中异常，回头发现是熟人恶作剧，于是笑了。',
    difficulty: 'medium', maxQuestions: 30, tags: ['惊悚', '反转', '温情'],
    hints: ['「镜子里的人做了鬼脸，他自己没做」——动作来自镜外。', '他「随后笑了」，说明谜底是可爱的、非恐怖的。', '注意镜子会反射他身后的空间。'],
  },
  {
    id: 'p8', title: '没有尸体的密室',
    surface: '警察破门进入一间反锁的密室，桌上有一杯倒扣的毒药、一封遗书，却找不到尸体。邻居说从没见过死者外出。请问为什么？',
    solution: '死者并非人类，而是一只被主人安排「安乐死」的宠物（如年老的狗）；所谓「遗书」是主人写的告别信。密室、毒药、遗书都成立，只是「尸体」被主人处理后安葬了。也可是：死者是棵植物/盆栽被「毒死」。',
    difficulty: 'medium', maxQuestions: 30, tags: ['反转', '烧脑', '温情'],
    hints: ['「找不到尸体」却「反锁密室」——先怀疑前提。', '遗书的存在很奇怪：死者自己写的？', '把「死者」换成非人类，所有线索就通了。'],
  },
  {
    id: 'p9', title: '生日蜡烛',
    surface: '生日会上，寿星吹灭蜡烛后许愿，众人鼓掌。可第二天，寿星却因「吹灭蜡烛」这件事被送进了医院。请问为什么？',
    solution: '蛋糕上的「蜡烛」其实是一排微型烟花/冷焰火，寿星凑近吹气时火焰窜起灼伤了脸；或蜡烛插在了一个通电的道具上，吹气导致短路触电。总之「吹蜡烛」这个动作本身引发了意外。',
    difficulty: 'medium', maxQuestions: 30, tags: ['反转', '惊险', '日常'],
    hints: ['「吹灭蜡烛」居然能让人进医院——蜡烛本身有问题。', '不是被人害，是物品属性导致的意外。', '想想蜡烛除了「蜡」还可能是什么会喷火的东西。'],
  },
];

const PUZZLES: Puzzle[] = PUZZLE_DATA.map((p, i) => ({
  ...p,
  author: '官方题库',
  createdAt: BASE_PUBLISH_DATE + i * 30 * 86400000,
}));

function publicPuzzle(p: Puzzle): PublicPuzzle {
  return {
    id: p.id, title: p.title, surface: p.surface,
    difficulty: p.difficulty, maxQuestions: p.maxQuestions,
    tags: p.tags, author: p.author, createdAt: p.createdAt,
  };
}

// ═══════════════════════════════════════════════
//  AI Config (localStorage — 设置页面使用)
// ═══════════════════════════════════════════════
const AI_CONFIG_KEY = 'turtle_soup_ai_config';

interface AIConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  useAI: boolean;
  testMode: boolean;
}

function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    apiKey: '',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    useAI: false,
    testMode: false,
  };
}

function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

// ═══════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const api = {
  // ---- 题库（优先服务端，兜底客户端） ----
  async listPuzzles(difficulty?: Difficulty): Promise<PublicPuzzle[]> {
    try {
      const qs = difficulty ? `?difficulty=${difficulty}` : '';
      const res = await fetch(`/api/puzzles${qs}`);
      const data = await res.json();
      if (data.puzzles && data.puzzles.length > 0) return data.puzzles;
    } catch { /* fallback */ }
    return PUZZLES.filter((p) => !difficulty || p.difficulty === difficulty).map(publicPuzzle);
  },

  async randomPuzzle(difficulty?: Difficulty): Promise<PublicPuzzle> {
    try {
      const qs = difficulty ? `?difficulty=${difficulty}` : '';
      const res = await fetch(`/api/puzzles/random${qs}`);
      const data = await res.json();
      if (data.id) return data;
    } catch { /* fallback */ }
    const pool = PUZZLES.filter((p) => !difficulty || p.difficulty === difficulty);
    if (pool.length === 0) throw new Error('暂无可玩题目');
    return publicPuzzle(pool[Math.floor(Math.random() * pool.length)]);
  },

  // ---- 单人模式（全部走服务端 API） ----
  async startSolo(puzzleId?: string, difficulty?: Difficulty) {
    const res = await fetch('/api/solo/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleId, difficulty }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data as {
      sessionId: string;
      puzzle: PublicPuzzle;
      maxQuestions: number;
      questionsUsed: number;
      accumulatedProgress: number;
      finished: boolean;
      questionsDepleted: boolean;
    };
  },

  /** SSE 流式提问（走服务端，享受 testMode / CodeBuddy 积分） */
  askSoloStream(
    sessionId: string,
    question: string,
    onEvent: (e: SoloStreamEvent) => void,
    signal?: AbortSignal,
  ): void {
    const q = encodeURIComponent(question.trim());
    const url = `/api/solo/ask?sessionId=${encodeURIComponent(sessionId)}&question=${q}`;

    // 使用 fetch + ReadableStream 而非 EventSource，因为 GET 参数可能很长
    const abortController = new AbortController();
    const combinedSignal = signal
      ? (signal.addEventListener('abort', () => abortController.abort()), abortController.signal)
      : abortController.signal;

    fetch(url, { signal: combinedSignal })
      .then(async (resp) => {
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          onEvent({ type: 'error', message: (errData as any).error || `服务端返回 ${resp.status}` });
          return;
        }
        if (!resp.body) {
          onEvent({ type: 'error', message: '无响应体' });
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // SSE 格式：data: {...}\n\n
          const parts = buf.split('\n\n');
          buf = parts.pop() || '';
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            try {
              const json = JSON.parse(line.slice(5).trim());
              onEvent(json as SoloStreamEvent);
            } catch { /* skip malformed */ }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          onEvent({ type: 'error', message: `网络错误: ${err.message}` });
        }
      });

    // 返回清理函数
    return () => abortController.abort();
  },

  async revealHint(sessionId: string): Promise<{ hint: string | null; done: boolean }> {
    const res = await fetch('/api/solo/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  async guessSolo(
    sessionId: string,
    guess: string,
  ): Promise<{ correct: boolean; feedback: string; solution?: string }> {
    const res = await fetch('/api/solo/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, guess }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  async getSoloState(sessionId: string): Promise<SoloSessionState> {
    const res = await fetch(`/api/solo/${sessionId}/state`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ---- 投稿 ----
  async batchParse(rawText: string): Promise<{ puzzles: SubmissionInput[] }> {
    if (!rawText || typeof rawText !== 'string') throw new Error('缺少 rawText');
    if (rawText.length > 50000) throw new Error('文本过长');
    const blocks = rawText.split(/(?:^|\n)={3,}\n?|(?:^|\n)-{3,}\n?/).map((b) => b.trim()).filter(Boolean);
    const puzzles = blocks.map((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      const obj: Record<string, string> = {};
      for (const line of lines) {
        const m = line.match(/^(.+?)[:：]\s*(.*)$/);
        if (m) obj[m[1].trim().toLowerCase()] = m[2].trim();
      }
      return {
        title: obj['title'] || obj['标题'] || '',
        surface: obj['surface'] || obj['汤面'] || '',
        solution: obj['solution'] || obj['汤底'] || '',
        difficulty: (obj['difficulty'] || obj['难度'] || 'medium') as Difficulty,
        hints: (obj['hints'] || obj['提示'] || '').split(/[|｜]/).map((s) => s.trim()).filter(Boolean),
        tags: (obj['tags'] || obj['标签'] || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        author: '匿名',
      };
    }).filter((p) => p.surface && p.solution);
    return { puzzles };
  },

  async submitPuzzle(input: SubmissionInput) {
    const subs: SubmissionItem[] = JSON.parse(localStorage.getItem('turtle_soup_submissions') || '[]');
    const sub: SubmissionItem = {
      id: genId(),
      title: input.title || input.surface.slice(0, 14),
      surface: input.surface,
      solution: input.solution,
      difficulty: input.difficulty,
      hints: input.hints || [],
      tags: input.tags || [],
      author: input.author || '匿名',
      status: 'pending',
      createdAt: Date.now(),
    };
    subs.push(sub);
    localStorage.setItem('turtle_soup_submissions', JSON.stringify(subs));
    return { ok: true, id: sub.id, status: 'pending' };
  },

  async listSubmissions(pass: string, status?: string) {
    if (pass !== 'turtle-admin-2026') throw new Error('口令错误');
    let subs: SubmissionItem[] = JSON.parse(localStorage.getItem('turtle_soup_submissions') || '[]');
    if (status) subs = subs.filter((s) => s.status === status);
    return { submissions: subs };
  },

  async moderate(id: string, action: 'approve' | 'reject', pass: string) {
    if (pass !== 'turtle-admin-2026') throw new Error('口令错误');
    const subs: SubmissionItem[] = JSON.parse(localStorage.getItem('turtle_soup_submissions') || '[]');
    const sub = subs.find((s) => s.id === id);
    if (!sub) throw new Error('投稿不存在');
    sub.status = action === 'approve' ? 'approved' : 'rejected';
    localStorage.setItem('turtle_soup_submissions', JSON.stringify(subs));
    return { ok: true };
  },

  // ---- 房间列表 ----
  async listRooms(): Promise<RoomInfo[]> {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      return data.rooms || [];
    } catch {
      return [];
    }
  },

  // ---- 服务端配置（设置页面） ----
  async getConfig(): Promise<ApiConfig> {
    try {
      const res = await fetch('/api/config');
      return await res.json();
    } catch {
      const config = loadAIConfig();
      return {
        apiKey: config.apiKey ? `${config.apiKey.slice(0, 6)}...${config.apiKey.slice(-4)}` : '(未设置)',
        baseURL: config.baseURL,
        model: config.model,
        useAI: config.useAI,
        hasKey: Boolean(config.apiKey),
        testMode: config.testMode,
      };
    }
  },

  async updateConfig(input: ApiConfigInput): Promise<{ ok: boolean; updated: string[] }> {
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // 同步到 localStorage
      const local = loadAIConfig();
      if (typeof input.apiKey === 'string') local.apiKey = input.apiKey;
      if (typeof input.baseURL === 'string') local.baseURL = input.baseURL;
      if (typeof input.model === 'string') local.model = input.model;
      if (typeof input.useAI === 'boolean') local.useAI = input.useAI;
      if (typeof input.testMode === 'boolean') local.testMode = input.testMode;
      saveAIConfig(local);
      return data;
    } catch {
      // 离线兜底：仅更新 localStorage
      const config = loadAIConfig();
      const updated: string[] = [];
      if (typeof input.apiKey === 'string') { config.apiKey = input.apiKey; updated.push('apiKey'); }
      if (typeof input.baseURL === 'string') { config.baseURL = input.baseURL; updated.push('baseURL'); }
      if (typeof input.model === 'string') { config.model = input.model; updated.push('model'); }
      if (typeof input.useAI === 'boolean') { config.useAI = input.useAI; updated.push('useAI'); }
      if (typeof input.testMode === 'boolean') { config.testMode = input.testMode; updated.push('testMode'); }
      if (updated.length === 0) throw new Error('无有效更新字段');
      saveAIConfig(config);
      return { ok: true, updated };
    }
  },

  async verifyConfig(input: { apiKey: string; baseURL?: string; model?: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/config/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

// ═══════════════════════════════════════════════
//  Exported Types
// ═══════════════════════════════════════════════
export interface RoomInfo {
  code: string;
  mode: string;
  playerCount: number;
  difficulty: string;
  title: string;
  elapsed: number;
  finished: boolean;
}

export interface SoloStreamEvent {
  type: 'answer' | 'chunk' | 'done' | 'error';
  answer?: QAItem['answer'];
  source?: 'ai' | 'fallback';
  text?: string;
  item?: QAItem;
  questionsUsed?: number;
  accumulatedProgress?: number;
  finished?: boolean;
  questionsDepleted?: boolean;
  message?: string;
}

export interface ApiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  useAI: boolean;
  hasKey: boolean;
  testMode: boolean;
}

export interface ApiConfigInput {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  useAI?: boolean;
  testMode?: boolean;
}

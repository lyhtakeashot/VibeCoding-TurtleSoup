import type {
  PublicPuzzle,
  QAItem,
  SubmissionInput,
  Difficulty,
  SoloSessionState,
  SubmissionItem,
} from './types/game';

const BASE = '/api';

// --- 防弹衣：自动重试后端重启时的短暂不可用 ---
async function safeFetch(
  url: string,
  options?: RequestInit,
  retries = 2,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      // 后端正在重启 → 等 1.5 秒再试
      if ((res.status === 502 || res.status === 503) && i < retries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return res;
    } catch (e) {
      // 连接被拒 → 也是重启中
      if (
        i < retries &&
        ((e as Error).message?.includes('fetch') ||
          (e as Error).message?.includes('ECONNREFUSED'))
      ) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw e;
    }
  }
  throw new Error('后端服务暂时不可用，请稍后刷新');
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `请求失败 ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  async listPuzzles(difficulty?: Difficulty): Promise<PublicPuzzle[]> {
    const q = difficulty ? `?difficulty=${difficulty}` : '';
    const d = await json<{ puzzles: PublicPuzzle[] }>(await safeFetch(`${BASE}/puzzles${q}`));
    return d.puzzles;
  },

  async randomPuzzle(difficulty?: Difficulty): Promise<PublicPuzzle> {
    const q = difficulty ? `?difficulty=${difficulty}` : '';
    return json<PublicPuzzle>(await safeFetch(`${BASE}/puzzles/random${q}`));
  },

  async startSolo(puzzleId?: string, difficulty?: Difficulty) {
    const r = await safeFetch(`${BASE}/solo/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleId, difficulty }),
    });
    return json<{
      sessionId: string;
      puzzle: PublicPuzzle;
      maxQuestions: number;
      questionsUsed: number;
      finished: boolean;
      questionsDepleted: boolean;
    }>(r);
  },

  async revealHint(sessionId: string): Promise<{ hint: string | null; done: boolean }> {
    const r = await safeFetch(`${BASE}/solo/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return json(r);
  },

  async guessSolo(
    sessionId: string,
    guess: string,
  ): Promise<{ correct: boolean; feedback: string; solution?: string }> {
    const r = await safeFetch(`${BASE}/solo/guess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, guess }),
    });
    return json(r);
  },

  async getSoloState(sessionId: string): Promise<SoloSessionState> {
    const r = await safeFetch(`${BASE}/solo/${encodeURIComponent(sessionId)}/state`);
    return json(r);
  },

  /** SSE 流式提问：逐字推送主持人回答 */
  askSoloStream(
    sessionId: string,
    question: string,
    onEvent: (e: SoloStreamEvent) => void,
    signal?: AbortSignal,
  ): void {
    const url = `${BASE}/solo/ask?sessionId=${encodeURIComponent(
      sessionId,
    )}&question=${encodeURIComponent(question)}`;
    safeFetch(url, { signal }, 2)
      .then((r) => {
        if (!r.body) throw new Error('不支持的流式响应');
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        const pump = (): Promise<void> =>
          reader.read().then(({ value, done }) => {
            if (done) return;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop() || '';
            for (const part of parts) {
              const line = part.trim();
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              try {
                onEvent(JSON.parse(payload));
              } catch {
                /* ignore */
              }
            }
            return pump();
          });
        return pump();
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') {
          onEvent({ type: 'error', message: (e as Error).message });
        }
      });
  },

  async batchParse(rawText: string): Promise<{ puzzles: SubmissionInput[] }> {
    const r = await safeFetch(`${BASE}/submissions/batch-parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    });
    return json(r);
  },

  async submitPuzzle(input: SubmissionInput) {
    const r = await safeFetch(`${BASE}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return json<{ ok: boolean; id: string; status: string }>(r);
  },

  async listSubmissions(pass: string, status?: string) {
    const r = await safeFetch(`${BASE}/submissions/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass, status }),
    });
    return json<{ submissions: SubmissionItem[] }>(r);
  },

  async moderate(id: string, action: 'approve' | 'reject', pass: string) {
    const r = await safeFetch(`${BASE}/submissions/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass }),
    });
    return json<{ ok: boolean }>(r);
  },

  async listRooms(): Promise<RoomInfo[]> {
    const d = await json<{ rooms: RoomInfo[] }>(await safeFetch(`${BASE}/rooms`));
    return d.rooms;
  },

  /** 获取当前 API 配置（密钥脱敏） */
  async getConfig(): Promise<ApiConfig> {
    const r = await safeFetch(`${BASE}/config`);
    return json<ApiConfig>(r);
  },

  /** 更新 API 配置 */
  async updateConfig(input: ApiConfigInput): Promise<{ ok: boolean; updated: string[] }> {
    const r = await safeFetch(`${BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return json(r);
  },

  /** 验证 API 密钥是否有效 */
  async verifyConfig(input: {
    apiKey: string;
    baseURL?: string;
    model?: string;
  }): Promise<{ ok: boolean; message?: string; error?: string }> {
    const r = await safeFetch(`${BASE}/config/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return r.json() as Promise<{ ok: boolean; message?: string; error?: string }>;
  },
};

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

/** API 配置状态（服务端返回，密钥脱敏） */
export interface ApiConfig {
  apiKey: string;      // 掩码后
  baseURL: string;
  model: string;
  useAI: boolean;
  hasKey: boolean;
  testMode: boolean;
}

/** API 配置更新输入 */
export interface ApiConfigInput {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  useAI?: boolean;
  testMode?: boolean;
}

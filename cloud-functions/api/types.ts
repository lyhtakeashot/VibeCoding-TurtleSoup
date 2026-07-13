export type Difficulty = 'easy' | 'medium' | 'hard' | 'unlimited';
export type AnswerKind = 'yes' | 'no' | 'irrelevant' | 'partial';

export interface Puzzle {
  id: string;
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  maxQuestions: number;
  tags: string[];
  hints: string[];
  /** 可选：AI 生成配图地址（运行时由前端按 id 引用静态资源） */
  image?: string;
  /** 作者（官方题库或投稿者昵称），用于选题意列表展示 */
  author?: string;
  /** 发布日期（毫秒时间戳），用于选题意列表展示 */
  createdAt?: number;
}

export interface QAItem {
  id: string;
  question: string;
  answer: AnswerKind;
  note?: string;
  /** 回答来源：AI / 兜底 */
  source?: 'ai' | 'fallback';
  /** 多人模式下的提问者昵称 */
  playerName?: string;
  /** 该问题对还原汤底的贡献度（0~1），由 AI 评估 */
  progressGain?: number;
}

export interface Submission {
  id: string;
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  hints: string[];
  tags: string[];
  author: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

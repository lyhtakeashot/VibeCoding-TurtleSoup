import { config } from './config.js';
import type { Puzzle, AnswerKind, QAItem } from './types.js';

export interface HostReply {
  answer: AnswerKind;
  note: string;
  source: 'ai';
  /** 该问题对还原汤底的贡献度（0~1），由 AI 评估 */
  progressGain: number;
}

function normalize(q: string): string {
  return q.trim().toLowerCase();
}

/** 基于历史记录的重复问题检测：若新问题与历史问题高度相似，返回提示 */
const DUPLICATE_THRESHOLD = 0.7;

function detectDuplicate(question: string, history: QAItem[]): HostReply | null {
  if (history.length === 0) return null;
  const q = normalize(question);
  const qTokens = new Set(q.split(''));
  for (const h of history) {
    const hTokens = new Set(normalize(h.question).split(''));
    const intersection = [...qTokens].filter((t) => hTokens.has(t)).length;
    const union = new Set([...qTokens, ...hTokens]).size;
    const similarity = union > 0 ? intersection / union : 0;
    if (similarity > DUPLICATE_THRESHOLD) {
      return {
        answer: 'irrelevant' as AnswerKind,
        note: '',
        source: 'ai',
        progressGain: 0,
      };
    }
  }
  return null;
}

/**
 * 主持人作答主入口。
 * 流程：AI 可用性检查 → 重复检测 → AI 调用（必走，无兜底）
 */
export async function hostAnswer(
  puzzle: Puzzle,
  question: string,
  _history: QAItem[] = [],
): Promise<HostReply> {
  // 1) 检查 AI 是否可用
  if (!config.useAI) {
    throw new Error('AI 功能未启用，请先在设置页面开启 AI');
  }
  if (!config.hasAIKey && !config.testMode) {
    throw new Error('请先配置 API Key 或开启 CodeBuddy 测试模式');
  }

  // 2) 基于历史记录检测重复问题
  const dup = detectDuplicate(question, _history);
  if (dup) return dup;

  // 3) AI 调用（失败则抛错，由调用方处理）
  const { answerWithAI } = await import('./ai/client.js');
  const ai = await answerWithAI(puzzle, question, _history);
  return { answer: ai.answer, note: ai.note, source: 'ai', progressGain: ai.progressGain };
}

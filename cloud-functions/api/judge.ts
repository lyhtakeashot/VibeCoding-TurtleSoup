import { config } from './config.js';
import type { Puzzle } from './types.js';

export interface JudgeResult {
  correct: boolean;
  feedback: string;
  source: 'ai' | 'fallback';
}

/** 揭晓/猜中判定：全部交由 AI 评判 */
export async function judgeGuess(puzzle: Puzzle, guess: string): Promise<JudgeResult> {
  if (config.useAI && (config.hasAIKey || config.testMode)) {
    try {
      const { judgeWithAI } = await import('./ai/client.js');
      return await judgeWithAI(puzzle, guess);
    } catch (err) {
      console.warn('[judge] AI 调用失败，降级兜底：', (err as Error).message);
      return {
        correct: false,
        feedback: '判定服务暂不可用，请稍后重试。',
        source: 'fallback',
      };
    }
  }

  // 无 AI 时无法准确判定，给出提示
  return {
    correct: false,
    feedback: 'AI 未启用，无法自动判定。请直接对照汤底自行判断。汤底如下：' + puzzle.solution,
    source: 'fallback',
  };
}

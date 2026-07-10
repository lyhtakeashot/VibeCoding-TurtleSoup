/**
 * 题库扩充独立脚本：调用 AI 批量生成海龟汤题目，追加到 puzzles.json。
 *
 * 使用方式：
 *   npx tsx server/src/scripts/expandPuzzles.ts [count]
 *
 * 示例：
 *   npx tsx server/src/scripts/expandPuzzles.ts 10
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUZZLES_FILE = path.resolve(__dirname, '../../data/puzzles.json');

// 动态导入，避免顶层 await 问题
async function main() {
  const { generatePuzzleBatch } = await import('../ai/puzzleGenerator.js');

  const count = Math.max(1, Math.min(20, parseInt(process.argv[2] || '10', 10)));
  console.log(`[expandPuzzles] 开始生成 ${count} 道新题目...`);

  const newPuzzles = await generatePuzzleBatch(count);
  if (newPuzzles.length === 0) {
    console.log('[expandPuzzles] 没有成功生成任何题目，请检查 AI 配置。');
    process.exit(1);
  }

  // 读取现有题库
  let existing: any[] = [];
  try {
    existing = JSON.parse(fs.readFileSync(PUZZLES_FILE, 'utf-8'));
  } catch {
    console.warn('[expandPuzzles] 无法读取现有题库，将创建新文件。');
  }

  // 合并并写入
  const merged = [...existing, ...newPuzzles];
  fs.writeFileSync(PUZZLES_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`[expandPuzzles] 完成！已追加 ${newPuzzles.length} 道题目到 ${PUZZLES_FILE}`);
  console.log(`[expandPuzzles] 题库总量：${merged.length} 道`);
}

main().catch((e) => {
  console.error('[expandPuzzles] 错误:', e);
  process.exit(1);
});

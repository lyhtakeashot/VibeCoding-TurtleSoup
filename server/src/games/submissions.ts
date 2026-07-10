import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Submission, Difficulty } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../../data/submissions.json');

function readAll(): Submission[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as Submission[];
  } catch {
    return [];
  }
}

function writeAll(list: Submission[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

export interface SubmissionInput {
  title: string;
  surface: string;
  solution: string;
  difficulty: Difficulty;
  hints: string[];
  tags: string[];
  author: string;
}

export function listSubmissions(status?: Submission['status']): Submission[] {
  const all = readAll();
  return status ? all.filter((s) => s.status === status) : all;
}

export function createSubmission(input: SubmissionInput): Submission {
  const all = readAll();
  const sub: Submission = {
    id: crypto.randomUUID(),
    title: input.title || input.surface.slice(0, 14),
    ...input,
    author: input.author.trim() || '匿名作者',
    status: 'pending',
    createdAt: Date.now(),
  };
  all.push(sub);
  writeAll(all);
  return sub;
}

export function setStatus(
  id: string,
  status: 'approved' | 'rejected',
): Submission | null {
  const all = readAll();
  const sub = all.find((s) => s.id === id);
  if (!sub) return null;
  sub.status = status;
  writeAll(all);
  return sub;
}

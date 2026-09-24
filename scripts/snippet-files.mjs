// Which workshop files the site shows. `npm run sync` copies them, `check:sync` compares them.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

export const WORKSHOP = process.env.WORKSHOP_DIR ?? '../ama-rag-workshop';
const CODE_ROOTS = ['src', 'bruno', 'solutions'];
const CODE_FILES = ['compose.yaml', 'package.json', 'env.example', 'eval/gold.jsonl', 'corpus/2025/hr-leave.md', 'corpus/2025/it-security.md', 'corpus/2025/announcement-meal-card.md'];

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** [source path in the workshop, destination path in this repo] */
export function snippetPairs() {
  const pairs = [];
  for (const root of CODE_ROOTS) {
    for (const f of walk(join(WORKSHOP, root))) pairs.push([f, join('src/snippets/code', relative(WORKSHOP, f))]);
  }
  for (const f of CODE_FILES) pairs.push([join(WORKSHOP, f), join('src/snippets/code', f)]);
  const logs = join(WORKSHOP, 'logs');
  if (existsSync(logs)) for (const f of walk(logs)) pairs.push([f, join('src/snippets/logs', relative(logs, f))]);
  return pairs;
}

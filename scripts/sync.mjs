// npm run sync — copy code and recorded logs from the workshop repo into src/snippets/ (committed, so a
// build without the workshop next to it — Vercel — still has them).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { snippetPairs } from './snippet-files.mjs';

rmSync('src/snippets', { recursive: true, force: true });
const pairs = snippetPairs();
for (const [from, to] of pairs) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}
console.log(`sync ✓ ${pairs.length} files → src/snippets/`);

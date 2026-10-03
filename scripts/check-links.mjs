// Runs after `astro build`. Internal links in dist/: every href="/…" must hit a built page, every #anchor an id
// on it, and no /en/ page may link to a Turkish page (or the other way round; only a Turkish page may link to "/").
// A Starlight fallback page (a Turkish page served under /en/ while its twin is missing) is skipped here: its
// links are Turkish by construction, and check-en fails on the page itself.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const dist = process.argv[2] ?? 'dist';
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const pages = walk(dist).filter((f) => f.endsWith('.html'));
const ids = new Map();
const idsOf = (f) => {
  if (!ids.has(f)) ids.set(f, new Set([...readFileSync(f, 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])));
  return ids.get(f);
};
let bad = 0, n = 0, fallbacks = 0;
for (const f of pages) {
  const rel = '/' + relative(dist, f).replace(/index\.html$/, '');
  const isEn = rel.startsWith('/en/');
  const html = readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  if (isEn && /<main\b[^>]*\blang="tr"/.test(html)) { fallbacks++; continue; }
  // Skip Starlight chrome that legitimately crosses languages: the language picker and hreflang links.
  const body = html.replace(/<starlight-lang-select[\s\S]*?<\/starlight-lang-select>/g, '');
  for (const [, href] of body.matchAll(/href="(\/[^"]*)"/g)) {
    if (/^\/(_astro|favicon|pagefind)/.test(href)) continue;
    n++;
    const [path, hash] = href.split('#');
    const target = join(dist, decodeURIComponent(path), path.endsWith('/') ? 'index.html' : '');
    const file = existsSync(target) && statSync(target).isFile() ? target : join(dist, decodeURIComponent(path), 'index.html');
    if (!existsSync(file)) { bad++; console.log(`missing  ${rel} → ${href}`); continue; }
    if (hash && !idsOf(file).has(decodeURIComponent(hash))) { bad++; console.log(`anchor   ${rel} → ${href}`); }
    const toEn = path === '/en' || path.startsWith('/en/');
    if (isEn !== toEn && (isEn || path !== '/')) { bad++; console.log(`language ${rel} → ${href}`); }
  }
}
const skipped = fallbacks ? ` (${fallbacks} fallback page(s) under /en/ skipped)` : '';
console.log(bad ? `check:links ✗ ${bad} of ${n}${skipped}` : `check:links ✓ ${n} internal links resolve, none crosses languages${skipped}`);
process.exit(bad ? 1 : 0);

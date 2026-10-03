// Word lists shared by check-dist.mjs (every page) and check-en.mjs (English pages), and the helper that turns
// built HTML into the prose a reader hears. One shared screen: no stage directions; English is read aloud by a
// non-native speaker: short sentences, common words, no connector chains or idioms.

// Turkish stage directions and trainer wording. Scanned on the full text: Turkish never appears in the data.
export const STAGE_TR = /\b(eğitmen|projektör|salon|katılımcılar?|sunumda de|sorulabilir|fikri olan|el kaldır|odanın|odada)/i;
// English stage directions. Scanned on prose only (D12): the logs, corpus and model answers are English and render
// on both languages' pages, and they cannot be edited to dodge a word list.
export const STAGE_EN = /\b(trainers?|instructors?|presenters?|speakers?|facilitators?|teachers?|participants?|attendees?|audience|students?|learners?|the room|everyone in|projector|show of hands|raise (your|a) hands?|hands up|ask (the|your) (room|class|group)|(ask|tell) (them|everybody)|let'?s pause|pause here|wait for (them|everyone)|give (them|everyone) (a minute|time)|screen[- ]shar\w+|shared screen|on the (big )?screen|(he|she) (says|asks|shows))\b/i;

// Fail on English pages (style-guide §5). Connectors and formal linkers: write "and", "but", "so", "because".
export const CONNECTOR = /\b(therefore|thus|hence|however|nevertheless|nonetheless|moreover|furthermore|whereas|thereby|whereby|wherein|albeit|notwithstanding|additionally|in addition|consequently|subsequently|accordingly|conversely|meanwhile|on the other hand|as well as|in order to|due to the fact|in terms of|with regard to|regarding|respectively|namely|indeed|hereby|herein|thereof|whilst|amongst|upon)\b/i;
// Rare or formal words. "Retrieval-Augmented" (the name) is allowed.
export const RARE = /\b(leverag\w*|utili[sz]\w*|demonstrat\w*|facilitat\w*|obtain\w*|sufficient\w*|insufficient\w*|approximately|numerous|commenc\w*|terminat\w*|endeavou?r\w*|ascertain\w*|salient|nuanced?|ostensibl\w*|aforementioned|the former|the latter|comprises?|constitut\w*|pertain\w*|encompass\w*|mitigat\w*|paramount|pivotal|intricate|discrepanc\w*|prior to|per se|a priori|inherent\w*|arguabl\w*|essentially|ultimately|notably|plethora|myriad|paradigm|robust|seamless\w*|holistic\w*|synerg\w*|verbatim|hunch|supplies|(?<!Retrieval-)augment\w*)\b/i;
// Idioms and clever phrasing.
export const IDIOM = /\b(silver bullet|rule of thumb|under the hood|sweet spot|deep dive|game[- ]chang\w*|out of the box|at the end of the day|ballpark|low[- ]hanging|needle in a haystack|razor[- ]thin|piece of cake|tip of the iceberg|moving parts|sanity check|gotcha|on the fly|in a nutshell|bottom line|by and large|all in all|so to speak|grain of salt|rabbit hole|double[- ]edged|cut corners|on faith|you['’]?re set|kicks? in|falls? short|pays? off|boils? down|comes? down to|goes a long way|on top of that|last but not least|spot on|in the wild|baked in(to)?|complete with|nudg\w*|the catch is)\b/i;
// Things that must be read out as symbols or letters.
export const ABBR = /(\be\.g\.|\bi\.e\.|\betc\.|\bcf\.|\bvs\.|~\s?\d|≈)/i;

// Warn only.
export const FILLER = /\b(just|simply|basically|actually|really|very|obviously|clearly|of course|powerful|let['’]?s dive|in this section we)\b/i;
export const HEAVY_CONTRACTION = /\b\w+['’](d|ve)\b/i; // you'd, we've: spell out
export const PERFECT = /\b(would|could|should|might) have\b|\bhad been\b/i;
export const EMDASH_ASIDE = /\S\s—\s[^.]*\s—\s/; // two em dashes = an aside

export const FAIL_LISTS = { stage: STAGE_EN, connector: CONNECTOR, rare: RARE, idiom: IDIOM, abbr: ABBR };
export const WARN_LISTS = { filler: FILLER, contraction: HEAVY_CONTRACTION, perfect: PERFECT, 'em-dash': EMDASH_ASIDE };

/** Every match of `re` in `text` (re is used with the g flag added). */
export const allMatches = (re, text) => [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))];

const ENTITIES = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–' };
export const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e] ?? m));

/** Built HTML → the prose a reader hears: no scripts, styles, code, logs (Expressive Code frames hold a <pre>),
 *  drawings or quoted data (“…” or "…"); tags become spaces. */
export function proseText(html) {
  const t = decode(html
    .replace(/<(script|style|pre|code|svg)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' '));
  return t.replace(/“[^”]*”/g, ' QUOTE ').replace(/"[^"\n]*"/g, ' QUOTE ').replace(/[ \t\r\n]+/g, ' ');
}

/** Sentences of a prose string; a code span or a quote already counts as one word. */
export const sentences = (s) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
export const words = (s) => s.split(/\s+/).filter(Boolean).length;

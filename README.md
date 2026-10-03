# ama-rag-site

The course pages of the RAG day, in Turkish and English: why RAG, the architecture, the pipeline built stage by stage in
[ama-rag-workshop](https://github.com/kuthaygumus/ama-rag-workshop), and how to judge it for accuracy,
security, performance and cost. Astro + Starlight.

```sh
npm ci
npm run dev        # http://localhost:4321
npm run build      # source guards + check:i18n --strict + astro build + dist guards + check:en --fail-length + check:links
```

**No hand-typed output.** Code excerpts and terminal logs on the pages come from the workshop repo:
run `npm run capture` there, then `npm run sync` here (copies into `src/snippets/`, committed).
`check:sync` fails the build when a snippet drifted; it is skipped when the workshop repo is not next to this
one (e.g. on Vercel).

**Two languages, one skeleton.** Turkish is the default (`/…`); every page has an English twin at the same path
under `src/content/docs/en/` (served at `/en/…`, switched with the language picker in the header). The data is
English in both languages: the workshop's corpus, logs, code and model answers are English (one policy, it-security,
is Turkish on purpose). The Turkish pages quote that English data and narrate it in Turkish; the English pages quote
the same lines. Numbers on the pages come from the logs: `scripts/dev/fill.mjs` fills the English drafts and
`npm run gen:drawings` draws the data figures, never by hand.
`check:i18n` fails the build when a twin is missing, when the two pages stop sharing their skeleton (components,
log and code references, deck steps and drawing animation, headings, backticked commands) or when an English page
links to a Turkish one; it only warns when numbers or marked terms differ, so a quick Turkish fix still deploys.
`check:en` reads the built English pages for stage directions, formal connectors, rare words, idioms, Turkish
fallback pages and unfilled `⟦…⟧` placeholders, because the English text is read aloud to a room. Edit both pages
together. UI strings live in `src/content/i18n/{tr,en}.json`, box labels in `custom.css` (`:lang(en)`), term
popovers in `src/scripts/terms.js` and `terms-en.js` (same ids).

Keys on the site: ← → walk a step deck, `F` toggles present mode.

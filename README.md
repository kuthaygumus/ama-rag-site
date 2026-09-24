# ama-rag-site

The course pages of the RAG day (Turkish): why RAG, the architecture, the pipeline built stage by stage in
[ama-rag-workshop](https://github.com/kuthaygumus/ama-rag-workshop), and how to judge it for accuracy,
security, performance and cost. Astro + Starlight.

```sh
npm ci
npm run dev        # http://localhost:4321
npm run build      # check:sync + check:legacy + astro build + dist guards
```

**No hand-typed output.** Code excerpts and terminal logs on the pages come from the workshop repo:
run `npm run capture` there, then `npm run sync` here (copies into `src/snippets/`, committed).
`check:sync` fails the build when a snippet drifted; it is skipped when the workshop repo is not next to this
one (e.g. on Vercel).

Keys on the site: ← → walk a step deck, `F` toggles present mode.

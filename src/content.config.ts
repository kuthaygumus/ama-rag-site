import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

/** The site's own UI strings, read in components with Astro.locals.t('rag.…'); one file per locale in src/content/i18n/. */
const ragStrings = z.object({
  'rag.dayq.question': z.string(),
  'rag.dayq.logs': z.string().optional(),
  'rag.guess.label': z.string(),
  'rag.guess.unit': z.string(),
  'rag.guess.note': z.string(),
  'rag.guess.echoBefore': z.string(),
  'rag.guess.echoAfter': z.string(),
  'rag.panel.close': z.string(),
  'rag.where.label': z.string(),
  'rag.where.once': z.string(),
  'rag.where.every': z.string(),
  'rag.where.load': z.string(),
  'rag.where.clean': z.string(),
  'rag.where.chunk': z.string(),
  'rag.where.question': z.string(),
  'rag.where.search': z.string(),
  'rag.where.answer': z.string(),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema({ extend: ragStrings.partial() }) }),
};

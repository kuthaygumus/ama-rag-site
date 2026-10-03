// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { terms, termPopoverScript } from './src/scripts/terms.js';
import { termsEn } from './src/scripts/terms-en.js';
import { deckScript } from './src/scripts/deck.js';
import { presentScript } from './src/scripts/present.js';
import { guessScript } from './src/scripts/guess.js';
import { panelScript } from './src/scripts/panel.js';

const termScript = termPopoverScript.replace('__TERM_DEFS__', () => JSON.stringify({ tr: terms, en: termsEn }));

/** [slug, Turkish label, English label] triples → sidebar items. */
const items = (/** @type {[string, string, string][]} */ list) =>
  list.map(([slug, label, en]) => ({ slug, label, translations: { en } }));

export default defineConfig({
  integrations: [
    starlight({
      title: { tr: 'RAG, adım adım', en: 'RAG, step by step' },
      description:
        'Bir RAG pipeline’ını adım adım kurmak: veri hazırlama, chunking, embedding, vector DB, retrieval, rerank, cevap üretimi ve kaliteyi ölçmek.',
      defaultLocale: 'root',
      locales: { root: { label: 'Türkçe', lang: 'tr' }, en: { label: 'English', lang: 'en' } },
      tableOfContents: false,
      customCss: ['@fontsource/kalam/400.css', '@fontsource/kalam/700.css', './src/styles/custom.css'],
      head: [
        { tag: 'script', content: presentScript },
        { tag: 'script', content: termScript },
        { tag: 'script', content: deckScript },
        { tag: 'script', content: guessScript },
        { tag: 'script', content: panelScript },
      ],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/kuthaygumus/ama-rag-workshop' }],
      sidebar: [
        { slug: 'index', label: 'Ana sayfa', translations: { en: 'Home' } },
        {
          label: 'Başlamadan',
          translations: { en: 'Before we start' },
          items: items([
            ['baslamadan/kurulum', 'Kurulum', 'Setup'],
            ['baslamadan/gunun-sorusu', 'Günün sorusu', 'Question of the day'],
          ]),
        },
        {
          label: '1 · Neden RAG?',
          translations: { en: '1 · Why RAG?' },
          items: items([
            ['neden-rag/model-bilmiyor', 'Model bilmiyor', 'The model doesn’t know'],
            ['neden-rag/ragsiz-ragli', 'RAG’siz / RAG’li', 'Without RAG / with RAG'],
            ['neden-rag/rag-nedir', 'RAG nedir?', 'What is RAG?'],
            ['neden-rag/rag-mi-fine-tune-mu', 'RAG mı fine-tune mı?', 'RAG or fine-tuning?'],
          ]),
        },
        {
          label: '2 · Mimari',
          translations: { en: '2 · Architecture' },
          items: items([['mimari', 'İki şerit, bir vektör uzayı', 'Two lanes, one vector space']]),
        },
        {
          label: '3 · Adım adım kuralım',
          translations: { en: '3 · Build it step by step' },
          items: items([
            ['adim-adim/a-ham-veri', 'A · Ham veri ve temizlik', 'A · Raw data and cleaning'],
            ['adim-adim/b-chunking', 'B · Chunking', 'B · Chunking'],
            ['adim-adim/c-embedding', 'C · Embedding', 'C · Embedding'],
            ['adim-adim/d-vector-db', 'D · Vector DB', 'D · Vector DB'],
            ['adim-adim/e-retrieval-rerank', 'E · Retrieval ve rerank', 'E · Retrieval and reranking'],
            ['adim-adim/f-cevap', 'F · Cevap üretimi', 'F · Generating the answer'],
            ['adim-adim/veri-degisince', 'Veri değişince', 'When the data changes'],
          ]),
        },
        {
          label: '4 · Canlıya hazır mı?',
          translations: { en: '4 · Ready for production?' },
          items: items([
            ['uretim/kaliteyi-olcmek', 'Kaliteyi ölçmek', 'Measuring quality'],
            ['uretim/guvenlik', 'Güvenlik', 'Security'],
            ['uretim/performans-maliyet', 'Performans ve maliyet', 'Performance and cost'],
          ]),
        },
        {
          label: '5 · Her derde deva mı?',
          translations: { en: '5 · Does RAG fix everything?' },
          items: items([
            ['her-derde-deva/sinirlar-ve-turler', 'Sınırlar ve RAG türleri', 'Limits and RAG variants'],
            ['her-derde-deva/ilk-90-gun', 'İlk 90 gün', 'The first 90 days'],
          ]),
        },
        { label: 'Kapanış', translations: { en: 'Wrap-up' }, items: items([['kapanis', 'Kapanış', 'Wrap-up']]) },
        {
          label: 'Ekler',
          translations: { en: 'Appendix' },
          items: items([
            ['sozluk', 'Sözlük', 'Glossary'],
            ['kurulum-sorunlari', 'Kurulum sorunları', 'Setup problems'],
          ]),
        },
      ],
    }),
  ],
});

// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { terms, termPopoverScript } from './src/scripts/terms.js';
import { deckScript } from './src/scripts/deck.js';
import { presentScript } from './src/scripts/present.js';

const termScript = termPopoverScript.replace('__TERM_DEFS__', JSON.stringify(terms));

/** [slug, label] pairs → sidebar items. */
const items = (/** @type {[string, string][]} */ list) => list.map(([slug, label]) => ({ slug, label }));

export default defineConfig({
  integrations: [
    starlight({
      title: 'RAG, adım adım',
      description:
        'Bir RAG pipeline’ını adım adım kurmak: veri hazırlama, chunking, embedding, vector DB, retrieval, rerank, cevap üretimi ve kaliteyi ölçmek.',
      defaultLocale: 'root',
      locales: { root: { label: 'Türkçe', lang: 'tr' } },
      tableOfContents: false,
      customCss: ['@fontsource/kalam/400.css', '@fontsource/kalam/700.css', './src/styles/custom.css'],
      head: [
        { tag: 'script', content: presentScript },
        { tag: 'script', content: termScript },
        { tag: 'script', content: deckScript },
      ],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/kuthaygumus/ama-rag-workshop' }],
      sidebar: [
        { label: 'Başlamadan', items: items([['baslamadan/kurulum', 'Kurulum'], ['baslamadan/gunun-sorusu', 'Günün sorusu']]) },
        {
          label: '1 · Neden RAG?',
          items: items([
            ['neden-rag/model-bilmiyor', 'Model bilmiyor'],
            ['neden-rag/ragsiz-ragli', 'RAG’siz / RAG’li'],
            ['neden-rag/rag-nedir', 'RAG nedir?'],
            ['neden-rag/rag-mi-fine-tune-mu', 'RAG mı fine-tune mı?'],
          ]),
        },
        { label: '2 · Mimari', items: items([['mimari', 'İki şerit, bir vektör uzayı']]) },
        {
          label: '3 · Adım adım kuralım',
          items: items([
            ['adim-adim/a-ham-veri', 'A · Ham veri ve temizlik'],
            ['adim-adim/b-chunking', 'B · Chunking'],
            ['adim-adim/c-embedding', 'C · Embedding'],
            ['adim-adim/d-vector-db', 'D · Vector DB'],
            ['adim-adim/e-retrieval-rerank', 'E · Retrieval ve rerank'],
            ['adim-adim/f-cevap', 'F · Cevap üretimi'],
            ['adim-adim/veri-degisince', 'Veri değişince'],
          ]),
        },
        {
          label: '4 · Üretime hazır mı?',
          items: items([
            ['uretim/kaliteyi-olcmek', 'Kaliteyi ölçmek'],
            ['uretim/guvenlik', 'Güvenlik'],
            ['uretim/performans-maliyet', 'Performans ve maliyet'],
          ]),
        },
        {
          label: '5 · Her derde deva mı?',
          items: items([
            ['her-derde-deva/sinirlar-ve-turler', 'Sınırlar ve RAG türleri'],
            ['her-derde-deva/ilk-90-gun', 'İlk 90 gün'],
          ]),
        },
        { label: 'Kapanış', items: items([['kapanis', 'Kapanış']]) },
        { label: 'Başvuru', items: items([['sozluk', 'Sözlük'], ['kurulum-sorunlari', 'Kurulum sorunları']]) },
      ],
    }),
  ],
});

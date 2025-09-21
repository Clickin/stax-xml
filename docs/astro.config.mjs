import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
// import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

export default defineConfig({
  integrations: [
    starlight({
      title: 'StAX-XML',
      description: 'High-performance XML parser for JavaScript/TypeScript',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        ko: {
          label: '한국어',
          lang: 'ko',
        },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Clickin/stax-xml',
        },
      ],
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:title',
            content: 'StAX-XML - High-performance XML parser for JavaScript/TypeScript'
          }
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:description',
            content: 'High-performance XML parser for JavaScript/TypeScript'
          }
        }
      ],
      sidebar: [
        {
          label: 'Guide',
          items: [
            { label: 'Getting Started', slug: 'guide/getting-started' },
            { label: 'Quick Start', slug: 'guide/quick-start' },
            { label: 'Examples', slug: 'guide/examples' },
          ],
        },
        {
          label: 'API Guides',
          items: [
            { label: 'StaxXmlParser', slug: 'api-guides/staxxml-parser' },
            { label: 'StaxXmlParserSync', slug: 'api-guides/staxxml-parser-sync' },
            { label: 'StaxXmlWriter', slug: 'api-guides/staxxml-writer' },
            { label: 'StaxXmlWriterSync', slug: 'api-guides/staxxml-writer-sync' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', slug: 'api/overview' },
          ],
        },
        {
          label: 'Resources',
          items: [
            { label: 'Benchmarks', slug: 'resources/benchmarks' },
            { label: 'FAQ', slug: 'resources/faq' },
          ],
        },
      ],
    }),
    // starlightTypeDoc({
    //   entryPoints: ['../src/*.ts'],
    //   typeDoc: {
    //     entryPointStrategy: 'expand',
    //     gitRevision: 'master',
    //     readme: 'none',
    //     sort: ['source-order'],
    //     categoryOrder: ['*', 'Other'],
    //     hideGenerator: true,
    //     includeVersion: true,
    //     plugin: [],
    //     exclude: ['../src/**/*.test.ts', '../src/**/*.spec.ts'],
    //     excludeExternals: true,
    //     skipErrorChecking: true,
    //   },
    //   sidebar: {
    //     label: 'API Reference',
    //     collapsed: false,
    //   },
    //   pagination: true,
    // }),
  ],
  output: 'static',
  site: 'https://clickin.github.io',
  base: '/stax-xml',
});

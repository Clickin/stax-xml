import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
// import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        'stax-xml/converter': fileURLToPath(new URL('../stax-xml/src/converter/index.ts', import.meta.url)),
        'stax-xml': fileURLToPath(new URL('../stax-xml/src/index.ts', import.meta.url)),
      },
    },
  },
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
        // Enhanced OpenGraph Protocol
        {
          tag: 'meta',
          attrs: {
            property: 'og:title',
            content: 'StAX-XML - High-Performance JavaScript XML Parser Library'
          }
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:description',
            content: 'Fast, streaming XML parser for JavaScript/TypeScript. Works in Node.js, Bun, Deno, and browsers. Memory-efficient processing of large XML files with TypeScript support.'
          }
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:type',
            content: 'website'
          }
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:url',
            content: 'https://clickin.github.io/stax-xml'
          }
        },
        // OpenGraph image will be dynamically generated per page
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:width',
            content: '1200'
          }
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:height',
            content: '630'
          }
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:site_name',
            content: 'StAX-XML Documentation'
          }
        },

        // Twitter Card Optimization
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:card',
            content: 'summary_large_image'
          }
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:title',
            content: 'StAX-XML - JavaScript XML Parser for Node.js, Bun, Deno'
          }
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:description',
            content: 'High-performance streaming XML parser library for JavaScript/TypeScript. Memory-efficient processing with full platform compatibility.'
          }
        },
        // Twitter image will be dynamically generated per page

        // Enhanced Meta Tags for SEO
        {
          tag: 'meta',
          attrs: {
            name: 'keywords',
            content: 'XML parser JavaScript, TypeScript XML parser, Node.js XML parser, streaming XML parser, JavaScript XML library, Bun XML parser, Deno XML parser, XML processing JavaScript, high performance XML parser, memory efficient XML parser'
          }
        },
        {
          tag: 'meta',
          attrs: {
            name: 'author',
            content: 'StAX-XML Contributors'
          }
        },
        {
          tag: 'meta',
          attrs: {
            name: 'robots',
            content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
          }
        },

        // Critical Resource Preloading
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.googleapis.com'
          }
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossorigin: ''
          }
        },
        {
          tag: 'link',
          attrs: {
            rel: 'dns-prefetch',
            href: 'https://github.com'
          }
        },

        // Schema.org Structured Data for Software Library
        {
          tag: 'script',
          attrs: {
            type: 'application/ld+json'
          },
          content: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "StAX-XML",
            "description": "High-performance, streaming XML parser for JavaScript and TypeScript with universal platform compatibility",
            "applicationCategory": "DeveloperApplication",
            "operatingSystem": ["Windows", "macOS", "Linux"],
            "programmingLanguage": ["JavaScript", "TypeScript"],
            "runtimePlatform": ["Node.js", "Bun", "Deno", "Web Browser"],
            "downloadUrl": "https://www.npmjs.com/package/stax-xml",
            "codeRepository": "https://github.com/Clickin/stax-xml",
            "license": "https://github.com/Clickin/stax-xml/blob/master/LICENSE",
            "author": {
              "@type": "Organization",
              "name": "StAX-XML Contributors",
              "url": "https://github.com/Clickin/stax-xml"
            },
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "keywords": ["XML parser", "JavaScript", "TypeScript", "Node.js", "streaming", "high-performance"]
          })
        }
      ],
      sidebar: [
        {
          label: 'Guide',
          translations: {
            ko: '가이드',
          },
          items: [
            { label: 'Getting Started', slug: 'guide/getting-started', translations: { ko: '시작하기' } },
            { label: 'Quick Start', slug: 'guide/quick-start', translations: { ko: '빠른 시작' } },
            { label: 'Examples', slug: 'guide/examples', translations: { ko: '예제' } },
          ],
        },
        {
          label: 'API Guides',
          translations: {
            ko: 'API 가이드',
          },
          items: [
            { label: 'StaxXmlParser', slug: 'api-guides/staxxml-parser' },
            { label: 'StaxXmlParserSync', slug: 'api-guides/staxxml-parser-sync' },
            { label: 'StaxXmlCursorReader', slug: 'api-guides/staxxmlcursorreader' },
            { label: 'StaxXmlWriter', slug: 'api-guides/staxxml-writer' },
            { label: 'StaxXmlWriterSync', slug: 'api-guides/staxxml-writer-sync' },
          ],
        },
        {
          label: 'Converter',
          items: [
            { label: 'Getting Started', slug: 'converter/getting-started', translations: { ko: '시작하기' } },
            { label: 'Interactive Demo', slug: 'converter/demo', translations: { ko: '인터랙티브 데모' } },
            { label: 'Core Concepts', slug: 'converter/core-concepts', translations: { ko: '핵심 개념' } },
            { label: 'Schema Types', slug: 'converter/schemas', translations: { ko: '스키마 타입' } },
            { label: 'XPath Guide', slug: 'converter/xpath-guide', translations: { ko: 'XPath 가이드' } },
            { label: 'Transformations', slug: 'converter/transformations', translations: { ko: '변환' } },
            { label: 'Writing XML', slug: 'converter/writing-xml', translations: { ko: 'XML 작성' } },
            { label: 'Examples', slug: 'converter/examples', translations: { ko: '예제' } },
          ],
        },
        {
          label: 'API Reference',
          translations: {
            ko: 'API 레퍼런스',
          },
          items: [
            { label: 'Overview', slug: 'api/overview', translations: { ko: '개요' } },
            { label: 'Core API', slug: 'api/main' },
            { label: 'Converter API', slug: 'api/converter' },
          ],
        },
        {
          label: 'Resources',
          translations: {
            ko: '리소스',
          },
          items: [
            { label: 'Benchmarks', slug: 'resources/benchmarks', translations: { ko: '벤치마크' } },
            { label: 'FAQ', slug: 'resources/faq' },
          ],
        },
      ],
    }),
    mdx(),
  ],
  output: 'static',
  site: 'https://clickin.github.io',
  base: '/stax-xml',
  experimental: {
    rustCompiler: true
  }
});

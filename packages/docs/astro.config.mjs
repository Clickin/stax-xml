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

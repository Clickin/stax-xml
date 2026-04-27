import { getCollection } from 'astro:content'
import { OGImageRoute } from 'astro-og-canvas'

const entries = await getCollection('docs')
const versionedDocIdPattern = /(^|\/)v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(\/|$)/
const pages = Object.fromEntries(
  entries
    .filter(({ id }) => !versionedDocIdPattern.test(id))
    .map(({ data, id }) => [id, { data }]),
)

export const { getStaticPaths, GET } = await OGImageRoute({
  pages,
  param: 'slug',
  getImageOptions: (_id, page) => ({
    title: page.data.title,
    description: page.data.description || 'High-performance XML parser for JavaScript/TypeScript',
    bgGradient: [
      [24, 24, 27],      // Dark gray background
      [63, 63, 70],      // Slightly lighter gray
    ],
    border: {
      color: [168, 85, 247], // Purple accent color matching StAX-XML theme
      width: 20
    },
    padding: 120,
    font: {
      title: {
        size: 72,
        families: ['Inter'],
        weight: 'ExtraBold',
        color: [255, 255, 255], // White text
      },
      description: {
        size: 32,
        families: ['Inter'],
        weight: 'Normal',
        color: [156, 163, 175], // Light gray for description
      },
    },
    fonts: [
      'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
      'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYMZg.ttf',
    ],
  }),
})

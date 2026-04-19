import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('Large File Performance Benchmarks', () => {
  it('should maintain performance with various data sizes', () => {
    const sizes = [100, 500, 1000];
    const benchmarks: { size: number; duration: number }[] = [];

    sizes.forEach(size => {
      let xml = '<data>';
      for (let i = 0; i < size; i++) {
        xml += `<item>${i}</item>`;
      }
      xml += '</data>';

      const schema = x.array(x.number(), '//item');

      const start = performance.now();
      const result = schema.parseSync(xml);
      const duration = performance.now() - start;

      benchmarks.push({ size, duration });
      expect(result).toHaveLength(size);
    });

    // Performance should scale reasonably (not exponentially)
    benchmarks.forEach((benchmark, i) => {
      if (i > 0) {
        const ratio = benchmark.duration / benchmarks[i - 1].duration;
        const sizeRatio = benchmark.size / benchmarks[i - 1].size;
        // Duration ratio should be less than size ratio squared (sub-quadratic)
        expect(ratio).toBeLessThan(sizeRatio * sizeRatio);
      }
    });
  });

  it('should handle mixed large content efficiently', () => {
    const xml = `
      <document>
        <metadata>
          ${Array.from({ length: 50 }, (_, i) =>
            `<meta key="key${i}" value="value${i}"/>`
          ).join('')}
        </metadata>
        <content>
          ${Array.from({ length: 200 }, (_, i) => `
            <paragraph id="${i}">
              <text>Lorem ipsum dolor sit amet ${i}</text>
            </paragraph>
          `).join('')}
        </content>
      </document>
    `;

    const start = performance.now();

    const schema = x.object({
      metadataCount: x.array(x.string(), '//meta/@key').transform(arr => arr.length),
      paragraphCount: x.array(x.string(), '//paragraph/@id').transform(arr => arr.length),
      allTexts: x.array(x.string(), '//text')
    });

    const result = schema.parseSync(xml);
    const duration = performance.now() - start;

    expect(result.metadataCount).toBe(50);
    expect(result.paragraphCount).toBe(200);
    expect(result.allTexts).toHaveLength(200);
    expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
  });
});

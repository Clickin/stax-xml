/**
 * Generate various XML test files for benchmarking with different characteristics
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Helper functions for XML generation
class XmlGenerator {
    static randomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    static randomText(minLength, maxLength) {
        const words = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
            'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore'];
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        let text = '';
        for (let i = 0; i < length; i++) {
            text += words[Math.floor(Math.random() * words.length)] + ' ';
        }
        return text.trim();
    }
    static generateSmallSimple() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <item id="1">First item</item>
  <item id="2">Second item</item>
  <item id="3">Third item</item>
  <nested>
    <child>Nested content</child>
  </nested>
</root>`;
    }
    static generateMediumNested(depth = 10, breadth = 5) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        function generateElement(level) {
            if (level === 0) {
                return `<leaf>${XmlGenerator.randomText(10, 50)}</leaf>`;
            }
            let content = '';
            for (let i = 0; i < breadth; i++) {
                const attrs = Array.from({ length: 3 }, (_, j) => `attr${j}="${XmlGenerator.randomString(10)}"`).join(' ');
                content += `  <element${level}_${i} ${attrs}>\n`;
                content += '    ' + generateElement(level - 1).replace(/\n/g, '\n    ') + '\n';
                content += `  </element${level}_${i}>\n`;
            }
            return content;
        }
        xml += '<root>\n' + generateElement(depth) + '</root>';
        return xml;
    }
    static generateAttributeHeavy(elements = 100) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
        for (let i = 0; i < elements; i++) {
            const attrs = Array.from({ length: 20 }, (_, j) => `attribute${j}="${XmlGenerator.randomString(50)}"`).join('\n         ');
            xml += `  <element id="${i}" ${attrs}>\n`;
            xml += `    ${XmlGenerator.randomText(20, 100)}\n`;
            xml += `  </element>\n`;
        }
        xml += '</root>';
        return xml;
    }
    static generateTextHeavy(paragraphs = 500) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n';
        for (let i = 0; i < paragraphs; i++) {
            xml += `  <paragraph id="${i}">\n`;
            xml += `    <title>${XmlGenerator.randomText(5, 15)}</title>\n`;
            xml += `    <content>${XmlGenerator.randomText(100, 500)}</content>\n`;
            xml += `    <metadata>\n`;
            xml += `      <author>${XmlGenerator.randomString(20)}</author>\n`;
            xml += `      <date>2024-01-${String(i % 30 + 1).padStart(2, '0')}</date>\n`;
            xml += `    </metadata>\n`;
            xml += `  </paragraph>\n`;
        }
        xml += '</document>';
        return xml;
    }
    static generateCDATAHeavy(sections = 100) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
        const codeSnippets = [
            'function test() { return Math.random() * 100; }',
            'const data = { id: 1, name: "test", value: [1, 2, 3] };',
            'if (x > 0 && y < 100) { console.log("Valid range"); }',
            '<html><body><h1>HTML Content</h1></body></html>',
            'SELECT * FROM users WHERE id > 100 AND status = "active";'
        ];
        for (let i = 0; i < sections; i++) {
            xml += `  <section id="${i}">\n`;
            xml += `    <description>${XmlGenerator.randomText(10, 30)}</description>\n`;
            xml += `    <code><![CDATA[\n`;
            xml += codeSnippets[i % codeSnippets.length];
            xml += '\n' + XmlGenerator.randomText(50, 200);
            xml += `\n    ]]></code>\n`;
            xml += `  </section>\n`;
        }
        xml += '</root>';
        return xml;
    }
    static generateNamespaceHeavy() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:app="http://example.com/app"
      xmlns:data="http://example.com/data"
      xmlns:meta="http://example.com/meta"
      xmlns:config="http://example.com/config">
  <app:application>
    <app:name>Test Application</app:name>
    <app:version>1.0.0</app:version>
    <app:settings>
      <config:database>
        <config:host>localhost</config:host>
        <config:port>5432</config:port>
      </config:database>
    </app:settings>
  </app:application>
  <data:records>
    ${Array.from({ length: 50 }, (_, i) => `
    <data:record id="${i}">
      <data:field name="id">${i}</data:field>
      <data:field name="value">${XmlGenerator.randomText(10, 50)}</data:field>
      <meta:timestamp>${new Date().toISOString()}</meta:timestamp>
      <meta:author>system</meta:author>
    </data:record>`).join('')}
  </data:records>
</root>`;
    }
    static generateMixedContent(elements = 200) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<document xmlns:doc="http://example.com/doc">\n';
        for (let i = 0; i < elements; i++) {
            const type = i % 4;
            switch (type) {
                case 0: // Text with inline elements
                    xml += `  <paragraph>
    This is ${XmlGenerator.randomText(5, 10)} with <em>emphasis</em> and
    <strong>strong text</strong> mixed with regular content.
    <link href="http://example.com/${i}">Link ${i}</link>
  </paragraph>\n`;
                    break;
                case 1: // Attributes heavy
                    xml += `  <item id="${i}" type="complex" status="active"
         created="${new Date().toISOString()}"
         modified="${new Date().toISOString()}"
         category="${XmlGenerator.randomString(10)}"
         tags="${XmlGenerator.randomString(30)}">
    ${XmlGenerator.randomText(20, 50)}
  </item>\n`;
                    break;
                case 2: // CDATA section
                    xml += `  <script><![CDATA[
    function process${i}() {
      const data = ${JSON.stringify({ id: i, value: XmlGenerator.randomString(20) })};
      return data;
    }
  ]]></script>\n`;
                    break;
                case 3: // Nested structure
                    xml += `  <doc:section id="${i}">
    <doc:title>${XmlGenerator.randomText(5, 15)}</doc:title>
    <doc:content>
      <doc:paragraph>${XmlGenerator.randomText(30, 100)}</doc:paragraph>
      <doc:list>
        ${Array.from({ length: 5 }, (_, j) => `<doc:item>${XmlGenerator.randomText(5, 20)}</doc:item>`).join('\n        ')}
      </doc:list>
    </doc:content>
  </doc:section>\n`;
                    break;
            }
        }
        xml += '</document>';
        return xml;
    }
    static generateLargeRealistic() {
        // Generate a realistic large XML document (like a data export)
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<catalog xmlns:product="http://example.com/product" xmlns:vendor="http://example.com/vendor">\n';
        // Generate 10000 products
        for (let i = 0; i < 10000; i++) {
            xml += `  <product:item id="PROD${String(i).padStart(6, '0')}">
    <product:name>${XmlGenerator.randomText(3, 8)}</product:name>
    <product:description><![CDATA[${XmlGenerator.randomText(20, 100)}]]></product:description>
    <product:price currency="USD">${(Math.random() * 1000).toFixed(2)}</product:price>
    <product:inventory>
      <product:quantity>${Math.floor(Math.random() * 1000)}</product:quantity>
      <product:warehouse>WH${Math.floor(Math.random() * 10)}</product:warehouse>
    </product:inventory>
    <vendor:info>
      <vendor:id>VEND${String(Math.floor(Math.random() * 100)).padStart(4, '0')}</vendor:id>
      <vendor:name>${XmlGenerator.randomString(20)}</vendor:name>
      <vendor:contact email="${XmlGenerator.randomString(10)}@example.com"/>
    </vendor:info>
    <product:categories>
      ${Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => `<product:category>${XmlGenerator.randomString(10)}</product:category>`).join('\n      ')}
    </product:categories>
    <product:attributes>
      ${Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, j) => `<product:attribute name="attr${j}">${XmlGenerator.randomString(20)}</product:attribute>`).join('\n      ')}
    </product:attributes>
  </product:item>\n`;
        }
        xml += '</catalog>';
        return xml;
    }
}
// Define test patterns
const patterns = [
    {
        name: 'small-simple',
        description: 'Small XML with simple structure (< 1KB)',
        targetSize: 500,
        generate: XmlGenerator.generateSmallSimple
    },
    {
        name: 'medium-nested',
        description: 'Medium XML with nested structure (10-100KB)',
        targetSize: 50_000,
        generate: () => XmlGenerator.generateMediumNested(8, 4)
    },
    {
        name: 'large-complex',
        description: 'Large XML with complex structure (1-10MB)',
        targetSize: 5_000_000,
        generate: XmlGenerator.generateLargeRealistic
    },
    {
        name: 'huge-document',
        description: 'Huge XML document (10-100MB)',
        targetSize: 50_000_000,
        generate: () => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
            const chunkSize = 100_000;
            const chunks = Math.ceil(50_000_000 / chunkSize);
            for (let i = 0; i < chunks; i++) {
                xml += XmlGenerator.generateMixedContent(100);
            }
            xml += '\n</root>';
            return xml;
        }
    },
    {
        name: 'attribute-heavy',
        description: 'XML with many attributes per element',
        targetSize: 1_000_000,
        generate: () => XmlGenerator.generateAttributeHeavy(1000)
    },
    {
        name: 'text-heavy',
        description: 'XML with large text content',
        targetSize: 2_000_000,
        generate: () => XmlGenerator.generateTextHeavy(1000)
    },
    {
        name: 'cdata-heavy',
        description: 'XML with many CDATA sections',
        targetSize: 500_000,
        generate: () => XmlGenerator.generateCDATAHeavy(500)
    },
    {
        name: 'namespace-heavy',
        description: 'XML with multiple namespaces',
        targetSize: 100_000,
        generate: XmlGenerator.generateNamespaceHeavy
    },
    {
        name: 'mixed-content',
        description: 'XML with mixed content types',
        targetSize: 1_000_000,
        generate: () => XmlGenerator.generateMixedContent(2000)
    }
];
// Generate test files
async function generateTestFiles() {
    const testDataDir = path.join(__dirname, 'test-data');
    // Create test-data directory if it doesn't exist
    if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
    }
    console.log('Generating test XML files...\n');
    for (const pattern of patterns) {
        console.log(`Generating ${pattern.name}: ${pattern.description}`);
        const startTime = Date.now();
        let xml = pattern.generate();
        // Adjust size if needed
        while (xml.length < pattern.targetSize * 0.9) {
            xml += '\n' + pattern.generate().split('\n').slice(1, -1).join('\n');
        }
        // Ensure well-formed XML
        if (!xml.includes('</root>') && !xml.includes('</document>') && !xml.includes('</catalog>')) {
            const rootTag = xml.match(/<(\w+)/)?.[1] || 'root';
            xml += `\n</${rootTag}>`;
        }
        const filePath = path.join(testDataDir, `${pattern.name}.xml`);
        fs.writeFileSync(filePath, xml, 'utf8');
        const actualSize = fs.statSync(filePath).size;
        const duration = Date.now() - startTime;
        console.log(`  Generated: ${(actualSize / 1024 / 1024).toFixed(2)} MB in ${duration}ms`);
        console.log(`  Saved to: ${filePath}\n`);
    }
    // Create a manifest file
    const manifest = {
        generated: new Date().toISOString(),
        patterns: patterns.map(p => ({
            name: p.name,
            description: p.description,
            targetSize: p.targetSize,
            actualSize: fs.statSync(path.join(testDataDir, `${p.name}.xml`)).size
        }))
    };
    fs.writeFileSync(path.join(testDataDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    console.log('Test file generation complete!');
    console.log(`Manifest saved to: ${path.join(testDataDir, 'manifest.json')}`);
}
// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    generateTestFiles().catch(console.error);
}
export { generateTestFiles, XmlGenerator, patterns };

import { x } from './packages/stax-xml/dist/converter/index.js';

// Simple test case
const xml = `
<items>
  <item id="1">
    <name>Test Item</name>
    <price>10.50</price>
  </item>
  <item id="2">
    <name>Another Item</name>
    <price>25.99</price>
  </item>
</items>
`;

const itemSchema = x.object({
  id: x.string().xpath('./@id'),
  name: x.string().xpath('./name'),
  price: x.number().xpath('./price')
});

console.log('Testing just attribute extraction...');
const attrSchema = x.array(x.string().xpath('./@id'), '//item');
const attrResult = attrSchema.parse(xml, { maxDepth: 100 });
console.log('Attribute result:', attrResult);

console.log('\nTesting element content extraction...');
const contentSchema = x.array(x.string().xpath('./name'), '//item');
const contentResult = contentSchema.parse(xml, { maxDepth: 100 });
console.log('Content result:', contentResult);

console.log('\nTesting direct element content...');
const directSchema = x.array(x.string(), '//name');
const directResult = directSchema.parse(xml, { maxDepth: 100 });
console.log('Direct result:', directResult);

const schema = x.array(itemSchema, '//item');

try {
  const result = schema.parse(xml, { maxDepth: 100 });
  console.log('\nTesting the ACTUAL failing pattern - object in array...');
  console.log('Result length:', result.length);
  console.log('First item:', JSON.stringify(result[0], null, 2));
  console.log('Second item:', JSON.stringify(result[1], null, 2));
} catch (error) {
  console.error('Error:', error);
}
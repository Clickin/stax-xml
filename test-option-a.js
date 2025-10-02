const { x } = require('./packages/stax-xml/dist/converter.cjs');

const xml = `
<inventory>
  <item sku="ABC123" category="electronics">
    <name lang="en">Smartphone</name>
    <price currency="USD">599.99</price>
  </item>
</inventory>
`;

const itemSchema = x.object({
  sku: x.string().xpath('./@sku'),
  category: x.string().xpath('./@category'),
  name: x.string().xpath('./name'),
  nameLanguage: x.string().xpath('./name/@lang'),
  price: x.number().xpath('./price'),
  priceCurrency: x.string().xpath('./price/@currency'),
}).transform(item => ({
  ...item,
  priceInfo: `${item.price} ${item.priceCurrency}`,
  localizedName: `${item.name} (${item.nameLanguage})`
}));

const schema = x.object({
  items: x.array(itemSchema, '//item'),
});

const result = schema.parseSync(xml);

console.log('Expected: sku="ABC123", priceInfo="599.99 USD"');
console.log('Actual:', JSON.stringify(result.items[0], null, 2));

// Expected output:
// {
//   sku: 'ABC123',
//   category: 'electronics',
//   name: 'Smartphone',
//   nameLanguage: 'en',
//   price: 599.99,
//   priceCurrency: 'USD',
//   priceInfo: '599.99 USD',
//   localizedName: 'Smartphone (en)'
// }

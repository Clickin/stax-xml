import { XPathCompiler } from './packages/stax-xml/dist/converter/XPathEngine.js';

// Test XPath compilation
const xpaths = ['./@id', '//item', './name'];

xpaths.forEach(xpath => {
  try {
    const compiled = XPathCompiler.compile(xpath);
    console.log(`\nXPath: ${xpath}`);
    console.log('Compiled:', JSON.stringify(compiled, null, 2));
  } catch (error) {
    console.error(`Error with ${xpath}:`, error);
  }
});
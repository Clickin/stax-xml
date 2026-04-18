import assert from 'node:assert/strict';

import { resetFileInputValue } from '../public/converter-demo-ui.js';

const fileInput = { value: 'C:\\fakepath\\midsize.xml' };
resetFileInputValue(fileInput);
assert.equal(fileInput.value, '');

assert.doesNotThrow(() => resetFileInputValue(null));
assert.doesNotThrow(() => resetFileInputValue(undefined));

console.log('converter-demo-ui assertions passed');

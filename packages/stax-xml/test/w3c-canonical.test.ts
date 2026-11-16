import { describe, expect, it } from 'vitest';
import { canonicalXml } from '../scripts/w3c-canonical.js';
import { EventReaderSync } from '../src/sync/index.js';

describe('W3C canonical output', () => {
  it('serializes normalized values, sorted attributes, CDATA, and processing instructions', () => {
    expect(canonicalXml(new EventReaderSync('<?before data?><r z="&#13;" a="x\r\ny">a\r\nb<![CDATA[<c>]]><!--ignored--></r>')))
      .toBe('<?before data?><r a="x y" z="&#13;">a&#10;b&lt;c&gt;</r>');
    expect(canonicalXml(new EventReaderSync('<r>x\r\ny</r>'))).not.toBe('<r>x&#13;&#10;y</r>');
  });
});

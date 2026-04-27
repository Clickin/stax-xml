import { describe, expect, it } from 'vitest';
import { StaxXmlParser } from '../src/StaxXmlParser';
import { StaxXmlParserSync } from '../src/StaxXmlParserSync';
import { XmlEventType } from '../src/types';
import { x } from '../src/converter';

function streamFrom(input: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(input);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

async function collectAsync(input: string, documentMode: 'fragment' | 'document' = 'fragment') {
  const events = [];
  for await (const event of new StaxXmlParser(streamFrom(input), { documentMode })) {
    events.push(event);
  }
  return events;
}

describe('documentMode', () => {
  it('keeps fragment mode as the default and allows sibling root elements', () => {
    const events = Array.from(new StaxXmlParserSync('<item/><item/>'));

    expect(events.filter(event => event.type === XmlEventType.START_ELEMENT).map(event => event.name))
      .toEqual(['item', 'item']);
  });

  it('rejects sibling root elements in document mode', () => {
    expect(() => Array.from(new StaxXmlParserSync('<item/><item/>', { documentMode: 'document' })))
      .toThrow(/exactly one root element/);
  });

  it('rejects an empty document in document mode', () => {
    expect(() => Array.from(new StaxXmlParserSync('   ', { documentMode: 'document' })))
      .toThrow(/exactly one root element/);
  });

  it('rejects non-whitespace text after the document element', () => {
    expect(() => Array.from(new StaxXmlParserSync('<item/>tail', { documentMode: 'document' })))
      .toThrow(/outside the document element/);
  });

  it('passes document mode through the async parser', async () => {
    await expect(collectAsync('<item/><item/>', 'document'))
      .rejects.toThrow(/exactly one root element/);
  });

  it('passes document mode through converter parsing', () => {
    const schema = x.object({
      value: x.string('/root/value')
    });

    expect(() => schema.parseSync('<root><value>ok</value></root><extra/>', { documentMode: 'document' }))
      .toThrow(/exactly one root element/);
  });

  it('does not resolve external entities from a DOCTYPE declaration', () => {
    const xmlWithExternalEntity = '<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>';
    const events = Array.from(new StaxXmlParserSync(xmlWithExternalEntity, { documentMode: 'document' }));

    expect(events.find(event => event.type === XmlEventType.CHARACTERS)?.value).toBe('&xxe;');
  });

  it.each([
    ['invalid element name', '<1root/>', /start tag name/],
    ['invalid end tag name', '<root></1root>', /end tag name/],
    ['invalid attribute name', '<root 1attr="value"/>', /attribute name/],
    ['missing attribute assignment', '<root disabled/>', /Attribute value/],
    ['unquoted attribute value', '<root attr=value/>', /quoted/],
    ['duplicate attribute', '<root attr="one" attr="two"/>', /Duplicate attribute/],
    ['attribute less-than', '<root attr="<"/>', /must not contain/],
    ['bare ampersand text', '<root>one & two</root>', /Entity references/],
    ['invalid character reference', '<root>&#x0;</root>', /character reference/],
    ['comment double hyphen', '<root><!-- bad -- comment --></root>', /comments/],
    ['missing PI target', '<root><? ?></root>', /target/]
  ])('rejects %s in document mode', (_name, input, message) => {
    expect(() => Array.from(new StaxXmlParserSync(input, { documentMode: 'document' })))
      .toThrow(message);
  });

  it('keeps default fragment mode tolerant for legacy implicit attributes', () => {
    const events = Array.from(new StaxXmlParserSync('<root disabled/>'));

    expect(events.find(event => event.type === XmlEventType.START_ELEMENT)?.attributes.disabled).toBe('true');
  });
});

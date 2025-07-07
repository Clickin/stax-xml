import { describe, it, expect } from 'bun:test';
import { StaxXmlParserSync } from '../src/StaxXmlParserSync';
import { XmlEventType } from '../src/types';

describe('StaxXmlParserSync', () => {
  it('should parse a simple XML document', () => {
    const xml = '<root><item>text</item></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.START_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'text' },
      { type: XmlEventType.END_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should parse XML with attributes', () => {
    const xml = '<root attr1="value1" attr2="value2"><child/></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { attr1: 'value1', attr2: 'value2' }, attributesWithPrefix: { attr1: { value: 'value1', localName: 'attr1', prefix: undefined, uri: undefined }, attr2: { value: 'value2', localName: 'attr2', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.START_ELEMENT, name: 'child', localName: 'child', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'child', localName: 'child', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should parse XML with self-closing tags', () => {
    const xml = '<root><empty/><item/></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.START_ELEMENT, name: 'empty', localName: 'empty', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'empty', localName: 'empty', prefix: undefined, uri: undefined },
      { type: XmlEventType.START_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle CDATA sections', () => {
    const xml = '<root><![CDATA[<data>text</data>]]></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CDATA, value: '<data>text</data>' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should ignore comments and processing instructions', () => {
    const xml = '<root><!-- comment --><?pi target data?><item/></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.START_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle mixed content (text and elements)', () => {
    const xml = '<root>Hello <bold>World</bold>!</root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'Hello' },
      { type: XmlEventType.START_ELEMENT, name: 'bold', localName: 'bold', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'World' },
      { type: XmlEventType.END_ELEMENT, name: 'bold', localName: 'bold', prefix: undefined, uri: undefined },
      { type: XmlEventType.CHARACTERS, value: '!' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle XML with leading/trailing whitespace', () => {
    const xml = '  <root>  <item/>  </root>  ';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.START_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle empty XML', () => {
    const xml = '';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle XML declaration', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><root/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle nested elements', () => {
    const xml = '<A><B><C>text</C></B></A>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'A', localName: 'A', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.START_ELEMENT, name: 'B', localName: 'B', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.START_ELEMENT, name: 'C', localName: 'C', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'text' },
      { type: XmlEventType.END_ELEMENT, name: 'C', localName: 'C', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_ELEMENT, name: 'B', localName: 'B', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_ELEMENT, name: 'A', localName: 'A', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with single quotes', () => {
    const xml = '<root attr="value"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { attr: 'value' }, attributesWithPrefix: { attr: { value: 'value', localName: 'attr', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with double quotes', () => {
    const xml = '<root attr="value"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { attr: 'value' }, attributesWithPrefix: { attr: { value: 'value', localName: 'attr', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with mixed quotes', () => {
    const xml = '<root attr1="value1" attr2="value2"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { attr1: 'value1', attr2: 'value2' }, attributesWithPrefix: { attr1: { value: 'value1', localName: 'attr1', prefix: undefined, uri: undefined }, attr2: { value: 'value2', localName: 'attr2', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with no value (boolean attributes)', () => {
    const xml = '<root checked disabled/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { checked: 'true', disabled: 'true' }, attributesWithPrefix: { checked: { value: 'true', localName: 'checked', prefix: undefined, uri: undefined }, disabled: { value: 'true', localName: 'disabled', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with whitespace around equals sign', () => {
    const xml = '<root attr = "value"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { attr: 'value' }, attributesWithPrefix: { attr: { value: 'value', localName: 'attr', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with special characters in value (XML entities)', () => {
    const xml = '<root attr="value &amp; &lt; &gt; &apos; &quot;"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { attr: 'value & < > \' "' }, attributesWithPrefix: { attr: { value: 'value & < > \' "', localName: 'attr', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle multiple root elements (invalid XML, but parser should process sequentially)', () => {
    const xml = '<root1/><root2/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root1', localName: 'root1', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'root1', localName: 'root1', prefix: undefined, uri: undefined },
      { type: XmlEventType.START_ELEMENT, name: 'root2', localName: 'root2', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'root2', localName: 'root2', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle text nodes with leading/trailing whitespace within elements', () => {
    const xml = '<root>  Hello   World  </root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'Hello   World' }, // trim() is applied to characters
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle complex nested structure with mixed content and attributes', () => {
    const xml = '<library name="My Library"><book id="123">Title <author>Author Name</author> More Text</book><book id="456"/></library>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'library', localName: 'library', prefix: undefined, uri: undefined, attributes: { name: 'My Library' }, attributesWithPrefix: { name: { value: 'My Library', localName: 'name', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.START_ELEMENT, name: 'book', localName: 'book', prefix: undefined, uri: undefined, attributes: { id: '123' }, attributesWithPrefix: { id: { value: '123', localName: 'id', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.CHARACTERS, value: 'Title' },
      { type: XmlEventType.START_ELEMENT, name: 'author', localName: 'author', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'Author Name' },
      { type: XmlEventType.END_ELEMENT, name: 'author', localName: 'author', prefix: undefined, uri: undefined },
      { type: XmlEventType.CHARACTERS, value: 'More Text' },
      { type: XmlEventType.END_ELEMENT, name: 'book', localName: 'book', prefix: undefined, uri: undefined },
      { type: XmlEventType.START_ELEMENT, name: 'book', localName: 'book', prefix: undefined, uri: undefined, attributes: { id: '456' }, attributesWithPrefix: { id: { value: '456', localName: 'id', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'book', localName: 'book', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_ELEMENT, name: 'library', localName: 'library', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  // New tests for entity decoding
  it('should decode standard XML entities in text content', () => {
    const xml = '<root>This is &lt; and &gt; and &amp; and &apos; and &quot;.</root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'This is < and > and & and \' and ".' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should decode standard XML entities in attribute values', () => {
    const xml = '<root attr="&lt;&gt;&amp;&apos;&quot;"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { attr: '<>&\'"' }, attributesWithPrefix: { attr: { value: '<>&\'"' , localName: 'attr', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should decode custom entities in text content', () => {
    const xml = '<root>Hello &world;!</root>';
    const parser = new StaxXmlParserSync(xml, { addEntities: [{ entity: '&world;', value: 'World' }] });
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'Hello World!' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should decode custom entities in attribute values', () => {
    const xml = '<root custom="Value &customEnt;"/>';
    const parser = new StaxXmlParserSync(xml, { addEntities: [{ entity: '&customEnt;', value: 'Custom' }] });
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { custom: 'Value Custom' }, attributesWithPrefix: { custom: { value: 'Value Custom', localName: 'custom', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should not decode entities when autoDecodeEntities is false', () => {
    const xml = '<root>This is &lt; and &customEnt;.</root>';
    const parser = new StaxXmlParserSync(xml, { autoDecodeEntities: false, addEntities: [{ entity: '&customEnt;', value: 'Custom' }] });
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.CHARACTERS, value: 'This is &lt; and &customEnt;.' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  // New tests for namespace support
  it('should handle default namespace declaration', () => {
    const xml = '<root xmlns="http://example.com/ns1"><item/></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: 'http://example.com/ns1', attributes: { xmlns: 'http://example.com/ns1' }, attributesWithPrefix: { xmlns: { value: 'http://example.com/ns1', localName: 'xmlns', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.START_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: 'http://example.com/ns1', attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: 'http://example.com/ns1' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: 'http://example.com/ns1' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle prefixed namespace declaration', () => {
    const xml = '<root xmlns:prefix="http://example.com/ns2"><prefix:item/></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { 'xmlns:prefix': 'http://example.com/ns2' }, attributesWithPrefix: { 'xmlns:prefix': { value: 'http://example.com/ns2', localName: 'prefix', prefix: 'xmlns', uri: undefined } } },
      { type: XmlEventType.START_ELEMENT, name: 'prefix:item', localName: 'item', prefix: 'prefix', uri: 'http://example.com/ns2', attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'prefix:item', localName: 'item', prefix: 'prefix', uri: 'http://example.com/ns2' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle namespace inheritance', () => {
    const xml = '<root xmlns="http://example.com/ns1"><child xmlns:sub="http://example.com/ns2"><sub:item/></child></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: 'http://example.com/ns1', attributes: { xmlns: 'http://example.com/ns1' }, attributesWithPrefix: { xmlns: { value: 'http://example.com/ns1', localName: 'xmlns', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.START_ELEMENT, name: 'child', localName: 'child', prefix: undefined, uri: 'http://example.com/ns1', attributes: { 'xmlns:sub': 'http://example.com/ns2' }, attributesWithPrefix: { 'xmlns:sub': { value: 'http://example.com/ns2', localName: 'sub', prefix: 'xmlns', uri: undefined } } },
      { type: XmlEventType.START_ELEMENT, name: 'sub:item', localName: 'item', prefix: 'sub', uri: 'http://example.com/ns2', attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'sub:item', localName: 'item', prefix: 'sub', uri: 'http://example.com/ns2' },
      { type: XmlEventType.END_ELEMENT, name: 'child', localName: 'child', prefix: undefined, uri: 'http://example.com/ns1' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: 'http://example.com/ns1' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle namespace override', () => {
    const xml = '<root xmlns="http://example.com/ns1"><child xmlns="http://example.com/ns2"><item/></child></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: 'http://example.com/ns1', attributes: { xmlns: 'http://example.com/ns1' }, attributesWithPrefix: { xmlns: { value: 'http://example.com/ns1', localName: 'xmlns', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.START_ELEMENT, name: 'child', localName: 'child', prefix: undefined, uri: 'http://example.com/ns2', attributes: { xmlns: 'http://example.com/ns2' }, attributesWithPrefix: { xmlns: { value: 'http://example.com/ns2', localName: 'xmlns', prefix: undefined, uri: undefined } } },
      { type: XmlEventType.START_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: 'http://example.com/ns2', attributes: {}, attributesWithPrefix: {} },
      { type: XmlEventType.END_ELEMENT, name: 'item', localName: 'item', prefix: undefined, uri: 'http://example.com/ns2' },
      { type: XmlEventType.END_ELEMENT, name: 'child', localName: 'child', prefix: undefined, uri: 'http://example.com/ns2' },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: 'http://example.com/ns1' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with namespaces', () => {
    const xml = '<root xmlns:a="http://example.com/a" a:attr="value"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined, attributes: { 'xmlns:a': 'http://example.com/a', 'a:attr': 'value' }, attributesWithPrefix: { 'xmlns:a': { value: 'http://example.com/a', localName: 'a', prefix: 'xmlns', uri: undefined }, 'a:attr': { value: 'value', localName: 'attr', prefix: 'a', uri: 'http://example.com/a' } } },
      { type: XmlEventType.END_ELEMENT, name: 'root', localName: 'root', prefix: undefined, uri: undefined },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });
});

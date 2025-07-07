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
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: {} },
      { type: XmlEventType.START_ELEMENT, name: 'item', attributes: {} },
      { type: XmlEventType.CHARACTERS, value: 'text' },
      { type: XmlEventType.END_ELEMENT, name: 'item' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should parse XML with attributes', () => {
    const xml = '<root attr1="value1" attr2="value2"><child/></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: { attr1: 'value1', attr2: 'value2' } },
      { type: XmlEventType.START_ELEMENT, name: 'child', attributes: {} },
      { type: XmlEventType.END_ELEMENT, name: 'child' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should parse XML with self-closing tags', () => {
    const xml = '<root><empty/><item/></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: {} },
      { type: XmlEventType.START_ELEMENT, name: 'empty', attributes: {} },
      { type: XmlEventType.END_ELEMENT, name: 'empty' },
      { type: XmlEventType.START_ELEMENT, name: 'item', attributes: {} },
      { type: XmlEventType.END_ELEMENT, name: 'item' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle CDATA sections', () => {
    const xml = '<root><![CDATA[<data>text</data>]]></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: {} },
      { type: XmlEventType.CDATA, value: '<data>text</data>' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should ignore comments and processing instructions', () => {
    const xml = '<root><!-- comment --><?pi target data?><item/></root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: {} },
      { type: XmlEventType.START_ELEMENT, name: 'item', attributes: {} },
      { type: XmlEventType.END_ELEMENT, name: 'item' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle mixed content (text and elements)', () => {
    const xml = '<root>Hello <bold>World</bold>!</root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: {} },
      { type: XmlEventType.CHARACTERS, value: 'Hello' },
      { type: XmlEventType.START_ELEMENT, name: 'bold', attributes: {} },
      { type: XmlEventType.CHARACTERS, value: 'World' },
      { type: XmlEventType.END_ELEMENT, name: 'bold' },
      { type: XmlEventType.CHARACTERS, value: '!' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle XML with leading/trailing whitespace', () => {
    const xml = '  <root>  <item/>  </root>  ';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: {} },
      { type: XmlEventType.START_ELEMENT, name: 'item', attributes: {} },
      { type: XmlEventType.END_ELEMENT, name: 'item' },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
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
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: {} },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle nested elements', () => {
    const xml = '<A><B><C>text</C></B></A>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'A', attributes: {} },
      { type: XmlEventType.START_ELEMENT, name: 'B', attributes: {} },
      { type: XmlEventType.START_ELEMENT, name: 'C', attributes: {} },
      { type: XmlEventType.CHARACTERS, value: 'text' },
      { type: XmlEventType.END_ELEMENT, name: 'C' },
      { type: XmlEventType.END_ELEMENT, name: 'B' },
      { type: XmlEventType.END_ELEMENT, name: 'A' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with single quotes', () => {
    const xml = '<root attr="value"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: { attr: 'value' } },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with double quotes', () => {
    const xml = '<root attr="value"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: { attr: 'value' } },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with mixed quotes', () => {
    const xml = '<root attr1="value1" attr2="value2"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: { attr1: 'value1', attr2: 'value2' } },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with no value (boolean attributes)', () => {
    const xml = '<root checked disabled/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: { checked: 'true', disabled: 'true' } },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with whitespace around equals sign', () => {
    const xml = '<root attr = "value"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: { attr: 'value' } },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle attributes with special characters in value (XML entities)', () => {
    const xml = '<root attr="value &amp; &lt; &gt; &apos; &quot;"/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: { attr: 'value &amp; &lt; &gt; &apos; &quot;' } },
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle multiple root elements (invalid XML, but parser should process sequentially)', () => {
    const xml = '<root1/><root2/>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root1', attributes: {} },
      { type: XmlEventType.END_ELEMENT, name: 'root1' },
      { type: XmlEventType.START_ELEMENT, name: 'root2', attributes: {} },
      { type: XmlEventType.END_ELEMENT, name: 'root2' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle text nodes with leading/trailing whitespace within elements', () => {
    const xml = '<root>  Hello   World  </root>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'root', attributes: {} },
      { type: XmlEventType.CHARACTERS, value: 'Hello   World' }, // trim() is applied to characters
      { type: XmlEventType.END_ELEMENT, name: 'root' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });

  it('should handle complex nested structure with mixed content and attributes', () => {
    const xml = '<library name="My Library"><book id="123">Title <author>Author Name</author> More Text</book><book id="456"/></library>';
    const parser = new StaxXmlParserSync(xml);
    const events = Array.from(parser);

    expect(events).toEqual([
      { type: XmlEventType.START_DOCUMENT },
      { type: XmlEventType.START_ELEMENT, name: 'library', attributes: { name: 'My Library' } },
      { type: XmlEventType.START_ELEMENT, name: 'book', attributes: { id: '123' } },
      { type: XmlEventType.CHARACTERS, value: 'Title' },
      { type: XmlEventType.START_ELEMENT, name: 'author', attributes: {} },
      { type: XmlEventType.CHARACTERS, value: 'Author Name' },
      { type: XmlEventType.END_ELEMENT, name: 'author' },
      { type: XmlEventType.CHARACTERS, value: 'More Text' },
      { type: XmlEventType.END_ELEMENT, name: 'book' },
      { type: XmlEventType.START_ELEMENT, name: 'book', attributes: { id: '456' } },
      { type: XmlEventType.END_ELEMENT, name: 'book' },
      { type: XmlEventType.END_ELEMENT, name: 'library' },
      { type: XmlEventType.END_DOCUMENT },
    ]);
  });
});

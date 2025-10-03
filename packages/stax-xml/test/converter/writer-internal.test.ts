import { describe, expect, it } from 'vitest';
import { XmlWriterInternal, buildElementTag } from '../../src/converter/XmlWriterInternal.js';

describe('XmlWriterInternal Edge Cases', () => {
  describe('Start Document Variations', () => {
    it('should write start document without version parameter', () => {
      const writer = new XmlWriterInternal();
      writer.writeStartDocument();
      const xml = writer.toString();

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('encoding="UTF-8"');
    });

    it('should write start document without encoding parameter', () => {
      const writer = new XmlWriterInternal();
      writer.writeStartDocument('1.1');
      const xml = writer.toString();

      expect(xml).toContain('<?xml version="1.1"');
      expect(xml).toContain('encoding="UTF-8"');
    });
  });

  describe('Element Writing with Config', () => {
    it('should write element with comment config', () => {
      const writer = new XmlWriterInternal({ prettyPrint: false });
      writer.writeStartElement('root', undefined, { comment: 'Root element' });
      writer.writeEndElement();
      const xml = writer.toString();

      expect(xml).toContain('<!-- Root element -->');
      expect(xml).toContain('<root>');
    });

    it('should write element with comment config and pretty print', () => {
      const writer = new XmlWriterInternal({ prettyPrint: true });
      writer.writeStartElement('root', undefined, { comment: 'Root element' });
      writer.writeEndElement();
      const xml = writer.toString();

      expect(xml).toContain('<!-- Root element -->');
      expect(xml).toContain('<root>');
    });

    it('should write element with namespace prefix', () => {
      const writer = new XmlWriterInternal();
      writer.writeStartElement('root', undefined, {
        namespace: { prefix: 'ns', uri: 'http://example.com' }
      });
      writer.writeEndElement();
      const xml = writer.toString();

      // Note: Current implementation only adds namespace prefix to start tag
      expect(xml).toContain('<ns:root>');
      expect(xml).toContain('</root>');
    });
  });

  describe('End Element Edge Cases', () => {
    it('should throw error when ending element with empty stack', () => {
      const writer = new XmlWriterInternal();

      expect(() => writer.writeEndElement()).toThrow('No element to close');
    });

    it('should update indent level when ending element', () => {
      const writer = new XmlWriterInternal({ prettyPrint: true });
      writer.writeStartElement('root');
      writer.writeStartElement('child');
      writer.writeCharacters('text');
      writer.writeEndElement(); // Close child
      writer.writeEndElement(); // Close root
      const xml = writer.toString();

      expect(xml).toContain('<root>');
      expect(xml).toContain('<child>');
      expect(xml).toContain('</child>');
      expect(xml).toContain('</root>');
    });
  });

  describe('Comment Writing', () => {
    it('should write comment with pretty print enabled', () => {
      const writer = new XmlWriterInternal({ prettyPrint: true });
      writer.writeComment('This is a comment');
      const xml = writer.toString();

      expect(xml).toContain('<!-- This is a comment -->');
    });

    it('should write comment without pretty print', () => {
      const writer = new XmlWriterInternal({ prettyPrint: false });
      writer.writeComment('This is a comment');
      const xml = writer.toString();

      expect(xml).toBe('<!-- This is a comment -->');
    });
  });

  describe('buildElementTag Helper Function', () => {
    it('should build element tag with namespace prefix', () => {
      const tag = buildElementTag(
        'element',
        {},
        { namespace: { prefix: 'ns', uri: 'http://example.com' } },
        false
      );

      expect(tag).toBe('<ns:element>');
    });

    it('should build element tag with attributes', () => {
      const tag = buildElementTag(
        'element',
        { id: '123', name: 'test' },
        undefined,
        false
      );

      expect(tag).toContain('<element');
      expect(tag).toContain('id="123"');
      expect(tag).toContain('name="test"');
      expect(tag).toContain('>');
      expect(tag).not.toContain('/>');
    });

    it('should build self-closing element tag', () => {
      const tag = buildElementTag(
        'element',
        { id: '123' },
        undefined,
        true
      );

      expect(tag).toContain('<element');
      expect(tag).toContain('id="123"');
      expect(tag).toContain('/>');
    });
  });
});

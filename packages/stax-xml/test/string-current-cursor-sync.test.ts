import { describe, expect, it } from 'vitest';
import { EventReaderSync } from '../src/EventReaderSync';
import {
  StringCurrentCursorSync,
  type StringCurrentCursorMaterializationPolicy,
} from '../src/StringCurrentCursorSync';
import { XmlEventType } from '../src/types';

function consumeCursor(xml: string, materialization: StringCurrentCursorMaterializationPolicy) {
  const cursor = new StringCurrentCursorSync(xml, { materialization });
  const events: Array<Record<string, unknown>> = [];

  while (cursor.next()) {
    const type = cursor.eventType();
    if (type === 2) {
      const attrCount = cursor.getAttributeCount();
      const attributes: Record<string, string> = {};
      for (let index = 0; index < attrCount; index++) {
        const name = cursor.getAttributeName(index)!;
        attributes[name] = cursor.getAttributeValue(index)!;
        expect(cursor.getAttributeValue(name)).toBe(attributes[name]);
      }
      events.push({
        type,
        depth: cursor.depth(),
        name: cursor.name(),
        attributes,
      });
      continue;
    }

    if (type === 3) {
      events.push({
        type,
        depth: cursor.depth(),
        name: cursor.name(),
      });
      continue;
    }

    if (type === 4 || type === 5) {
      events.push({
        type,
        depth: cursor.depth(),
        text: cursor.text(),
      });
      continue;
    }

    events.push({ type, depth: cursor.depth() });
  }

  return events;
}

function consumeEventReader(xml: string) {
  return Array.from(new EventReaderSync(xml, {
    namespaceAware: false,
    autoDecodeEntities: false,
  })).map((event) => {
    if (event.type === XmlEventType.START_ELEMENT) {
      return {
        type: 2,
        name: event.name,
        attributes: event.attributes,
      };
    }
    if (event.type === XmlEventType.END_ELEMENT) {
      return {
        type: 3,
        name: event.name,
      };
    }
    if (event.type === XmlEventType.CHARACTERS) {
      return {
        type: 4,
        text: event.value,
      };
    }
    if (event.type === XmlEventType.CDATA) {
      return {
        type: 5,
        text: event.value,
      };
    }
    if (event.type === XmlEventType.START_DOCUMENT) {
      return { type: 0 };
    }
    return { type: 1 };
  });
}

describe('StringCurrentCursorSync', () => {
  it('keeps the materialization policies event-equivalent on a mixed fixture', () => {
    const xml = '<root a="1" checked><!--c--><item id="x"> hi </item><![CDATA[cdata]]><leaf disabled/></root>';

    const none = consumeCursor(xml, 'none');
    const currentEvent = consumeCursor(xml, 'current-event');
    const eagerTouch = consumeCursor(xml, 'eager-touch');

    expect(currentEvent).toEqual(none);
    expect(eagerTouch).toEqual(none);
  });

  it('matches the lean EventReaderSync event stream for fragment-mode string input', () => {
    const xml = '<root a="1" checked><item id="x"> hi </item><![CDATA[cdata]]><leaf disabled/></root>';

    const cursorEvents = consumeCursor(xml, 'current-event').map((event) => {
      if (event.type === 2) {
        return {
          type: event.type,
          name: event.name,
          attributes: event.attributes,
        };
      }
      if (event.type === 3) {
        return {
          type: event.type,
          name: event.name,
        };
      }
      if (event.type === 4 || event.type === 5) {
        return {
          type: event.type,
          text: event.text,
        };
      }
      return { type: event.type };
    });

    expect(cursorEvents).toEqual(consumeEventReader(xml));
  });
});

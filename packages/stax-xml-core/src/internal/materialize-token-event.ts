import { TokenCursor } from '../TokenCursor.js';
import { XmlEventType, type AnyXmlEvent, type EventAttribute, type XmlEventType as XmlEventTypeValue } from '../types.js';

/** @internal Materialize one stable event from the cursor's current token. */
export function materializeTokenEvent(cursor: TokenCursor, type: XmlEventTypeValue = cursor.eventType()): AnyXmlEvent {
  if (type === XmlEventType.START_ELEMENT) {
    const count = cursor.attributeCount();
    const attributes = new Array<EventAttribute>(count);
    for (let index = 0; index < count; index++) attributes[index] = cursor.attribute(index)!;
    return {
      type,
      name: cursor.name()!,
      localName: cursor.localName()!,
      prefix: cursor.prefix(),
      namespaceURI: cursor.namespaceURI(),
      attributes,
    };
  }
  if (type === XmlEventType.END_ELEMENT) {
    return { type, name: cursor.name()!, localName: cursor.localName()!, prefix: cursor.prefix(), namespaceURI: cursor.namespaceURI() };
  }
  if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) return { type, value: cursor.text()! };
  if (type === XmlEventType.COMMENT || type === XmlEventType.DTD) return { type, value: cursor.text()! };
  if (type === XmlEventType.PROCESSING_INSTRUCTION) return { type, target: cursor.name()!, data: cursor.text()! };
  return { type };
}

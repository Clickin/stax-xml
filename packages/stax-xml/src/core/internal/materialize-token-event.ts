import { TokenCursor } from '../TokenCursor.js';
import { XmlEventType, type AnyXmlEvent, type EventAttribute, type EventAttributes, type XmlEventType as XmlEventTypeValue } from '../types.js';

class MaterializedEventAttributes extends Map<string, EventAttribute> implements EventAttributes {
  toJSON(): Record<string, EventAttribute> {
    return Object.fromEntries(this);
  }
}

function eventShape(
  type: XmlEventTypeValue,
  name: string | undefined = undefined,
  localName: string | undefined = undefined,
  prefix: string | undefined = undefined,
  namespaceURI: string | undefined = undefined,
  attributes: EventAttributes | undefined = undefined,
  value: string | undefined = undefined,
  target: string | undefined = undefined,
  data: string | undefined = undefined,
): AnyXmlEvent {
  // Keep one runtime shape for all EventReader events. The public TypeScript
  // discriminated union remains precise; this cast is intentionally internal.
  return {
    type,
    name,
    localName,
    prefix,
    namespaceURI,
    attributes,
    value,
    target,
    data,
  } as unknown as AnyXmlEvent;
}

/** @internal Materialize one stable event from the cursor's current token. */
export function materializeTokenEvent(cursor: TokenCursor, type: XmlEventTypeValue = cursor.eventType()): AnyXmlEvent {
  if (type === XmlEventType.START_DOCUMENT) return { type, ...cursor.documentDeclaration() };
  if (type === XmlEventType.START_ELEMENT) {
    const count = cursor.attributeCount();
    const attributes = new MaterializedEventAttributes();
    for (let index = 0; index < count; index++) {
      const attribute = cursor.attribute(index)!;
      attributes.set(attribute.name, attribute);
    }
    return { type, name: cursor.name()!, localName: cursor.localName()!, prefix: cursor.prefix(), namespaceURI: cursor.namespaceURI(), attributes, selfClosing: cursor.selfClosing() };
  }
  if (type === XmlEventType.END_ELEMENT) {
    return eventShape(type, cursor.name()!, cursor.localName()!, cursor.prefix(), cursor.namespaceURI());
  }
  if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) return eventShape(type, undefined, undefined, undefined, undefined, undefined, cursor.text()!);
  if (type === XmlEventType.COMMENT || type === XmlEventType.DTD) return eventShape(type, undefined, undefined, undefined, undefined, undefined, cursor.text()!);
  if (type === XmlEventType.PROCESSING_INSTRUCTION) return eventShape(type, undefined, undefined, undefined, undefined, undefined, undefined, cursor.name()!, cursor.text()!);
  return eventShape(type);
}

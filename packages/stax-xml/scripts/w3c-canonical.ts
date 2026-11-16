import { XmlEventType, type AnyXmlEvent } from '../src/core/types.js';

const escapes: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\t': '&#9;', '\n': '&#10;', '\r': '&#13;',
};

function escape(value: string): string {
  return value.replace(/[&<>"\t\n\r]/g, char => escapes[char]!);
}

export function canonicalXml(events: Iterable<AnyXmlEvent>): string {
  let output = '';
  let depth = 0;
  for (const event of events) {
    if (event.type === XmlEventType.START_ELEMENT) {
      const attributes = Array.from(event.attributes?.values() ?? [])
        .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
        .map(attribute => ` ${attribute.name}="${escape(attribute.value)}"`).join('');
      output += `<${event.name}${attributes}>`;
      depth++;
    } else if (event.type === XmlEventType.END_ELEMENT) {
      output += `</${event.name}>`;
      depth--;
    } else if ((event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) && depth > 0) {
      output += escape(event.value);
    } else if (event.type === XmlEventType.PROCESSING_INSTRUCTION) {
      output += `<?${event.target} ${event.data}?>`;
    }
  }
  return output;
}

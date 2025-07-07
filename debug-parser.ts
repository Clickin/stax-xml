import { iter } from "./src/StaxXmlParser";

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<note>
  <to>Tove</to>
  <from>Jani</from>
  <heading>Reminder</heading>
  <body>Don't forget me this weekend!</body>
</note>`;

(async () => {
  const xmlStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(sampleXml);
      controller.enqueue(bytes);
      controller.close();
    }
  });
  const events = iter(xmlStream, {});
  for await (const event of events) {
    console.log(event);
  }
})();
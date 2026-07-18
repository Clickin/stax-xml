import com.ctc.wstx.stax.WstxInputFactory;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamReader;

public final class XmlReaderBench {
  record Result(long events, int checksum) {}

  private static int fold(int seed, String value) {
    for (int index = 0; index < value.length(); index++) seed = seed * 31 + value.charAt(index);
    return seed;
  }

  private static int mix(int seed, int value) {
    return (seed ^ value) * 16777619;
  }

  private static Result consume(Path path) throws Exception {
    byte[] bytes = Files.readAllBytes(path);
    XMLStreamReader reader = new WstxInputFactory().createXMLStreamReader(new ByteArrayInputStream(bytes));
    long events = 0;
    int checksum = 0;
    StringBuilder pendingText = new StringBuilder();
    while (reader.hasNext()) {
      int type = reader.next();
      if (type == XMLStreamConstants.START_ELEMENT) {
        String text = pendingText.toString().trim();
        pendingText.setLength(0);
        if (!text.isEmpty()) {
          events++;
          checksum = fold(fold(checksum, "T"), text);
        }
        events++;
        checksum = fold(fold(checksum, "S"), reader.getName().toString());
        checksum = mix(checksum, reader.getAttributeCount());
        for (int index = 0; index < reader.getAttributeCount(); index++) {
          checksum = fold(checksum, reader.getAttributeName(index).toString());
          checksum = fold(checksum, reader.getAttributeValue(index));
        }
      } else if (type == XMLStreamConstants.END_ELEMENT) {
        String text = pendingText.toString().trim();
        pendingText.setLength(0);
        if (!text.isEmpty()) {
          events++;
          checksum = fold(fold(checksum, "T"), text);
        }
        events++;
        checksum = fold(fold(checksum, "E"), reader.getName().toString());
      } else if (type == XMLStreamConstants.CHARACTERS || type == XMLStreamConstants.CDATA) {
        pendingText.append(reader.getText());
      }
    }
    reader.close();
    return new Result(events, checksum);
  }

  public static void main(String[] args) throws Exception {
    Path path = Path.of(args[0]);
    int warmups = Integer.parseInt(args[1]);
    int runs = Integer.parseInt(args[2]);
    for (int index = 0; index < warmups; index++) consume(path);
    StringBuilder json = new StringBuilder("{\"samples\":[");
    for (int index = 0; index < runs; index++) {
      long started = System.nanoTime();
      Result result = consume(path);
      double seconds = (System.nanoTime() - started) / 1_000_000_000.0;
      if (index > 0) json.append(',');
      json.append(String.format(Locale.ROOT, "{\"events\":%d,\"checksum\":%d,\"seconds\":%.9f}", result.events(), result.checksum(), seconds));
    }
    System.out.println(json.append("]}"));
  }
}

import com.ctc.wstx.stax.WstxInputFactory;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamReader;

/**
 * Large XML stream reader benchmark for Woodstox.
 *
 * Streams a large XML file (10GB/20GB/30GB) row by row,
 * simulating a database insert workload where each row is parsed
 * and a checksum is computed, but no full object materialization occurs.
 */
public final class XmlReaderBenchLarge {
  private static final String ROW_ELEMENT = "row";

  private static final String[] COLUMNS = {
    "id", "account_id", "email", "first_name", "last_name", "phone",
    "address", "city", "state", "zipcode", "country",
    "created_at", "updated_at", "balance", "is_active", "tier", "notes"
  };

  record Result(long rows, long events, int checksum, double seconds, long peakHeapUsed) {}

  private static int fold(int seed, String value) {
    for (int i = 0; i < value.length(); i++) {
      seed = seed * 31 + value.charAt(i);
    }
    return seed;
  }

  private static int mix(int seed, int value) {
    return (seed ^ value) * 16777619;
  }

  private static long usedHeap() {
    Runtime runtime = Runtime.getRuntime();
    return runtime.totalMemory() - runtime.freeMemory();
  }

  private static Result consume(Path path) throws Exception {
    long startHeap = usedHeap();
    long peakHeapUsed = startHeap;

    long started = System.nanoTime();
    long rows = 0;
    long events = 0;
    int checksum = 0;

    try (InputStream input = Files.newInputStream(path)) {
      XMLStreamReader reader = new WstxInputFactory().createXMLStreamReader(input);

      boolean inRow = false;
      String currentElement = "";
      StringBuilder elementText = new StringBuilder();
      String[] rowValues = new String[COLUMNS.length];

      while (reader.hasNext()) {
        int type = reader.next();
        events++;

        if (type == XMLStreamConstants.START_ELEMENT) {
          String name = reader.getLocalName();
          if (ROW_ELEMENT.equals(name)) {
            inRow = true;
            for (int i = 0; i < rowValues.length; i++) {
              rowValues[i] = "";
            }
          } else if (inRow) {
            currentElement = name;
            elementText.setLength(0);
          }
        } else if (type == XMLStreamConstants.END_ELEMENT) {
          String name = reader.getLocalName();
          if (ROW_ELEMENT.equals(name) && inRow) {
            int rowChecksum = 0;
            for (int i = 0; i < COLUMNS.length; i++) {
              String value = rowValues[i] == null ? "" : rowValues[i];
              rowChecksum = mix(rowChecksum, COLUMNS[i].length());
              rowChecksum = fold(rowChecksum, value);
            }
            checksum = mix(checksum, rowChecksum);
            rows++;
            inRow = false;

            long currentHeap = usedHeap();
            if (currentHeap > peakHeapUsed) {
              peakHeapUsed = currentHeap;
            }
          } else if (inRow) {
            int columnIndex = -1;
            for (int i = 0; i < COLUMNS.length; i++) {
              if (COLUMNS[i].equals(name)) {
                columnIndex = i;
                break;
              }
            }
            if (columnIndex >= 0) {
              rowValues[columnIndex] = elementText.toString();
            }
            elementText.setLength(0);
          }
        } else if (type == XMLStreamConstants.CHARACTERS || type == XMLStreamConstants.CDATA) {
          if (inRow && !currentElement.isEmpty()) {
            elementText.append(reader.getText());
          }
        }
      }

      reader.close();
    }

    double seconds = (System.nanoTime() - started) / 1_000_000_000.0;
    return new Result(rows, events, checksum, seconds, peakHeapUsed - startHeap);
  }

  public static void main(String[] args) throws Exception {
    Path path = Path.of(args[0]);
    int warmups = Integer.parseInt(args[1]);
    int runs = Integer.parseInt(args[2]);

    for (int i = 0; i < warmups; i++) {
      System.err.println("Warmup " + (i + 1) + "/" + warmups + "...");
      consume(path);
      System.gc();
    }

    StringBuilder json = new StringBuilder("{\"samples\":[");
    for (int i = 0; i < runs; i++) {
      System.err.println("Run " + (i + 1) + "/" + runs + "...");
      Result result = consume(path);
      if (i > 0) json.append(',');
      json.append(String.format(Locale.ROOT,
        "{\"rows\":%d,\"events\":%d,\"checksum\":%d,\"seconds\":%.9f,\"peakHeapUsed\":%d}",
        result.rows(), result.events(), result.checksum(), result.seconds(), result.peakHeapUsed()));
      if (i < runs - 1) {
        System.gc();
        Thread.sleep(500);
      }
    }
    System.out.println(json.append("]}"));
  }
}

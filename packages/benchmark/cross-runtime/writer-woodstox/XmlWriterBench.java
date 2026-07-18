import javax.xml.stream.XMLOutputFactory;
import javax.xml.stream.XMLStreamWriter;
import java.io.File;
import java.io.FileOutputStream;

public final class XmlWriterBench {
  private static final String DESCRIPTION =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. "
          + "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. "
          + "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";

  public static void main(String[] args) throws Exception {
    int records = Integer.parseInt(args[0]);
    File output = new File(args[1]);
    long started = System.nanoTime();
    XMLStreamWriter writer = XMLOutputFactory.newFactory().createXMLStreamWriter(new FileOutputStream(output), "UTF-8");
    writer.writeStartDocument("UTF-8", "1.0");
    writer.writeStartElement("books");
    for (int bookId = 1; bookId <= records; bookId++) {
      writer.writeStartElement("book");
      writer.writeAttribute("id", "book-" + bookId);
      writeElement(writer, "title", "Sample Book Title Number " + bookId + " - Lorem ipsum dolor sit amet, consectetur adipiscing elit");
      writeElement(writer, "author", "Author Name " + bookId);
      writeElement(writer, "isbn", "978" + (100000000 + ((bookId * 48271) % 900000000)));
      writeElement(writer, "publisher", "Sample Publisher " + bookId);
      writeElement(writer, "publishDate", String.format("%d-%02d-%02d", 2020 + bookId % 5, bookId % 12 + 1, bookId % 28 + 1));
      writeElement(writer, "description", DESCRIPTION);
      writer.writeStartElement("chapters");
      String[] chapterNames = {"Introduction", "Main Content", "Conclusion"};
      for (int chapter = 1; chapter <= 3; chapter++) {
        writer.writeStartElement("chapter");
        writer.writeAttribute("number", Integer.toString(chapter));
        writer.writeCharacters(chapterNames[chapter - 1] + " Chapter for Book " + bookId);
        writer.writeEndElement();
      }
      writer.writeEndElement();
      writer.writeEndElement();
    }
    writer.writeEndElement();
    writer.writeEndDocument();
    writer.close();
    double seconds = (System.nanoTime() - started) / 1_000_000_000.0;
    System.out.printf("{\"records\":%d,\"bytes\":%d,\"seconds\":%.9f,\"throughputMiBs\":%.6f}%n", records, output.length(), seconds, output.length() / 1048576.0 / seconds);
  }

  private static void writeElement(XMLStreamWriter writer, String name, String value) throws Exception {
    writer.writeStartElement(name);
    writer.writeCharacters(value);
    writer.writeEndElement();
  }
}

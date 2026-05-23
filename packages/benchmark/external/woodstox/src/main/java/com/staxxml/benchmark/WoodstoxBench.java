package com.staxxml.benchmark;

import com.ctc.wstx.stax.WstxInputFactory;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamReader;
import java.io.BufferedInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public final class WoodstoxBench {
  private WoodstoxBench() {
  }

  public static void main(String[] args) throws Exception {
    Options options = Options.parse(args);
    long sizeBytes = Files.size(options.file);
    double sizeMiB = sizeBytes / 1024.0 / 1024.0;
    XMLInputFactory factory = createFactory();

    for (int index = 0; index < options.warmups; index++) {
      consume(factory, options.file);
    }

    List<Double> samplesMs = new ArrayList<Double>();
    Result stable = null;
    for (int index = 0; index < options.runs; index++) {
      System.gc();
      long startedAt = System.nanoTime();
      Result result = consume(factory, options.file);
      double elapsedMs = (System.nanoTime() - startedAt) / 1_000_000.0;
      if (stable != null && (stable.eventCount != result.eventCount || stable.checksum != result.checksum)) {
        throw new IllegalStateException("woodstox produced unstable event count or checksum");
      }
      stable = result;
      samplesMs.add(elapsedMs);
    }

    double avgMs = average(samplesMs);
    StringBuilder json = new StringBuilder();
    json.append('{');
    appendJsonField(json, "runtime", System.getProperty("java.version")).append(',');
    appendNumberField(json, "avgMs", avgMs).append(',');
    appendNumberField(json, "minMs", min(samplesMs)).append(',');
    appendNumberField(json, "maxMs", max(samplesMs)).append(',');
    appendNumberField(json, "mibPerSec", sizeMiB / (avgMs / 1000.0)).append(',');
    appendLongField(json, "eventCount", stable.eventCount).append(',');
    appendIntField(json, "checksum", stable.checksum).append(',');
    json.append("\"samplesMs\":[");
    for (int index = 0; index < samplesMs.size(); index++) {
      if (index > 0) {
        json.append(',');
      }
      json.append(doubleJson(samplesMs.get(index)));
    }
    json.append(']');
    json.append('}');
    System.out.println(json);
  }

  private static XMLInputFactory createFactory() {
    XMLInputFactory factory = new WstxInputFactory();
    factory.setProperty(XMLInputFactory.IS_NAMESPACE_AWARE, Boolean.FALSE);
    factory.setProperty(XMLInputFactory.IS_COALESCING, Boolean.TRUE);
    factory.setProperty(XMLInputFactory.SUPPORT_DTD, Boolean.FALSE);
    factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, Boolean.FALSE);
    return factory;
  }

  private static Result consume(XMLInputFactory factory, Path file) throws Exception {
    int eventCount = 0;
    int checksum = 0;

    try (InputStream input = new BufferedInputStream(Files.newInputStream(file), 1024 * 1024)) {
      XMLStreamReader reader = factory.createXMLStreamReader(input, "UTF-8");
      boolean done = false;
      while (!done) {
        int eventType = reader.getEventType();
        switch (eventType) {
          case XMLStreamConstants.START_DOCUMENT:
            eventCount++;
            checksum = mixChecksum(checksum, 0);
            break;
          case XMLStreamConstants.END_DOCUMENT:
            eventCount++;
            checksum = mixChecksum(checksum, 1);
            done = true;
            break;
          case XMLStreamConstants.START_ELEMENT:
            eventCount++;
            checksum = mixChecksum(checksum, 2);
            checksum = foldString(checksum, reader.getLocalName());
            int attrCount = reader.getAttributeCount();
            checksum = mixChecksum(checksum, attrCount);
            for (int attrIndex = 0; attrIndex < attrCount; attrIndex++) {
              checksum = foldString(checksum, reader.getAttributeLocalName(attrIndex));
              checksum = foldString(checksum, reader.getAttributeValue(attrIndex));
            }
            break;
          case XMLStreamConstants.END_ELEMENT:
            eventCount++;
            checksum = mixChecksum(checksum, 3);
            checksum = foldString(checksum, reader.getLocalName());
            break;
          case XMLStreamConstants.CHARACTERS:
            if (!reader.isWhiteSpace()) {
              String text = reader.getText().trim();
              if (!text.isEmpty()) {
                eventCount++;
                checksum = mixChecksum(checksum, 4);
                checksum = foldString(checksum, text);
              }
            }
            break;
          case XMLStreamConstants.CDATA:
            String cdata = reader.getText().trim();
            if (!cdata.isEmpty()) {
              eventCount++;
              checksum = mixChecksum(checksum, 5);
              checksum = foldString(checksum, cdata);
            }
            break;
          default:
            break;
        }
        if (!done) {
          reader.next();
        }
      }
      reader.close();
    }

    return new Result(eventCount, checksum);
  }

  private static int mixChecksum(int seed, int value) {
    return (seed ^ value) * 16777619;
  }

  private static int foldString(int seed, String value) {
    if (value == null || value.isEmpty()) {
      return seed;
    }
    int next = seed;
    for (int index = 0; index < value.length(); index++) {
      next = ((next << 5) - next) + value.charAt(index);
    }
    return next;
  }

  private static double average(List<Double> values) {
    double sum = 0.0;
    for (double value : values) {
      sum += value;
    }
    return sum / values.size();
  }

  private static double min(List<Double> values) {
    double result = Double.POSITIVE_INFINITY;
    for (double value : values) {
      result = Math.min(result, value);
    }
    return result;
  }

  private static double max(List<Double> values) {
    double result = Double.NEGATIVE_INFINITY;
    for (double value : values) {
      result = Math.max(result, value);
    }
    return result;
  }

  private static StringBuilder appendJsonField(StringBuilder json, String name, String value) {
    json.append('"').append(name).append("\":\"").append(escapeJson(value)).append('"');
    return json;
  }

  private static StringBuilder appendNumberField(StringBuilder json, String name, double value) {
    json.append('"').append(name).append("\":").append(doubleJson(value));
    return json;
  }

  private static StringBuilder appendLongField(StringBuilder json, String name, long value) {
    json.append('"').append(name).append("\":").append(value);
    return json;
  }

  private static StringBuilder appendIntField(StringBuilder json, String name, int value) {
    json.append('"').append(name).append("\":").append(value);
    return json;
  }

  private static String doubleJson(double value) {
    if (Double.isNaN(value) || Double.isInfinite(value)) {
      return "null";
    }
    return Double.toString(value);
  }

  private static String escapeJson(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static final class Result {
    final int eventCount;
    final int checksum;

    Result(int eventCount, int checksum) {
      this.eventCount = eventCount;
      this.checksum = checksum;
    }
  }

  private static final class Options {
    final Path file;
    final int runs;
    final int warmups;

    private Options(Path file, int runs, int warmups) {
      this.file = file;
      this.runs = runs;
      this.warmups = warmups;
    }

    static Options parse(String[] args) {
      Path file = null;
      int runs = 3;
      int warmups = 1;

      for (int index = 0; index < args.length; index++) {
        String arg = args[index];
        if ("--file".equals(arg)) {
          file = Paths.get(readValue(args, ++index, arg));
        } else if ("--runs".equals(arg)) {
          runs = parsePositiveInteger(readValue(args, ++index, arg), arg);
        } else if ("--warmups".equals(arg)) {
          warmups = parseNonNegativeInteger(readValue(args, ++index, arg), arg);
        } else {
          throw new IllegalArgumentException("Unknown argument: " + arg);
        }
      }

      if (file == null) {
        throw new IllegalArgumentException("--file is required");
      }
      return new Options(file, runs, warmups);
    }

    private static String readValue(String[] args, int index, String flag) {
      if (index >= args.length) {
        throw new IllegalArgumentException(flag + " requires a value");
      }
      return args[index];
    }

    private static int parsePositiveInteger(String value, String flag) {
      int parsed = Integer.parseInt(value);
      if (parsed <= 0) {
        throw new IllegalArgumentException(flag + " must be positive");
      }
      return parsed;
    }

    private static int parseNonNegativeInteger(String value, String flag) {
      int parsed = Integer.parseInt(value);
      if (parsed < 0) {
        throw new IllegalArgumentException(flag + " must be non-negative");
      }
      return parsed;
    }
  }
}

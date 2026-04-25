package com.staxxml.bench;

import com.ctc.wstx.stax.WstxInputFactory;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.List;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamReader;

public final class WoodstoxBench {
  private WoodstoxBench() {}

  public static void main(String[] args) throws Exception {
    String filePath = requireEnv("STAX_XML_BENCH_FILE");
    String tier = envOrDefault("STAX_XML_BENCH_TIER", "full-string");
    int runs = positiveIntEnv("STAX_XML_BENCH_RUNS", 3);
    int warmups = nonNegativeIntEnv("STAX_XML_BENCH_WARMUPS", 1);

    File file = new File(filePath);
    double fileSizeMiB = file.length() / 1024.0 / 1024.0;

    for (int index = 0; index < warmups; index++) {
      consume(file, tier);
    }

    List<Double> samplesMs = new ArrayList<Double>();
    ParseResult stable = null;
    long peakHeap = 0L;

    for (int index = 0; index < runs; index++) {
      System.gc();
      long startedAt = System.nanoTime();
      ParseResult result = consume(file, tier);
      double elapsedMs = (System.nanoTime() - startedAt) / 1_000_000.0;
      long heap = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
      peakHeap = Math.max(peakHeap, heap);

      if (stable != null && (stable.eventCount != result.eventCount || stable.checksum != result.checksum)) {
        throw new IllegalStateException("Unstable event count or checksum between runs.");
      }

      stable = result;
      samplesMs.add(elapsedMs);
    }

    double avgMs = average(samplesMs);
    double minMs = min(samplesMs);
    double maxMs = max(samplesMs);
    StringBuilder json = new StringBuilder();
    json.append('{');
    appendField(json, "runtime", "java");
    json.append(',');
    appendField(json, "javaVersion", System.getProperty("java.version"));
    json.append(',');
    appendField(json, "javaVmName", System.getProperty("java.vm.name"));
    json.append(',');
    appendField(json, "woodstoxFactory", WstxInputFactory.class.getName());
    json.append(',');
    appendNumberField(json, "avgMs", avgMs);
    json.append(',');
    appendNumberField(json, "minMs", minMs);
    json.append(',');
    appendNumberField(json, "maxMs", maxMs);
    json.append(',');
    appendNumberField(json, "mibPerSec", fileSizeMiB / (avgMs / 1000.0));
    json.append(',');
    appendNumberField(json, "eventCount", stable == null ? 0 : stable.eventCount);
    json.append(',');
    appendNumberField(json, "checksum", stable == null ? 0 : stable.checksum);
    json.append(',');
    appendNumberField(json, "peakHeapUsedBytes", peakHeap);
    json.append(',');
    json.append("\"samplesMs\":[");
    for (int index = 0; index < samplesMs.size(); index++) {
      if (index > 0) json.append(',');
      appendNumber(json, samplesMs.get(index));
    }
    json.append(']');
    json.append('}');
    System.out.println(json.toString());
  }

  private static ParseResult consume(File file, String tier) throws Exception {
    XMLInputFactory factory = new WstxInputFactory();
    setPropertyIfSupported(factory, XMLInputFactory.IS_NAMESPACE_AWARE, Boolean.FALSE);
    setPropertyIfSupported(factory, XMLInputFactory.IS_COALESCING, Boolean.TRUE);
    setPropertyIfSupported(factory, XMLInputFactory.SUPPORT_DTD, Boolean.FALSE);
    setPropertyIfSupported(factory, "javax.xml.stream.isSupportingExternalEntities", Boolean.FALSE);

    BufferedInputStream input = new BufferedInputStream(new FileInputStream(file), 1024 * 1024);
    XMLStreamReader reader = null;
    try {
      reader = factory.createXMLStreamReader(input, "UTF-8");
      ParseResult result = new ParseResult();
      processEvent(reader, reader.getEventType(), tier, result);
      while (reader.hasNext()) {
        processEvent(reader, reader.next(), tier, result);
      }
      return result;
    } finally {
      if (reader != null) {
        try {
          reader.close();
        } catch (Exception ignored) {
        }
      }
      input.close();
    }
  }

  private static void processEvent(XMLStreamReader reader, int event, String tier, ParseResult result) {
    if (event == XMLStreamConstants.CHARACTERS || event == XMLStreamConstants.CDATA) {
      String text = reader.getText();
      String trimmed = text == null ? "" : text.trim();
      if (trimmed.isEmpty()) {
        return;
      }
      int code = event == XMLStreamConstants.CDATA ? 5 : 4;
      result.addEvent(code);
      mixAttrCountForCountOrAttrValue(result, tier, 0);
      if ("text-string-only".equals(tier) || "full-string".equals(tier)) {
        result.checksum = foldString(result.checksum, trimmed);
      }
      mixAttrCountForFullString(result, tier, 0);
      return;
    }

    if (event == XMLStreamConstants.START_DOCUMENT) {
      result.addEvent(0);
      mixAttrCountForCountOrAttrValue(result, tier, 0);
      mixAttrCountForFullString(result, tier, 0);
      return;
    }
    if (event == XMLStreamConstants.END_DOCUMENT) {
      result.addEvent(1);
      mixAttrCountForCountOrAttrValue(result, tier, 0);
      mixAttrCountForFullString(result, tier, 0);
      return;
    }
    if (event == XMLStreamConstants.START_ELEMENT) {
      result.addEvent(2);
      int attrCount = reader.getAttributeCount();
      mixAttrCountForCountOrAttrValue(result, tier, attrCount);
      if ("count-only".equals(tier)) {
        return;
      } else if ("name-string-only".equals(tier)) {
        result.checksum = foldString(result.checksum, reader.getLocalName());
      } else if ("attr-value-string-only".equals(tier)) {
        for (int index = 0; index < attrCount; index++) {
          result.checksum = foldString(result.checksum, reader.getAttributeValue(index));
        }
      } else if ("full-string".equals(tier)) {
        result.checksum = foldString(result.checksum, reader.getLocalName());
        result.checksum = mixChecksum(result.checksum, attrCount);
        for (int index = 0; index < attrCount; index++) {
          result.checksum = foldString(result.checksum, reader.getAttributeLocalName(index));
          result.checksum = foldString(result.checksum, reader.getAttributeValue(index));
        }
      }
      return;
    }
    if (event == XMLStreamConstants.END_ELEMENT) {
      result.addEvent(3);
      mixAttrCountForCountOrAttrValue(result, tier, 0);
      if ("name-string-only".equals(tier) || "full-string".equals(tier)) {
        result.checksum = foldString(result.checksum, reader.getLocalName());
      }
      mixAttrCountForFullString(result, tier, 0);
    }
  }

  private static void mixAttrCountForCountOrAttrValue(ParseResult result, String tier, int attrCount) {
    if ("count-only".equals(tier) || "attr-value-string-only".equals(tier)) {
      result.checksum = mixChecksum(result.checksum, attrCount);
    }
  }

  private static void mixAttrCountForFullString(ParseResult result, String tier, int attrCount) {
    if ("full-string".equals(tier)) {
      result.checksum = mixChecksum(result.checksum, attrCount);
    }
  }

  private static void setPropertyIfSupported(XMLInputFactory factory, String property, Object value) {
    try {
      factory.setProperty(property, value);
    } catch (IllegalArgumentException ignored) {
    }
  }

  private static int mixChecksum(int seed, int value) {
    return (int) (((seed ^ value) * 16777619L) & 0xffffffffL);
  }

  private static int foldString(int seed, String value) {
    if (value == null || value.isEmpty()) {
      return seed;
    }
    int next = seed;
    for (int index = 0; index < value.length(); index++) {
      next = ((next << 5) - next + value.charAt(index));
    }
    return next;
  }

  private static String requireEnv(String name) {
    String value = System.getenv(name);
    if (value == null || value.isEmpty()) {
      throw new IllegalArgumentException(name + " is required.");
    }
    return value;
  }

  private static String envOrDefault(String name, String defaultValue) {
    String value = System.getenv(name);
    return value == null || value.isEmpty() ? defaultValue : value;
  }

  private static int positiveIntEnv(String name, int defaultValue) {
    int value = Integer.parseInt(envOrDefault(name, String.valueOf(defaultValue)));
    if (value <= 0) {
      throw new IllegalArgumentException(name + " must be positive.");
    }
    return value;
  }

  private static int nonNegativeIntEnv(String name, int defaultValue) {
    int value = Integer.parseInt(envOrDefault(name, String.valueOf(defaultValue)));
    if (value < 0) {
      throw new IllegalArgumentException(name + " must be non-negative.");
    }
    return value;
  }

  private static double average(List<Double> values) {
    double sum = 0.0;
    for (Double value : values) {
      sum += value.doubleValue();
    }
    return sum / values.size();
  }

  private static double min(List<Double> values) {
    double result = Double.POSITIVE_INFINITY;
    for (Double value : values) {
      result = Math.min(result, value.doubleValue());
    }
    return result;
  }

  private static double max(List<Double> values) {
    double result = Double.NEGATIVE_INFINITY;
    for (Double value : values) {
      result = Math.max(result, value.doubleValue());
    }
    return result;
  }

  private static void appendField(StringBuilder json, String name, String value) {
    json.append('"').append(name).append("\":\"");
    appendEscaped(json, value);
    json.append('"');
  }

  private static void appendNumberField(StringBuilder json, String name, double value) {
    json.append('"').append(name).append("\":");
    appendNumber(json, value);
  }

  private static void appendNumber(StringBuilder json, double value) {
    if (Double.isFinite(value)) {
      json.append(Double.toString(value));
    } else {
      json.append("null");
    }
  }

  private static void appendEscaped(StringBuilder json, String value) {
    for (int index = 0; index < value.length(); index++) {
      char ch = value.charAt(index);
      switch (ch) {
        case '\\':
          json.append("\\\\");
          break;
        case '"':
          json.append("\\\"");
          break;
        case '\n':
          json.append("\\n");
          break;
        case '\r':
          json.append("\\r");
          break;
        case '\t':
          json.append("\\t");
          break;
        default:
          json.append(ch);
      }
    }
  }

  private static final class ParseResult {
    int eventCount;
    int checksum;

    void addEvent(int type) {
      eventCount++;
      checksum = mixChecksum(checksum, type);
    }
  }
}

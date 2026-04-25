use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use std::env;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::time::Instant;

#[derive(Clone, Copy)]
struct ParseResult {
    event_count: u64,
    checksum: i32,
}

impl ParseResult {
    fn new() -> Self {
        Self {
            event_count: 0,
            checksum: 0,
        }
    }

    fn add_event(&mut self, event_type: i32) {
        self.event_count += 1;
        self.checksum = mix_checksum(self.checksum, event_type);
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    if env::args().any(|arg| arg == "--version") {
        println!(
            "{{\"runtime\":\"rust\",\"quickXmlVersion\":\"{}\"}}",
            "0.39.2"
        );
        return Ok(());
    }

    let file_path = required_env("STAX_XML_BENCH_FILE")?;
    let tier = env::var("STAX_XML_BENCH_TIER").unwrap_or_else(|_| "full-string".to_string());
    let runs = positive_env("STAX_XML_BENCH_RUNS", 3)?;
    let warmups = non_negative_env("STAX_XML_BENCH_WARMUPS", 1)?;
    let size_mib = std::fs::metadata(&file_path)?.len() as f64 / 1024.0 / 1024.0;

    for _ in 0..warmups {
        consume(Path::new(&file_path), &tier)?;
    }

    let mut samples_ms = Vec::with_capacity(runs);
    let mut stable: Option<ParseResult> = None;
    for _ in 0..runs {
        let started_at = Instant::now();
        let result = consume(Path::new(&file_path), &tier)?;
        let elapsed_ms = started_at.elapsed().as_secs_f64() * 1000.0;

        if let Some(previous) = stable {
            if previous.event_count != result.event_count || previous.checksum != result.checksum {
                return Err("unstable event count or checksum between runs".into());
            }
        }

        stable = Some(result);
        samples_ms.push(elapsed_ms);
    }

    let stable = stable.unwrap_or_else(ParseResult::new);
    let avg_ms = average(&samples_ms);
    let min_ms = samples_ms.iter().copied().fold(f64::INFINITY, f64::min);
    let max_ms = samples_ms.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let samples = samples_ms
        .iter()
        .map(|value| number_json(*value))
        .collect::<Vec<_>>()
        .join(",");

    println!(
        concat!(
            "{{",
            "\"runtime\":\"rust\",",
            "\"quickXmlCrate\":\"quick-xml\",",
            "\"quickXmlVersion\":\"0.39.2\",",
            "\"avgMs\":{},",
            "\"minMs\":{},",
            "\"maxMs\":{},",
            "\"mibPerSec\":{},",
            "\"eventCount\":{},",
            "\"checksum\":{},",
            "\"peakHeapUsedBytes\":null,",
            "\"samplesMs\":[{}]",
            "}}"
        ),
        number_json(avg_ms),
        number_json(min_ms),
        number_json(max_ms),
        number_json(size_mib / (avg_ms / 1000.0)),
        stable.event_count,
        stable.checksum,
        samples
    );

    Ok(())
}

fn consume(path: &Path, tier: &str) -> Result<ParseResult, Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let mut reader = Reader::from_reader(BufReader::with_capacity(1024 * 1024, file));
    reader.config_mut().trim_text(false);

    let mut result = ParseResult::new();
    let mut buf = Vec::with_capacity(8192);
    result.add_event(0);
    mix_attr_count_for_count_or_attr_value(&mut result, tier, 0);
    mix_attr_count_for_full_string(&mut result, tier, 0);

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(event) => process_start(&event, tier, &mut result)?,
            Event::Empty(event) => {
                process_start(&event, tier, &mut result)?;
                result.add_event(3);
                mix_attr_count_for_count_or_attr_value(&mut result, tier, 0);
                if tier == "name-string-only" || tier == "full-string" {
                    result.checksum = fold_bytes(result.checksum, event.name().as_ref())?;
                }
                mix_attr_count_for_full_string(&mut result, tier, 0);
            }
            Event::End(event) => {
                result.add_event(3);
                mix_attr_count_for_count_or_attr_value(&mut result, tier, 0);
                if tier == "name-string-only" || tier == "full-string" {
                    result.checksum = fold_bytes(result.checksum, event.name().as_ref())?;
                }
                mix_attr_count_for_full_string(&mut result, tier, 0);
            }
            Event::Text(event) => {
                let text = std::str::from_utf8(event.as_ref())?;
                process_text(text, 4, tier, &mut result);
            }
            Event::CData(event) => {
                let text = std::str::from_utf8(event.as_ref())?;
                process_text(text, 5, tier, &mut result);
            }
            Event::Eof => break,
            Event::Decl(_) | Event::PI(_) | Event::DocType(_) | Event::Comment(_) => {}
            _ => {}
        }
        buf.clear();
    }

    result.add_event(1);
    mix_attr_count_for_count_or_attr_value(&mut result, tier, 0);
    mix_attr_count_for_full_string(&mut result, tier, 0);
    Ok(result)
}

fn process_start(
    event: &BytesStart<'_>,
    tier: &str,
    result: &mut ParseResult,
) -> Result<(), Box<dyn std::error::Error>> {
    result.add_event(2);
    let mut attrs = Vec::new();
    for attr in event.attributes().with_checks(false) {
        let attr = attr?;
        attrs.push((attr.key.as_ref().to_vec(), attr.value.as_ref().to_vec()));
    }
    let attr_count = attrs.len() as i32;
    mix_attr_count_for_count_or_attr_value(result, tier, attr_count);

    match tier {
        "count-only" => {}
        "name-string-only" => {
            result.checksum = fold_bytes(result.checksum, event.name().as_ref())?;
        }
        "attr-value-string-only" => {
            for (_, value) in attrs {
                result.checksum = fold_bytes(result.checksum, &value)?;
            }
        }
        "full-string" => {
            result.checksum = fold_bytes(result.checksum, event.name().as_ref())?;
            result.checksum = mix_checksum(result.checksum, attr_count);
            for (name, value) in attrs {
                result.checksum = fold_bytes(result.checksum, &name)?;
                result.checksum = fold_bytes(result.checksum, &value)?;
            }
        }
        "text-string-only" => {}
        other => return Err(format!("unknown tier: {other}").into()),
    }

    Ok(())
}

fn mix_attr_count_for_count_or_attr_value(result: &mut ParseResult, tier: &str, attr_count: i32) {
    if tier == "count-only" || tier == "attr-value-string-only" {
        result.checksum = mix_checksum(result.checksum, attr_count);
    }
}

fn mix_attr_count_for_full_string(result: &mut ParseResult, tier: &str, attr_count: i32) {
    if tier == "full-string" {
        result.checksum = mix_checksum(result.checksum, attr_count);
    }
}

fn process_text(text: &str, event_type: i32, tier: &str, result: &mut ParseResult) {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return;
    }
    result.add_event(event_type);
    mix_attr_count_for_count_or_attr_value(result, tier, 0);
    if tier == "text-string-only" || tier == "full-string" {
        result.checksum = fold_str(result.checksum, trimmed);
    }
    mix_attr_count_for_full_string(result, tier, 0);
}

fn mix_checksum(seed: i32, value: i32) -> i32 {
    ((seed ^ value).wrapping_mul(16_777_619)) as i32
}

fn fold_bytes(seed: i32, bytes: &[u8]) -> Result<i32, Box<dyn std::error::Error>> {
    Ok(fold_str(seed, std::str::from_utf8(bytes)?))
}

fn fold_str(seed: i32, value: &str) -> i32 {
    let mut next = seed;
    for unit in value.encode_utf16() {
        next = next.wrapping_shl(5).wrapping_sub(next).wrapping_add(unit as i32);
    }
    next
}

fn required_env(name: &str) -> Result<String, Box<dyn std::error::Error>> {
    let value = env::var(name)?;
    if value.is_empty() {
        Err(format!("{name} is required").into())
    } else {
        Ok(value)
    }
}

fn positive_env(name: &str, default_value: usize) -> Result<usize, Box<dyn std::error::Error>> {
    let value = env::var(name)
        .ok()
        .map(|value| value.parse())
        .transpose()?
        .unwrap_or(default_value);
    if value == 0 {
        Err(format!("{name} must be positive").into())
    } else {
        Ok(value)
    }
}

fn non_negative_env(name: &str, default_value: usize) -> Result<usize, Box<dyn std::error::Error>> {
    let value = env::var(name)
        .ok()
        .map(|value| value.parse())
        .transpose()?
        .unwrap_or(default_value);
    Ok(value)
}

fn average(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}

fn number_json(value: f64) -> String {
    if value.is_finite() {
        value.to_string()
    } else {
        "null".to_string()
    }
}

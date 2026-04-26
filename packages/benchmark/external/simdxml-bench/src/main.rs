// simdxml notice:
// This benchmark shim invokes simdxml::parse and mirrors the upstream parse
// workload shape from https://github.com/simdxml/simdxml under the project's
// MIT license option (simdxml is licensed MIT OR Apache-2.0).
use simdxml::XmlIndex;
use std::env;
use std::path::Path;
use std::time::Instant;

const SIMDXML_VERSION: &str = "0.2.1";
const DEFAULT_MAX_MIB: f64 = 64.0;

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
            "{{\"runtime\":\"rust\",\"simdxmlVersion\":\"{}\"}}",
            SIMDXML_VERSION
        );
        return Ok(());
    }

    let file_path = required_env("STAX_XML_BENCH_FILE")?;
    let tier = env::var("STAX_XML_BENCH_TIER").unwrap_or_else(|_| "full-string".to_owned());
    let runs = positive_env("STAX_XML_BENCH_RUNS", 3)?;
    let warmups = non_negative_env("STAX_XML_BENCH_WARMUPS", 1)?;
    let max_mib = positive_float_env("STAX_XML_BENCH_MAX_MIB", DEFAULT_MAX_MIB)?;
    let input_mode = env::var("STAX_XML_BENCH_INPUT_MODE").unwrap_or_else(|_| "file".to_owned());
    let workload =
        env::var("STAX_XML_BENCH_WORKLOAD").unwrap_or_else(|_| "parity-events".to_owned());
    let size_mib = std::fs::metadata(&file_path)?.len() as f64 / 1024.0 / 1024.0;
    if size_mib > max_mib {
        return Err(format!(
            "simdxml benchmark skipped: fixture {:.2} MiB exceeds max {:.2} MiB",
            size_mib, max_mib
        )
        .into());
    }

    let memory_input = match input_mode.as_str() {
        "file" => None,
        "memory" => Some(std::fs::read(&file_path)?),
        other => return Err(format!("unknown simdxml input mode: {other}").into()),
    };

    for _ in 0..warmups {
        consume(
            Path::new(&file_path),
            memory_input.as_deref(),
            &tier,
            &workload,
        )?;
    }

    let mut samples_ms = Vec::with_capacity(runs);
    let mut stable: Option<ParseResult> = None;
    for _ in 0..runs {
        let started_at = Instant::now();
        let result = consume(
            Path::new(&file_path),
            memory_input.as_deref(),
            &tier,
            &workload,
        )?;
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
            "\"simdxmlCrate\":\"simdxml\",",
            "\"simdxmlVersion\":\"{}\",",
            "\"inputMode\":\"{}\",",
            "\"workload\":\"{}\",",
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
        SIMDXML_VERSION,
        input_mode,
        workload,
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

fn consume(
    path: &Path,
    memory_input: Option<&[u8]>,
    tier: &str,
    workload: &str,
) -> Result<ParseResult, Box<dyn std::error::Error>> {
    let file_input;
    let input = match memory_input {
        Some(input) => input,
        None => {
            file_input = std::fs::read(path)?;
            &file_input
        }
    };
    match workload {
        "parity-events" => consume_parity_events(input, tier),
        "upstream-parse" => consume_upstream_parse(input),
        other => Err(format!("unknown simdxml workload: {other}").into()),
    }
}

fn consume_upstream_parse(input: &[u8]) -> Result<ParseResult, Box<dyn std::error::Error>> {
    let index = simdxml::parse(input)?;
    let tag_count = index.tag_count() as u64;
    let text_count = index.text_count() as u64;
    Ok(ParseResult {
        event_count: tag_count + text_count,
        checksum: mix_checksum(tag_count as i32, text_count as i32),
    })
}

fn consume_parity_events(
    input: &[u8],
    tier: &str,
) -> Result<ParseResult, Box<dyn std::error::Error>> {
    let index = simdxml::parse(input)?;
    let mut result = ParseResult::new();
    result.add_event(0);
    process_attr_count_for_count_or_attr_value(&mut result, tier, 0);
    process_attr_count_for_full_string(&mut result, tier, 0);

    let mut tag_index = 0usize;
    let mut text_index = 0usize;
    while tag_index < index.tag_count() || text_index < index.text_count() {
        let next_tag_start = index.tag_starts.get(tag_index).copied().unwrap_or(u64::MAX);
        let next_text_start = index
            .text_ranges
            .get(text_index)
            .map(|range| range.start)
            .unwrap_or(u64::MAX);

        if next_text_start < next_tag_start {
            process_text(index.text_by_index(text_index), 4, tier, &mut result);
            text_index += 1;
            continue;
        }

        process_tag(&index, tag_index, tier, &mut result)?;
        tag_index += 1;
    }

    result.add_event(1);
    process_attr_count_for_count_or_attr_value(&mut result, tier, 0);
    process_attr_count_for_full_string(&mut result, tier, 0);
    Ok(result)
}

fn process_tag(
    index: &XmlIndex<'_>,
    tag_index: usize,
    tier: &str,
    result: &mut ParseResult,
) -> Result<(), Box<dyn std::error::Error>> {
    let raw = index.raw_tag(tag_index);
    if raw.starts_with("<?") || raw.starts_with("<!--") || raw.starts_with("<!DOCTYPE") {
        return Ok(());
    }
    if raw.starts_with("<![CDATA[") {
        let text = raw
            .strip_prefix("<![CDATA[")
            .and_then(|value| value.strip_suffix("]]>"));
        if let Some(text) = text {
            process_text(text, 5, tier, result);
        }
        return Ok(());
    }
    if raw.starts_with("</") {
        process_end(index.tag_name(tag_index), tier, result);
        return Ok(());
    }

    process_start(index, tag_index, tier, result)?;
    if is_self_closing_tag(raw) {
        process_end(index.tag_name(tag_index), tier, result);
    }
    Ok(())
}

fn process_start(
    index: &XmlIndex<'_>,
    tag_index: usize,
    tier: &str,
    result: &mut ParseResult,
) -> Result<(), Box<dyn std::error::Error>> {
    result.add_event(2);
    let attrs = index.attributes(tag_index);
    let attr_count = attrs.len() as i32;
    process_attr_count_for_count_or_attr_value(result, tier, attr_count);

    match tier {
        "count-only" => {}
        "name-string-only" => {
            result.checksum = fold_str(result.checksum, index.tag_name(tag_index));
        }
        "attr-value-string-only" => {
            for (_, value) in attrs {
                result.checksum = fold_str(result.checksum, value);
            }
        }
        "full-string" => {
            result.checksum = fold_str(result.checksum, index.tag_name(tag_index));
            result.checksum = mix_checksum(result.checksum, attr_count);
            for (name, value) in attrs {
                result.checksum = fold_str(result.checksum, name);
                result.checksum = fold_str(result.checksum, value);
            }
        }
        "text-string-only" => {}
        other => return Err(format!("unknown tier: {other}").into()),
    }

    Ok(())
}

fn process_end(name: &str, tier: &str, result: &mut ParseResult) {
    result.add_event(3);
    process_attr_count_for_count_or_attr_value(result, tier, 0);
    if tier == "name-string-only" || tier == "full-string" {
        result.checksum = fold_str(result.checksum, name);
    }
    process_attr_count_for_full_string(result, tier, 0);
}

fn process_text(text: &str, event_type: i32, tier: &str, result: &mut ParseResult) {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return;
    }
    result.add_event(event_type);
    process_attr_count_for_count_or_attr_value(result, tier, 0);
    if tier == "text-string-only" || tier == "full-string" {
        result.checksum = fold_str(result.checksum, trimmed);
    }
    process_attr_count_for_full_string(result, tier, 0);
}

fn process_attr_count_for_count_or_attr_value(
    result: &mut ParseResult,
    tier: &str,
    attr_count: i32,
) {
    if tier == "count-only" || tier == "attr-value-string-only" {
        result.checksum = mix_checksum(result.checksum, attr_count);
    }
}

fn process_attr_count_for_full_string(result: &mut ParseResult, tier: &str, attr_count: i32) {
    if tier == "full-string" {
        result.checksum = mix_checksum(result.checksum, attr_count);
    }
}

fn is_self_closing_tag(raw: &str) -> bool {
    raw.as_bytes()
        .iter()
        .rev()
        .copied()
        .skip_while(|byte| byte.is_ascii_whitespace() || *byte == b'>')
        .next()
        == Some(b'/')
}

fn mix_checksum(seed: i32, value: i32) -> i32 {
    ((seed ^ value).wrapping_mul(16_777_619)) as i32
}

fn fold_str(seed: i32, value: &str) -> i32 {
    let mut next = seed;
    for unit in value.encode_utf16() {
        next = next
            .wrapping_shl(5)
            .wrapping_sub(next)
            .wrapping_add(unit as i32);
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

fn positive_float_env(name: &str, default_value: f64) -> Result<f64, Box<dyn std::error::Error>> {
    let value = env::var(name)
        .ok()
        .map(|value| value.parse())
        .transpose()?
        .unwrap_or(default_value);
    if !value.is_finite() || value <= 0.0 {
        Err(format!("{name} must be a positive number").into())
    } else {
        Ok(value)
    }
}

fn average(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}

fn number_json(value: f64) -> String {
    if value.is_finite() {
        value.to_string()
    } else {
        "null".to_owned()
    }
}

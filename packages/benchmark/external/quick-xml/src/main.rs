use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use std::borrow::Cow;
use std::env;
use std::fs::{self, File};
use std::io::BufReader;
use std::path::PathBuf;
use std::process;
use std::time::Instant;

struct Options {
    file: PathBuf,
    runs: usize,
    warmups: usize,
}

struct ConsumeResult {
    event_count: i64,
    checksum: i32,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let options = parse_args()?;
    let size_bytes = fs::metadata(&options.file)?.len();
    let size_mib = size_bytes as f64 / 1024.0 / 1024.0;

    for _ in 0..options.warmups {
        consume(&options.file)?;
    }

    let mut samples_ms = Vec::with_capacity(options.runs);
    let mut stable: Option<ConsumeResult> = None;
    for _ in 0..options.runs {
        let started_at = Instant::now();
        let result = consume(&options.file)?;
        let elapsed_ms = started_at.elapsed().as_secs_f64() * 1000.0;
        if let Some(previous) = &stable {
            if previous.event_count != result.event_count || previous.checksum != result.checksum {
                return Err("quick-xml produced unstable event count or checksum".into());
            }
        }
        stable = Some(result);
        samples_ms.push(elapsed_ms);
    }

    let stable = stable.ok_or("no benchmark runs executed")?;
    let avg_ms = average(&samples_ms);
    print!(
        "{{\"runtime\":\"{}\",\"avgMs\":{},\"minMs\":{},\"maxMs\":{},\"mibPerSec\":{},\"eventCount\":{},\"checksum\":{},\"samplesMs\":[",
        env!("CARGO_PKG_VERSION"),
        json_f64(avg_ms),
        json_f64(min(&samples_ms)),
        json_f64(max(&samples_ms)),
        json_f64(size_mib / (avg_ms / 1000.0)),
        stable.event_count,
        stable.checksum
    );
    for (index, sample) in samples_ms.iter().enumerate() {
        if index > 0 {
            print!(",");
        }
        print!("{}", json_f64(*sample));
    }
    println!("]}}");

    Ok(())
}

fn parse_args() -> Result<Options, Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut file: Option<PathBuf> = None;
    let mut runs = 3usize;
    let mut warmups = 1usize;
    let mut index = 0usize;

    while index < args.len() {
        let arg = &args[index];
        match arg.as_str() {
            "--file" => {
                index += 1;
                file = Some(PathBuf::from(read_value(&args, index, arg)?));
            }
            "--runs" => {
                index += 1;
                runs = parse_positive_usize(read_value(&args, index, arg)?, arg)?;
            }
            "--warmups" => {
                index += 1;
                warmups = parse_usize(read_value(&args, index, arg)?, arg)?;
            }
            _ => return Err(format!("Unknown argument: {arg}").into()),
        }
        index += 1;
    }

    Ok(Options {
        file: file.ok_or("--file is required")?,
        runs,
        warmups,
    })
}

fn read_value<'a>(
    args: &'a [String],
    index: usize,
    flag: &str,
) -> Result<&'a str, Box<dyn std::error::Error>> {
    args.get(index)
        .map(String::as_str)
        .ok_or_else(|| format!("{flag} requires a value").into())
}

fn parse_positive_usize(value: &str, flag: &str) -> Result<usize, Box<dyn std::error::Error>> {
    let parsed = parse_usize(value, flag)?;
    if parsed == 0 {
        return Err(format!("{flag} must be positive").into());
    }
    Ok(parsed)
}

fn parse_usize(value: &str, flag: &str) -> Result<usize, Box<dyn std::error::Error>> {
    value
        .parse::<usize>()
        .map_err(|_| format!("{flag} must be an integer").into())
}

fn consume(path: &PathBuf) -> Result<ConsumeResult, Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let mut reader = Reader::from_reader(BufReader::with_capacity(1024 * 1024, file));
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::with_capacity(64 * 1024);
    let mut event_count = 1i64;
    let mut checksum = mix_checksum(0, 0);

    loop {
        match reader.read_event_into(&mut buffer)? {
            Event::Start(event) => {
                let folded = fold_start(checksum, &event)?;
                checksum = folded;
                event_count += 1;
            }
            Event::Empty(event) => {
                let folded = fold_start(checksum, &event)?;
                event_count += 1;
                checksum = mix_checksum(folded, 3);
                checksum = fold_bytes(checksum, event.name().as_ref())?;
                event_count += 1;
            }
            Event::End(event) => {
                checksum = mix_checksum(checksum, 3);
                checksum = fold_bytes(checksum, event.name().as_ref())?;
                event_count += 1;
            }
            Event::Text(event) => {
                let text = event.decode()?;
                checksum = fold_text_event(checksum, &text, 4, &mut event_count);
            }
            Event::CData(event) => {
                let text = event.decode()?;
                checksum = fold_text_event(checksum, &text, 5, &mut event_count);
            }
            Event::Eof => {
                checksum = mix_checksum(checksum, 1);
                event_count += 1;
                break;
            }
            _ => {}
        }
        buffer.clear();
    }

    Ok(ConsumeResult {
        event_count,
        checksum,
    })
}

fn fold_start(
    mut checksum: i32,
    event: &BytesStart<'_>,
) -> Result<i32, Box<dyn std::error::Error>> {
    checksum = mix_checksum(checksum, 2);
    checksum = fold_bytes(checksum, event.name().as_ref())?;
    let mut attributes = event.attributes();
    let attrs = attributes.with_checks(false);
    let mut collected = Vec::new();
    for attr in attrs {
        collected.push(attr?);
    }
    checksum = mix_checksum(checksum, collected.len() as i32);
    for attr in collected {
        checksum = fold_bytes(checksum, attr.key.as_ref())?;
        checksum = fold_bytes(checksum, attr.value.as_ref())?;
    }
    Ok(checksum)
}

fn fold_text_event(
    mut checksum: i32,
    text: &Cow<'_, str>,
    event_type: i32,
    event_count: &mut i64,
) -> i32 {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return checksum;
    }
    checksum = mix_checksum(checksum, event_type);
    checksum = fold_str(checksum, trimmed);
    *event_count += 1;
    checksum
}

fn mix_checksum(seed: i32, value: i32) -> i32 {
    (seed ^ value).wrapping_mul(16_777_619)
}

fn fold_bytes(seed: i32, value: &[u8]) -> Result<i32, Box<dyn std::error::Error>> {
    Ok(fold_str(seed, std::str::from_utf8(value)?))
}

fn fold_str(mut seed: i32, value: &str) -> i32 {
    if value.is_empty() {
        return seed;
    }
    for unit in value.encode_utf16() {
        seed = seed.wrapping_mul(31).wrapping_add(unit as i32);
    }
    seed
}

fn average(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}

fn min(values: &[f64]) -> f64 {
    values.iter().copied().fold(f64::INFINITY, f64::min)
}

fn max(values: &[f64]) -> f64 {
    values.iter().copied().fold(f64::NEG_INFINITY, f64::max)
}

fn json_f64(value: f64) -> String {
    if value.is_finite() {
        value.to_string()
    } else {
        "null".to_string()
    }
}

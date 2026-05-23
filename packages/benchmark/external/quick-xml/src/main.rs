use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
#[cfg(feature = "count-allocations")]
use std::alloc::{GlobalAlloc, Layout, System};
use std::borrow::Cow;
use std::env;
use std::fs::{self, File};
use std::io::BufReader;
use std::path::PathBuf;
use std::process;
#[cfg(feature = "count-allocations")]
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Instant;

#[cfg(feature = "count-allocations")]
struct CountingAllocator;

#[cfg(feature = "count-allocations")]
static TRACK_ALLOCATIONS: AtomicBool = AtomicBool::new(false);
#[cfg(feature = "count-allocations")]
static ALLOC_COUNT: AtomicU64 = AtomicU64::new(0);
#[cfg(feature = "count-allocations")]
static ALLOC_BYTES: AtomicU64 = AtomicU64::new(0);
#[cfg(feature = "count-allocations")]
static DEALLOC_COUNT: AtomicU64 = AtomicU64::new(0);
#[cfg(feature = "count-allocations")]
static DEALLOC_BYTES: AtomicU64 = AtomicU64::new(0);
#[cfg(feature = "count-allocations")]
static REALLOC_COUNT: AtomicU64 = AtomicU64::new(0);
#[cfg(feature = "count-allocations")]
static REALLOC_BYTES_IN: AtomicU64 = AtomicU64::new(0);
#[cfg(feature = "count-allocations")]
static REALLOC_BYTES_OUT: AtomicU64 = AtomicU64::new(0);

#[cfg(feature = "count-allocations")]
#[global_allocator]
static GLOBAL: CountingAllocator = CountingAllocator;

#[cfg(feature = "count-allocations")]
unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = unsafe { System.alloc(layout) };
        if TRACK_ALLOCATIONS.load(Ordering::Relaxed) && !ptr.is_null() {
            ALLOC_COUNT.fetch_add(1, Ordering::Relaxed);
            ALLOC_BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed);
        }
        ptr
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        if TRACK_ALLOCATIONS.load(Ordering::Relaxed) && !ptr.is_null() {
            DEALLOC_COUNT.fetch_add(1, Ordering::Relaxed);
            DEALLOC_BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed);
        }
        unsafe {
            System.dealloc(ptr, layout);
        }
    }

    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        let next = unsafe { System.realloc(ptr, layout, new_size) };
        if TRACK_ALLOCATIONS.load(Ordering::Relaxed) && !next.is_null() {
            REALLOC_COUNT.fetch_add(1, Ordering::Relaxed);
            REALLOC_BYTES_IN.fetch_add(layout.size() as u64, Ordering::Relaxed);
            REALLOC_BYTES_OUT.fetch_add(new_size as u64, Ordering::Relaxed);
        }
        next
    }
}

struct Options {
    file: PathBuf,
    runs: usize,
    warmups: usize,
    count_allocations: bool,
}

struct ConsumeResult {
    event_count: i64,
    checksum: i32,
    #[cfg(feature = "count-allocations")]
    shape_stats: ShapeStats,
}

#[cfg(feature = "count-allocations")]
#[derive(Clone, Copy)]
struct AllocationStats {
    alloc_count: u64,
    alloc_bytes: u64,
    dealloc_count: u64,
    dealloc_bytes: u64,
    realloc_count: u64,
    realloc_bytes_in: u64,
    realloc_bytes_out: u64,
}

#[cfg(feature = "count-allocations")]
#[derive(Clone, Copy, Default)]
struct ShapeStats {
    text_decode_count: u64,
    text_borrowed_count: u64,
    text_owned_count: u64,
    text_non_empty_count: u64,
    cdata_decode_count: u64,
    cdata_borrowed_count: u64,
    cdata_owned_count: u64,
    cdata_non_empty_count: u64,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let options = parse_args()?;
    #[cfg(not(feature = "count-allocations"))]
    if options.count_allocations {
        return Err("--count-allocations requires the count-allocations cargo feature".into());
    }
    let size_bytes = fs::metadata(&options.file)?.len();
    let size_mib = size_bytes as f64 / 1024.0 / 1024.0;

    for _ in 0..options.warmups {
        consume(&options.file)?;
    }

    let mut samples_ms = Vec::with_capacity(options.runs);
    #[cfg(feature = "count-allocations")]
    let mut allocation_samples = Vec::with_capacity(options.runs);
    #[cfg(feature = "count-allocations")]
    let mut shape_samples = Vec::with_capacity(options.runs);
    let mut stable: Option<ConsumeResult> = None;
    for _ in 0..options.runs {
        #[cfg(feature = "count-allocations")]
        if options.count_allocations {
            reset_allocation_stats();
            TRACK_ALLOCATIONS.store(true, Ordering::SeqCst);
        }
        let started_at = Instant::now();
        let result = consume(&options.file)?;
        let elapsed_ms = started_at.elapsed().as_secs_f64() * 1000.0;
        #[cfg(feature = "count-allocations")]
        if options.count_allocations {
            TRACK_ALLOCATIONS.store(false, Ordering::SeqCst);
            allocation_samples.push(snapshot_allocation_stats());
            shape_samples.push(result.shape_stats);
        }
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
    print!("]");
    #[cfg(feature = "count-allocations")]
    if options.count_allocations {
        print!(",\"allocationSamples\":[");
        for (index, sample) in allocation_samples.iter().enumerate() {
            if index > 0 {
                print!(",");
            }
            print_allocation_sample(sample);
        }
        print!("],\"allocationSummary\":");
        print_allocation_sample(&sum_allocation_samples(&allocation_samples));
        print!(",\"shapeSamples\":[");
        for (index, sample) in shape_samples.iter().enumerate() {
            if index > 0 {
                print!(",");
            }
            print_shape_sample(sample);
        }
        print!("],\"shapeSummary\":");
        print_shape_sample(&sum_shape_samples(&shape_samples));
    }
    println!("}}");

    Ok(())
}

fn parse_args() -> Result<Options, Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut file: Option<PathBuf> = None;
    let mut runs = 3usize;
    let mut warmups = 1usize;
    let mut count_allocations = false;
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
            "--count-allocations" => {
                count_allocations = true;
            }
            _ => return Err(format!("Unknown argument: {arg}").into()),
        }
        index += 1;
    }

    Ok(Options {
        file: file.ok_or("--file is required")?,
        runs,
        warmups,
        count_allocations,
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
    #[cfg(feature = "count-allocations")]
    let mut shape_stats = ShapeStats::default();

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
                #[cfg(feature = "count-allocations")]
                record_text_decode(&mut shape_stats, &text, false);
                checksum = fold_text_event(checksum, &text, 4, &mut event_count);
            }
            Event::CData(event) => {
                let text = event.decode()?;
                #[cfg(feature = "count-allocations")]
                record_text_decode(&mut shape_stats, &text, true);
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
        #[cfg(feature = "count-allocations")]
        shape_stats,
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

#[cfg(feature = "count-allocations")]
fn reset_allocation_stats() {
    ALLOC_COUNT.store(0, Ordering::SeqCst);
    ALLOC_BYTES.store(0, Ordering::SeqCst);
    DEALLOC_COUNT.store(0, Ordering::SeqCst);
    DEALLOC_BYTES.store(0, Ordering::SeqCst);
    REALLOC_COUNT.store(0, Ordering::SeqCst);
    REALLOC_BYTES_IN.store(0, Ordering::SeqCst);
    REALLOC_BYTES_OUT.store(0, Ordering::SeqCst);
}

#[cfg(feature = "count-allocations")]
fn snapshot_allocation_stats() -> AllocationStats {
    AllocationStats {
        alloc_count: ALLOC_COUNT.load(Ordering::SeqCst),
        alloc_bytes: ALLOC_BYTES.load(Ordering::SeqCst),
        dealloc_count: DEALLOC_COUNT.load(Ordering::SeqCst),
        dealloc_bytes: DEALLOC_BYTES.load(Ordering::SeqCst),
        realloc_count: REALLOC_COUNT.load(Ordering::SeqCst),
        realloc_bytes_in: REALLOC_BYTES_IN.load(Ordering::SeqCst),
        realloc_bytes_out: REALLOC_BYTES_OUT.load(Ordering::SeqCst),
    }
}

#[cfg(feature = "count-allocations")]
fn sum_allocation_samples(samples: &[AllocationStats]) -> AllocationStats {
    let mut total = AllocationStats {
        alloc_count: 0,
        alloc_bytes: 0,
        dealloc_count: 0,
        dealloc_bytes: 0,
        realloc_count: 0,
        realloc_bytes_in: 0,
        realloc_bytes_out: 0,
    };
    for sample in samples {
        total.alloc_count += sample.alloc_count;
        total.alloc_bytes += sample.alloc_bytes;
        total.dealloc_count += sample.dealloc_count;
        total.dealloc_bytes += sample.dealloc_bytes;
        total.realloc_count += sample.realloc_count;
        total.realloc_bytes_in += sample.realloc_bytes_in;
        total.realloc_bytes_out += sample.realloc_bytes_out;
    }
    total
}

#[cfg(feature = "count-allocations")]
fn print_allocation_sample(sample: &AllocationStats) {
    let total_allocated_bytes = sample.alloc_bytes + sample.realloc_bytes_out;
    let total_released_bytes = sample.dealloc_bytes + sample.realloc_bytes_in;
    let net_alloc_bytes = total_allocated_bytes as i128 - total_released_bytes as i128;
    print!(
        "{{\"allocCount\":{},\"allocBytes\":{},\"deallocCount\":{},\"deallocBytes\":{},\"reallocCount\":{},\"reallocBytesIn\":{},\"reallocBytesOut\":{},\"allocationOperations\":{},\"totalAllocatedBytes\":{},\"totalReleasedBytes\":{},\"netAllocatedBytes\":{}}}",
        sample.alloc_count,
        sample.alloc_bytes,
        sample.dealloc_count,
        sample.dealloc_bytes,
        sample.realloc_count,
        sample.realloc_bytes_in,
        sample.realloc_bytes_out,
        sample.alloc_count + sample.realloc_count,
        total_allocated_bytes,
        total_released_bytes,
        net_alloc_bytes
    );
}

#[cfg(feature = "count-allocations")]
fn record_text_decode(stats: &mut ShapeStats, text: &Cow<'_, str>, is_cdata: bool) {
    if is_cdata {
        stats.cdata_decode_count += 1;
        if text.trim().is_empty() {
            return;
        }
        stats.cdata_non_empty_count += 1;
        match text {
            Cow::Borrowed(_) => stats.cdata_borrowed_count += 1,
            Cow::Owned(_) => stats.cdata_owned_count += 1,
        }
        return;
    }

    stats.text_decode_count += 1;
    if text.trim().is_empty() {
        return;
    }
    stats.text_non_empty_count += 1;
    match text {
        Cow::Borrowed(_) => stats.text_borrowed_count += 1,
        Cow::Owned(_) => stats.text_owned_count += 1,
    }
}

#[cfg(feature = "count-allocations")]
fn sum_shape_samples(samples: &[ShapeStats]) -> ShapeStats {
    let mut total = ShapeStats::default();
    for sample in samples {
        total.text_decode_count += sample.text_decode_count;
        total.text_borrowed_count += sample.text_borrowed_count;
        total.text_owned_count += sample.text_owned_count;
        total.text_non_empty_count += sample.text_non_empty_count;
        total.cdata_decode_count += sample.cdata_decode_count;
        total.cdata_borrowed_count += sample.cdata_borrowed_count;
        total.cdata_owned_count += sample.cdata_owned_count;
        total.cdata_non_empty_count += sample.cdata_non_empty_count;
    }
    total
}

#[cfg(feature = "count-allocations")]
fn print_shape_sample(sample: &ShapeStats) {
    let total_decode_count = sample.text_decode_count + sample.cdata_decode_count;
    let total_borrowed_count = sample.text_borrowed_count + sample.cdata_borrowed_count;
    let total_owned_count = sample.text_owned_count + sample.cdata_owned_count;
    let total_non_empty_count = sample.text_non_empty_count + sample.cdata_non_empty_count;
    print!(
        "{{\"textDecodeCount\":{},\"textBorrowedCount\":{},\"textOwnedCount\":{},\"textNonEmptyCount\":{},\"cdataDecodeCount\":{},\"cdataBorrowedCount\":{},\"cdataOwnedCount\":{},\"cdataNonEmptyCount\":{},\"totalDecodeCount\":{},\"totalBorrowedCount\":{},\"totalOwnedCount\":{},\"totalNonEmptyCount\":{}}}",
        sample.text_decode_count,
        sample.text_borrowed_count,
        sample.text_owned_count,
        sample.text_non_empty_count,
        sample.cdata_decode_count,
        sample.cdata_borrowed_count,
        sample.cdata_owned_count,
        sample.cdata_non_empty_count,
        total_decode_count,
        total_borrowed_count,
        total_owned_count,
        total_non_empty_count
    );
}

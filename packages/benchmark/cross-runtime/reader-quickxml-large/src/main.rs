use quick_xml::events::Event;
use quick_xml::Reader;
use std::fs::File;
use std::io::BufReader;
use std::time::Instant;

const ROW_ELEMENT: &[u8] = b"row";
const COLUMNS: &[&str] = &[
    "id", "account_id", "email", "first_name", "last_name", "phone",
    "address", "city", "state", "zipcode", "country",
    "created_at", "updated_at", "balance", "is_active", "tier", "notes",
];

fn fold_str(mut seed: i32, value: &str) -> i32 {
    for byte in value.bytes() {
        seed = seed.wrapping_mul(31).wrapping_add(byte as i32);
    }
    seed
}

fn mix(seed: i32, value: i32) -> i32 {
    (seed ^ value).wrapping_mul(16777619)
}

fn column_index(name: &[u8]) -> Option<usize> {
    for (i, col) in COLUMNS.iter().enumerate() {
        if col.as_bytes() == name {
            return Some(i);
        }
    }
    None
}

#[derive(Default)]
struct Sample {
    rows: u64,
    events: u64,
    checksum: i32,
    seconds: f64,
    peak_rss_kb: u64,
}

#[cfg(unix)]
fn get_max_rss_kb() -> u64 {
    use std::mem::MaybeUninit;
    unsafe {
        let mut usage = MaybeUninit::<libc::rusage>::uninit();
        if libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) == 0 {
            let usage = usage.assume_init();
            let maxrss = usage.ru_maxrss as u64;
            // On Linux ru_maxrss is in KB; on macOS it is in bytes.
            #[cfg(target_os = "macos")]
            return maxrss / 1024;
            #[cfg(not(target_os = "macos"))]
            return maxrss;
        }
    }
    0
}

#[cfg(not(unix))]
fn get_max_rss_kb() -> u64 {
    0
}

fn consume(path: &str, buffer_size: usize) -> Sample {
    let start_rss = get_max_rss_kb();
    let started = Instant::now();

    let file = File::open(path).unwrap();
    let mut reader = Reader::from_reader(BufReader::with_capacity(buffer_size, file));
    reader.config_mut().trim_text(false);

    let mut sample = Sample::default();
    let mut in_row = false;
    let mut current_element: Vec<u8> = Vec::new();
    let mut row_values: Vec<String> = vec![String::new(); COLUMNS.len()];
    let mut buf = Vec::with_capacity(4096);

    loop {
        match reader.read_event_into(&mut buf).unwrap() {
            Event::Start(event) => {
                sample.events += 1;
                let name = event.name();
                let name_ref = name.as_ref();
                if name_ref == ROW_ELEMENT {
                    in_row = true;
                    for value in &mut row_values {
                        value.clear();
                    }
                } else if in_row {
                    current_element.clear();
                    current_element.extend_from_slice(name_ref);
                }
            }
            Event::End(event) => {
                sample.events += 1;
                let name = event.name();
                let name_ref = name.as_ref();
                if name_ref == ROW_ELEMENT && in_row {
                    let mut row_checksum: i32 = 0;
                    for (i, col) in COLUMNS.iter().enumerate() {
                        let value = &row_values[i];
                        row_checksum = mix(row_checksum, col.len() as i32);
                        row_checksum = fold_str(row_checksum, value);
                    }
                    sample.checksum = mix(sample.checksum, row_checksum);
                    sample.rows += 1;
                    in_row = false;
                } else if in_row {
                    current_element.clear();
                }
            }
            Event::Text(event) => {
                if in_row && !current_element.is_empty() {
                    if let Some(index) = column_index(&current_element) {
                        let text = String::from_utf8_lossy(event.as_ref());
                        row_values[index].push_str(&text);
                    }
                }
            }
            Event::CData(event) => {
                if in_row && !current_element.is_empty() {
                    if let Some(index) = column_index(&current_element) {
                        row_values[index].push_str(&String::from_utf8_lossy(event.as_ref()));
                    }
                }
            }
            Event::Eof => break,
            _ => {}
        }
        buf.clear();
    }

    sample.seconds = started.elapsed().as_secs_f64();
    sample.peak_rss_kb = get_max_rss_kb().saturating_sub(start_rss);
    sample
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let path = &args[1];
    let warmups: usize = args[2].parse().unwrap();
    let runs: usize = args[3].parse().unwrap();
    let buffer_size: usize = args
        .get(4)
        .map(|s| s.parse().unwrap())
        .unwrap_or(64 * 1024 * 1024);

    for i in 0..warmups {
        eprintln!("Warmup {}/{}", i + 1, warmups);
        let _ = consume(path, buffer_size);
    }

    let mut samples = Vec::new();
    for i in 0..runs {
        eprintln!("Run {}/{}", i + 1, runs);
        let sample = consume(path, buffer_size);
        samples.push(format!(
            "{{\"rows\":{},\"events\":{},\"checksum\":{},\"seconds\":{:.9},\"peakRssKiB\":{}}}",
            sample.rows, sample.events, sample.checksum, sample.seconds, sample.peak_rss_kb
        ));
    }

    println!("{{\"samples\":[{}]}}", samples.join(","));
}

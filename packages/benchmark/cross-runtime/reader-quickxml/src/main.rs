use quick_xml::events::Event;
use quick_xml::Reader;
use std::fs;
use std::time::Instant;

fn fold(mut seed: i32, value: &[u8]) -> i32 {
    for byte in value {
        seed = seed.wrapping_mul(31).wrapping_add(*byte as i32);
    }
    seed
}

fn mix(seed: i32, value: usize) -> i32 {
    (seed ^ value as i32).wrapping_mul(16777619)
}

fn flush_text(pending: &mut Vec<u8>, events: &mut u64, checksum: &mut i32) {
    let start = pending
        .iter()
        .position(|byte| !byte.is_ascii_whitespace())
        .unwrap_or(pending.len());
    let end = pending
        .iter()
        .rposition(|byte| !byte.is_ascii_whitespace())
        .map(|index| index + 1)
        .unwrap_or(start);
    if start < end {
        *events += 1;
        *checksum = fold(fold(*checksum, b"T"), &pending[start..end]);
    }
    pending.clear();
}

fn consume(bytes: &[u8]) -> (u64, i32) {
    let mut reader = Reader::from_reader(bytes);
    let mut events = 0;
    let mut checksum = 0;
    let mut pending_text = Vec::new();
    loop {
        match reader.read_event().unwrap() {
            Event::Start(event) => {
                flush_text(&mut pending_text, &mut events, &mut checksum);
                events += 1;
                checksum = fold(fold(checksum, b"S"), event.name().as_ref());
                let attributes: Vec<_> = event.attributes().map(|value| value.unwrap()).collect();
                checksum = mix(checksum, attributes.len());
                for attribute in attributes {
                    checksum = fold(checksum, attribute.key.as_ref());
                    checksum = fold(checksum, attribute.value.as_ref());
                }
            }
            Event::End(event) => {
                flush_text(&mut pending_text, &mut events, &mut checksum);
                events += 1;
                checksum = fold(fold(checksum, b"E"), event.name().as_ref());
            }
            Event::Text(event) => {
                pending_text.extend_from_slice(event.as_ref());
            }
            Event::CData(event) => pending_text.extend_from_slice(event.as_ref()),
            Event::Eof => break,
            _ => {}
        }
    }
    flush_text(&mut pending_text, &mut events, &mut checksum);
    (events, checksum)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let bytes = fs::read(&args[1]).unwrap();
    let warmups: usize = args[2].parse().unwrap();
    let runs: usize = args[3].parse().unwrap();
    for _ in 0..warmups {
        consume(&bytes);
    }
    let mut samples = Vec::new();
    for _ in 0..runs {
        let started = Instant::now();
        let (events, checksum) = consume(&bytes);
        samples.push(format!(
            "{{\"events\":{events},\"checksum\":{checksum},\"seconds\":{:.9}}}",
            started.elapsed().as_secs_f64()
        ));
    }
    println!("{{\"samples\":[{}]}}", samples.join(","));
}

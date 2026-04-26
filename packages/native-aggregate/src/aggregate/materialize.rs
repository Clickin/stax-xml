use super::*;

pub(crate) fn materialize_span(input: &[u8], start: usize, end: usize) -> Result<String> {
    std::str::from_utf8(&input[start..end])
        .map(|value| value.to_owned())
        .map_err(|error| Error::from_reason(error.to_string()))
}

pub(crate) fn parse_f64_js_prefix(input: &[u8], start: usize, end: usize) -> Result<f64> {
    parse_f64_js_prefix_bytes(&input[start..end])
}

pub(crate) fn parse_f64_js_prefix_bytes(input: &[u8]) -> Result<f64> {
    let value =
        std::str::from_utf8(input).map_err(|error| Error::from_reason(error.to_string()))?;
    let value = value.trim_start();
    let token_end = parse_float_prefix_end(value.as_bytes())
        .ok_or_else(|| Error::from_reason("Object rows projection number field was invalid"))?;
    value[..token_end]
        .parse::<f64>()
        .map_err(|error| Error::from_reason(error.to_string()))
}

pub(crate) fn parse_float_prefix_end(input: &[u8]) -> Option<usize> {
    if input.is_empty() {
        return None;
    }

    let mut index = 0;
    if matches!(input[index], b'+' | b'-') {
        index += 1;
    }
    if index >= input.len() {
        return None;
    }

    if input[index..].starts_with(b"Infinity") {
        return Some(index + b"Infinity".len());
    }

    let integer_start = index;
    while index < input.len() && input[index].is_ascii_digit() {
        index += 1;
    }
    let integer_digits = index - integer_start;

    let mut fraction_digits = 0;
    if index < input.len() && input[index] == b'.' {
        index += 1;
        let fraction_start = index;
        while index < input.len() && input[index].is_ascii_digit() {
            index += 1;
        }
        fraction_digits = index - fraction_start;
    }

    if integer_digits == 0 && fraction_digits == 0 {
        return None;
    }

    let mantissa_end = index;
    if index < input.len() && matches!(input[index], b'e' | b'E') {
        let exponent_marker = index;
        index += 1;
        if index < input.len() && matches!(input[index], b'+' | b'-') {
            index += 1;
        }
        let exponent_start = index;
        while index < input.len() && input[index].is_ascii_digit() {
            index += 1;
        }
        if index == exponent_start {
            return Some(exponent_marker);
        }
    }

    Some(index.max(mantissa_end))
}

pub(crate) fn materialize_units(input: &[u16], start: usize, end: usize) -> Result<String> {
    String::from_utf16(&input[start..end]).map_err(|error| Error::from_reason(error.to_string()))
}

pub(crate) fn fold_span(seed: i32, input: &[u8], start: usize, end: usize) -> Result<i32> {
    fold_utf8_bytes(seed, &input[start..end])
}

pub(crate) fn fold_span_js_benchmark_checksum(
    seed: i32,
    input: &[u8],
    start: usize,
    end: usize,
) -> Result<i32> {
    std::str::from_utf8(&input[start..end])
        .map(|value| fold_string_js_benchmark_checksum(seed, value))
        .map_err(|error| Error::from_reason(error.to_string()))
}

pub(crate) fn fold_string_js_benchmark_checksum(seed: i32, value: &str) -> i32 {
    let mut next = seed;
    for code_unit in value.encode_utf16() {
        next = mix_js_benchmark_checksum(next, code_unit as i32);
    }
    next
}

pub(crate) fn fold_trimmed_span(seed: i32, input: &[u8], start: usize, end: usize) -> Result<i32> {
    let (trimmed_start, trimmed_end) = trim_ascii_bytes(input, start, end);
    if trimmed_start == trimmed_end {
        return Ok(seed);
    }
    if input[trimmed_start] < 0x80 && input[trimmed_end - 1] < 0x80 {
        return fold_span(seed, input, trimmed_start, trimmed_end);
    }

    std::str::from_utf8(&input[start..end])
        .map(|value| fold_string(seed, value.trim()))
        .map_err(|error| Error::from_reason(error.to_string()))
}

pub(crate) fn fold_utf8_bytes(seed: i32, bytes: &[u8]) -> Result<i32> {
    let mut next = seed;
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte >= 0x80 {
            let value = std::str::from_utf8(&bytes[index..])
                .map_err(|error| Error::from_reason(error.to_string()))?;
            for code_unit in value.encode_utf16() {
                next = next.wrapping_mul(31).wrapping_add(code_unit as i32);
            }
            return Ok(next);
        }
        next = next.wrapping_mul(31).wrapping_add(byte as i32);
        index += 1;
    }
    Ok(next)
}

pub(crate) fn trim_ascii_bytes(input: &[u8], mut start: usize, mut end: usize) -> (usize, usize) {
    while start < end && is_js_trim_ascii_byte(input[start]) {
        start += 1;
    }
    while end > start && is_js_trim_ascii_byte(input[end - 1]) {
        end -= 1;
    }
    (start, end)
}

pub(crate) fn is_js_trim_ascii_byte(byte: u8) -> bool {
    matches!(byte, b'\t' | b'\n' | 0x0b | 0x0c | b'\r' | b' ')
}

pub(crate) fn fold_units(seed: i32, input: &[u16], start: usize, end: usize) -> i32 {
    let mut next = seed;
    for unit in input[start..end].iter().copied() {
        next = next.wrapping_mul(31).wrapping_add(unit as i32);
    }
    next
}

pub(crate) fn fold_trimmed_units(seed: i32, input: &[u16], start: usize, end: usize) -> i32 {
    let (start, end) = trim_units(input, start, end);
    fold_units(seed, input, start, end)
}

pub(crate) fn trim_units(input: &[u16], mut start: usize, mut end: usize) -> (usize, usize) {
    while start < end && is_js_trim_whitespace_u16(input[start]) {
        start += 1;
    }
    while end > start && is_js_trim_whitespace_u16(input[end - 1]) {
        end -= 1;
    }
    (start, end)
}

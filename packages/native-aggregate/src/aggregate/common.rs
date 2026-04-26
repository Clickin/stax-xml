use super::*;

pub(crate) fn to_i32_span(value: usize) -> Result<i32> {
    i32::try_from(value).map_err(|_| Error::from_reason("Span table offset exceeded i32 range"))
}

pub(crate) fn to_u32_count(value: usize, label: &str) -> Result<u32> {
    u32::try_from(value).map_err(|_| Error::from_reason(format!("{label} exceeded u32 range")))
}

pub(crate) fn push_u32(out: &mut Vec<u8>, value: u32) {
    out.extend_from_slice(&value.to_le_bytes());
}

pub(crate) fn push_i32(out: &mut Vec<u8>, value: i32) {
    out.extend_from_slice(&value.to_le_bytes());
}

pub(crate) fn write_u32_at(out: &mut [u8], offset: usize, value: u32) {
    out[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

pub(crate) fn mix_checksum(seed: i32, value: i32) -> i32 {
    (seed ^ value).wrapping_mul(16_777_619)
}

pub(crate) fn mix_js_benchmark_checksum(seed: i32, value: i32) -> i32 {
    js_to_int32(((seed ^ value) as f64) * 16_777_619.0)
}

pub(crate) fn js_to_int32(value: f64) -> i32 {
    if !value.is_finite() || value == 0.0 {
        return 0;
    }

    let two32 = 4_294_967_296.0;
    let two31 = 2_147_483_648.0;
    let mut int = value.signum() * value.abs().floor();
    int %= two32;
    if int < 0.0 {
        int += two32;
    }
    if int >= two31 {
        (int - two32) as i32
    } else {
        int as i32
    }
}

pub(crate) fn fold_string(seed: i32, value: &str) -> i32 {
    let mut next = seed;
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte >= 0x80 {
            for code_unit in value[index..].encode_utf16() {
                next = next.wrapping_mul(31).wrapping_add(code_unit as i32);
            }
            return next;
        }
        next = next.wrapping_mul(31).wrapping_add(byte as i32);
        index += 1;
    }
    next
}

#[cfg(test)]
pub(crate) fn fold_string_reference(seed: i32, value: &str) -> i32 {
    let mut next = seed;
    for code_unit in value.encode_utf16() {
        next = next.wrapping_mul(31).wrapping_add(code_unit as i32);
    }
    next
}

pub(crate) fn starts_with(input: &[u8], position: usize, value: &[u8]) -> bool {
    position + value.len() <= input.len() && &input[position..position + value.len()] == value
}

pub(crate) fn starts_with_ascii_u16(input: &[u16], position: usize, value: &[u8]) -> bool {
    if position + value.len() > input.len() {
        return false;
    }
    for (index, byte) in value.iter().copied().enumerate() {
        if input[position + index] != byte as u16 {
            return false;
        }
    }
    true
}

use super::*;

pub(crate) const U64_LOW_BITS: u64 = 0x0101_0101_0101_0101;
pub(crate) const U64_HIGH_BITS: u64 = 0x8080_8080_8080_8080;

pub(crate) fn repeated_byte(byte: u8) -> u64 {
    U64_LOW_BITS * byte as u64
}

pub(crate) fn zero_byte_high_bits(value: u64) -> u64 {
    value.wrapping_sub(U64_LOW_BITS) & !value & U64_HIGH_BITS
}

pub(crate) fn whitespace_byte_high_bits(word: u64) -> u64 {
    zero_byte_high_bits(word ^ repeated_byte(b' '))
        | zero_byte_high_bits(word ^ repeated_byte(b'\n'))
        | zero_byte_high_bits(word ^ repeated_byte(b'\r'))
        | zero_byte_high_bits(word ^ repeated_byte(b'\t'))
}

pub(crate) fn is_whitespace_word(word: u64) -> bool {
    whitespace_byte_high_bits(word) == U64_HIGH_BITS
}

pub(crate) fn load_u64_ne(input: &[u8], index: usize) -> u64 {
    let Some(bytes) = input.get(index..index + 8) else {
        return 0;
    };
    let mut chunk = [0u8; 8];
    chunk.copy_from_slice(bytes);
    u64::from_ne_bytes(chunk)
}

pub(crate) fn skip_whitespace(input: &[u8], index: usize) -> usize {
    skip_whitespace_until(input, index, input.len())
}

pub(crate) fn skip_whitespace_until(input: &[u8], mut index: usize, end: usize) -> usize {
    let end = end.min(input.len());
    if index >= end || !is_whitespace(input[index]) {
        return index;
    }
    while index + 8 <= end {
        if !is_whitespace_word(load_u64_ne(input, index)) {
            break;
        }
        index += 8;
    }
    while index < end && is_whitespace(input[index]) {
        index += 1;
    }
    index
}

pub(crate) fn has_non_whitespace(input: &[u8], start: usize, end: usize) -> bool {
    let mut index = start;
    while index + 8 <= end {
        if !is_whitespace_word(load_u64_ne(input, index)) {
            return true;
        }
        index += 8;
    }
    input[index..end].iter().any(|byte| !is_whitespace(*byte))
}

pub(crate) fn find_bytes(input: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if needle.is_empty() || from >= input.len() {
        return None;
    }
    let first = needle[0];
    let max = input.len().saturating_sub(needle.len());
    let mut index = from;
    while index <= max {
        let offset = memchr(first, &input[index..=max])?;
        index += offset;
        if &input[index..index + needle.len()] == needle {
            return Some(index);
        }
        index += 1;
    }
    None
}

pub(crate) fn find_ascii_sequence_u16(input: &[u16], needle: &[u8], from: usize) -> Option<usize> {
    if needle.is_empty() || from >= input.len() {
        return None;
    }
    let max = input.len().saturating_sub(needle.len());
    let mut index = from;
    while index <= max {
        let next = find_unit(input, needle[0] as u16, index, max + 1)?;
        index = next;
        if starts_with_ascii_u16(input, index, needle) {
            return Some(index);
        }
        index += 1;
    }
    None
}

pub(crate) fn find_unit(input: &[u16], needle: u16, from: usize, until: usize) -> Option<usize> {
    let mut index = from;
    let until = until.min(input.len());
    while index < until {
        if input[index] == needle {
            return Some(index);
        }
        index += 1;
    }
    None
}

pub(crate) fn find_gt(input: &[u8], from: usize) -> Option<usize> {
    memchr(b'>', &input[from..]).map(|offset| from + offset)
}

pub(crate) fn find_gt_utf16(input: &[u16], from: usize) -> Option<usize> {
    find_unit(input, b'>' as u16, from, input.len())
}

pub(crate) fn find_doctype_end(input: &[u8], from: usize) -> Option<usize> {
    let mut quote = 0;
    let mut in_subset = false;
    for (offset, byte) in input[from..].iter().copied().enumerate() {
        if quote != 0 {
            if byte == quote {
                quote = 0;
            }
            continue;
        }
        match byte {
            b'"' | b'\'' => quote = byte,
            b'[' => in_subset = true,
            b']' => in_subset = false,
            b'>' if !in_subset => return Some(from + offset),
            _ => {}
        }
    }
    None
}

pub(crate) fn find_doctype_end_utf16(input: &[u16], from: usize) -> Option<usize> {
    let mut quote = 0;
    let mut in_subset = false;
    for (offset, unit) in input[from..].iter().copied().enumerate() {
        if quote != 0 {
            if unit == quote {
                quote = 0;
            }
            continue;
        }
        match unit {
            value if value == b'"' as u16 || value == b'\'' as u16 => quote = unit,
            value if value == b'[' as u16 => in_subset = true,
            value if value == b']' as u16 => in_subset = false,
            value if value == b'>' as u16 && !in_subset => return Some(from + offset),
            _ => {}
        }
    }
    None
}

pub(crate) fn find_tag_end_byte_loop(input: &[u8], from: usize) -> Option<usize> {
    let mut quote = 0;
    for (offset, byte) in input[from..].iter().copied().enumerate() {
        if byte == b'"' || byte == b'\'' {
            if quote == 0 {
                quote = byte;
            } else if quote == byte {
                quote = 0;
            }
            continue;
        }
        if byte == b'>' && quote == 0 {
            return Some(from + offset);
        }
    }
    None
}

pub(crate) fn find_tag_end_skip_quotes(input: &[u8], from: usize) -> Option<usize> {
    let mut index = from;
    while index < input.len() {
        match input[index] {
            b'>' => return Some(index),
            b'"' | b'\'' => {
                let quote = input[index];
                index += 1;
                let close = memchr(quote, &input[index..])?;
                index += close + 1;
            }
            _ => index += 1,
        }
    }
    None
}

pub(crate) fn find_tag_end(input: &[u8], from: usize) -> Option<usize> {
    find_tag_end_skip_quotes(input, from)
}

pub(crate) fn find_tag_end_utf16(input: &[u16], from: usize) -> Option<usize> {
    let mut quote = 0;
    for (offset, unit) in input[from..].iter().copied().enumerate() {
        if unit == b'"' as u16 || unit == b'\'' as u16 {
            if quote == 0 {
                quote = unit;
            } else if quote == unit {
                quote = 0;
            }
            continue;
        }
        if unit == b'>' as u16 && quote == 0 {
            return Some(from + offset);
        }
    }
    None
}

pub(crate) fn is_whitespace(byte: u8) -> bool {
    matches!(byte, b' ' | b'\t' | b'\n' | b'\r')
}

pub(crate) fn is_whitespace_u16(unit: u16) -> bool {
    matches!(unit, 0x20 | 0x09 | 0x0a | 0x0d)
}

pub(crate) fn is_js_trim_whitespace_u16(unit: u16) -> bool {
    matches!(
        unit,
        0x0009 | 0x000a | 0x000b | 0x000c | 0x000d | 0x0020 | 0x00a0 | 0x1680 | 0x2000
            ..=0x200a | 0x2028 | 0x2029 | 0x202f | 0x205f | 0x3000 | 0xfeff
    )
}

pub(crate) fn is_whitespace_only(input: &[u8], start: usize, end: usize) -> bool {
    !has_non_whitespace(input, start, end)
}

pub(crate) fn is_whitespace_only_u16(input: &[u16], start: usize, end: usize) -> bool {
    input[start..end]
        .iter()
        .all(|unit| is_whitespace_u16(*unit))
}

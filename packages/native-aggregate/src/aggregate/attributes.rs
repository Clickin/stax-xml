use super::*;

impl Drop for NativeEventObject {
    fn drop(&mut self) {
        let _ = self.event_type;
        let _ = self.name.as_deref();
        let _ = self.text.as_deref();
        let _ = self.attributes.len();
    }
}

pub(crate) fn parse_attributes(input: &[u8], start: usize, end: usize) -> AttrSpans {
    let mut attrs = AttrSpans::new();
    let _ = scan_attribute_spans(input, start, end, |attr| {
        attrs.push(attr);
        Ok(())
    });
    attrs
}

pub(crate) fn count_attributes(input: &[u8], start: usize, end: usize) -> usize {
    let mut count = 0usize;
    let mut index = start;
    while index < end {
        index = skip_whitespace_until(input, index, end);
        if index >= end {
            break;
        }

        while index < end && input[index] != b'=' && !is_whitespace(input[index]) {
            index += 1;
        }

        index = skip_whitespace_until(input, index, end);
        if index >= end || input[index] != b'=' {
            count = count.wrapping_add(1);
            continue;
        }

        index += 1;
        index = skip_whitespace_until(input, index, end);
        if index >= end {
            break;
        }

        let quote = input[index];
        if quote != b'"' && quote != b'\'' {
            break;
        }
        index += 1;
        let Some(value_offset) = memchr(quote, &input[index..end]) else {
            break;
        };
        count = count.wrapping_add(1);
        index += value_offset + 1;
    }
    count
}

pub(crate) fn scan_attribute_spans<F>(
    input: &[u8],
    start: usize,
    end: usize,
    mut visit: F,
) -> Result<()>
where
    F: FnMut(AttrSpan) -> Result<()>,
{
    let mut index = start;
    while index < end {
        index = skip_whitespace_until(input, index, end);
        if index >= end {
            break;
        }

        let name_start = index;
        while index < end && input[index] != b'=' && !is_whitespace(input[index]) {
            index += 1;
        }
        let name_end = index;

        index = skip_whitespace_until(input, index, end);
        if index >= end || input[index] != b'=' {
            visit(AttrSpan {
                name_start,
                name_end,
                value_start: name_start,
                value_end: name_end,
            })?;
            continue;
        }

        index += 1;
        index = skip_whitespace_until(input, index, end);
        if index >= end {
            break;
        }

        let quote = input[index];
        if quote != b'"' && quote != b'\'' {
            break;
        }
        index += 1;
        let value_start = index;
        let Some(value_offset) = memchr(quote, &input[index..end]) else {
            break;
        };
        let value_end = index + value_offset;
        visit(AttrSpan {
            name_start,
            name_end,
            value_start,
            value_end,
        })?;
        index = value_end + 1;
    }
    Ok(())
}

pub(crate) fn read_projection_id(input: &[u8], start: usize, end: usize) -> i32 {
    let attrs = parse_attributes(input, start, end);
    for attr in attrs.iter() {
        if span_eq(input, attr.name_start, attr.name_end, b"id") {
            return parse_i32_ascii(input, attr.value_start, attr.value_end).unwrap_or(0);
        }
    }
    0
}

pub(crate) fn parse_i32_ascii(input: &[u8], start: usize, end: usize) -> Option<i32> {
    if start >= end {
        return None;
    }
    let mut index = start;
    let mut sign = 1i32;
    if input[index] == b'-' {
        sign = -1;
        index += 1;
    }
    if index >= end {
        return None;
    }
    let mut value = 0i32;
    while index < end {
        let byte = input[index];
        if !byte.is_ascii_digit() {
            return None;
        }
        value = value.checked_mul(10)?.checked_add((byte - b'0') as i32)?;
        index += 1;
    }
    Some(value.wrapping_mul(sign))
}

pub(crate) fn span_eq(input: &[u8], start: usize, end: usize, expected: &[u8]) -> bool {
    end >= start && end - start == expected.len() && &input[start..end] == expected
}

pub(crate) fn parse_attributes_utf16(input: &[u16], start: usize, end: usize) -> AttrSpans {
    let mut attrs = AttrSpans::new();
    let mut index = start;
    while index < end {
        while index < end && is_whitespace_u16(input[index]) {
            index += 1;
        }
        if index >= end {
            break;
        }

        let name_start = index;
        while index < end && input[index] != b'=' as u16 && !is_whitespace_u16(input[index]) {
            index += 1;
        }
        let name_end = index;

        while index < end && is_whitespace_u16(input[index]) {
            index += 1;
        }
        if index >= end || input[index] != b'=' as u16 {
            attrs.push(AttrSpan {
                name_start,
                name_end,
                value_start: name_start,
                value_end: name_end,
            });
            continue;
        }

        index += 1;
        while index < end && is_whitespace_u16(input[index]) {
            index += 1;
        }
        if index >= end {
            break;
        }

        let quote = input[index];
        if quote != b'"' as u16 && quote != b'\'' as u16 {
            break;
        }
        index += 1;
        let value_start = index;
        let Some(value_end) = find_unit(input, quote, index, end) else {
            break;
        };
        attrs.push(AttrSpan {
            name_start,
            name_end,
            value_start,
            value_end,
        });
        index = value_end + 1;
    }
    attrs
}

pub(crate) fn count_attributes_utf16(input: &[u16], start: usize, end: usize) -> usize {
    let mut count = 0usize;
    let mut index = start;
    while index < end {
        while index < end && is_whitespace_u16(input[index]) {
            index += 1;
        }
        if index >= end {
            break;
        }

        while index < end && input[index] != b'=' as u16 && !is_whitespace_u16(input[index]) {
            index += 1;
        }

        while index < end && is_whitespace_u16(input[index]) {
            index += 1;
        }
        if index >= end || input[index] != b'=' as u16 {
            count = count.wrapping_add(1);
            continue;
        }

        index += 1;
        while index < end && is_whitespace_u16(input[index]) {
            index += 1;
        }
        if index >= end {
            break;
        }

        let quote = input[index];
        if quote != b'"' as u16 && quote != b'\'' as u16 {
            break;
        }
        index += 1;
        let Some(value_end) = find_unit(input, quote, index, end) else {
            break;
        };
        count = count.wrapping_add(1);
        index = value_end + 1;
    }
    count
}

impl AttrSpans {
    fn new() -> Self {
        Self {
            len: 0,
            inline: [const { MaybeUninit::uninit() }; INLINE_ATTR_SPANS],
            overflow: Vec::new(),
        }
    }

    fn push(&mut self, span: AttrSpan) {
        if self.len < INLINE_ATTR_SPANS {
            self.inline[self.len].write(span);
        } else {
            self.overflow.push(span);
        }
        self.len += 1;
    }

    pub(crate) fn len(&self) -> usize {
        self.len
    }

    pub(crate) fn iter(&self) -> AttrSpanIter<'_> {
        AttrSpanIter {
            spans: self,
            index: 0,
        }
    }

    #[cfg(test)]
    pub(crate) fn overflow_len_for_test(&self) -> usize {
        self.overflow.len()
    }

    #[cfg(test)]
    pub(crate) fn to_vec_for_test(&self) -> Vec<AttrSpan> {
        self.iter().collect()
    }
}

impl Iterator for AttrSpanIter<'_> {
    type Item = AttrSpan;

    fn next(&mut self) -> Option<Self::Item> {
        if self.index >= self.spans.len {
            return None;
        }

        let span = if self.index < INLINE_ATTR_SPANS {
            unsafe { self.spans.inline[self.index].assume_init() }
        } else {
            self.spans.overflow[self.index - INLINE_ATTR_SPANS]
        };
        self.index += 1;
        Some(span)
    }
}

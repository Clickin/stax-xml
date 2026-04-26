use super::*;

pub(crate) fn parse_span_table_utf16(input: &[u16]) -> Result<Vec<u8>> {
    let mut parser = SpanTableUtf16Parser {
        input,
        table: SpanTableBuilder::new(input.len(), 0)?,
        element_stack: Vec::new(),
    };
    parser.parse()?;
    parser.table.finish()
}

pub(crate) fn parse_span_table(input: &[u8]) -> Result<Vec<u8>> {
    let mut parser = SpanTableParser {
        input,
        table: SpanTableBuilder::new(input.len(), 1)?,
        element_stack: Vec::new(),
    };
    parser.parse()?;
    parser.table.finish()
}

impl<'a> SpanTableParser<'a> {
    fn parse(&mut self) -> Result<()> {
        self.emit_event(START_DOCUMENT, None, None, None)?;

        let mut position = 0;
        while position < self.input.len() {
            let Some(lt_offset) = memchr(b'<', &self.input[position..]) else {
                self.emit_text(position, self.input.len(), CHARACTERS)?;
                break;
            };
            let lt = position + lt_offset;
            self.emit_text(position, lt, CHARACTERS)?;
            position = self.parse_markup(lt)?;
        }

        if !self.element_stack.is_empty() {
            return Err(Error::from_reason(
                "Unexpected end of document. Not all elements were closed.",
            ));
        }

        self.emit_event(END_DOCUMENT, None, None, None)?;
        Ok(())
    }

    fn parse_markup(&mut self, position: usize) -> Result<usize> {
        if position + 1 >= self.input.len() {
            return Err(Error::from_reason("Unclosed start tag"));
        }

        match self.input[position + 1] {
            b'/' => self.parse_end_tag(position),
            b'!' => self.parse_bang(position),
            b'?' => self.parse_processing_instruction(position),
            _ => self.parse_start_tag(position),
        }
    }

    fn parse_bang(&mut self, position: usize) -> Result<usize> {
        if starts_with(self.input, position, b"<![CDATA[") {
            let Some(end) = find_bytes(self.input, b"]]>", position + 9) else {
                return Err(Error::from_reason("Unclosed CDATA section"));
            };
            self.emit_text(position + 9, end, CDATA)?;
            return Ok(end + 3);
        }

        if starts_with(self.input, position, b"<!--") {
            let Some(end) = find_bytes(self.input, b"-->", position + 4) else {
                return Err(Error::from_reason("Unclosed comment"));
            };
            return Ok(end + 3);
        }

        if starts_with(self.input, position, b"<!DOCTYPE") {
            let Some(end) = find_doctype_end(self.input, position + 2) else {
                return Err(Error::from_reason("Unclosed DOCTYPE declaration"));
            };
            return Ok(end + 1);
        }

        let Some(end) = find_gt(self.input, position + 2) else {
            return Err(Error::from_reason("Unclosed markup"));
        };
        Ok(end + 1)
    }

    fn parse_processing_instruction(&self, position: usize) -> Result<usize> {
        let Some(end) = find_bytes(self.input, b"?>", position + 2) else {
            return Err(Error::from_reason(
                if starts_with(self.input, position, b"<?xml") {
                    "Unclosed XML declaration"
                } else {
                    "Unclosed processing instruction"
                },
            ));
        };
        Ok(end + 2)
    }

    fn parse_end_tag(&mut self, position: usize) -> Result<usize> {
        let Some(end) = find_gt(self.input, position + 2) else {
            return Err(Error::from_reason("Unclosed end tag"));
        };

        let mut name_start = position + 2;
        let mut name_end = end;
        while name_start < name_end && is_whitespace(self.input[name_start]) {
            name_start += 1;
        }
        while name_end > name_start && is_whitespace(self.input[name_end - 1]) {
            name_end -= 1;
        }

        let Some((start, stop)) = self.element_stack.pop() else {
            return Err(Error::from_reason("Unexpected closing tag"));
        };
        if self.input[start..stop] != self.input[name_start..name_end] {
            return Err(Error::from_reason("Mismatched closing tag"));
        }

        self.emit_event(END_ELEMENT, Some((name_start, name_end)), None, None)?;
        Ok(end + 1)
    }

    fn parse_start_tag(&mut self, position: usize) -> Result<usize> {
        let Some(tag_end) = find_tag_end(self.input, position + 1) else {
            return Err(Error::from_reason("Unclosed start tag"));
        };

        let mut actual_end = tag_end;
        while actual_end > position + 1 && is_whitespace(self.input[actual_end - 1]) {
            actual_end -= 1;
        }

        let mut self_closing = false;
        if actual_end > position + 1 && self.input[actual_end - 1] == b'/' {
            self_closing = true;
            actual_end -= 1;
            while actual_end > position + 1 && is_whitespace(self.input[actual_end - 1]) {
                actual_end -= 1;
            }
        }

        let name_start = position + 1;
        let mut name_end = name_start;
        while name_end < actual_end {
            let byte = self.input[name_end];
            if is_whitespace(byte) || byte == b'/' {
                break;
            }
            name_end += 1;
        }

        let attrs =
            (name_end < actual_end).then(|| parse_attributes(self.input, name_end, actual_end));
        self.emit_event(
            START_ELEMENT,
            Some((name_start, name_end)),
            None,
            attrs.as_ref(),
        )?;

        if self_closing {
            self.emit_event(END_ELEMENT, Some((name_start, name_end)), None, None)?;
        } else {
            self.element_stack.push((name_start, name_end));
        }

        Ok(tag_end + 1)
    }

    fn emit_text(&mut self, start: usize, end: usize, event_type: u8) -> Result<()> {
        if start < end && !is_whitespace_only(self.input, start, end) {
            self.emit_event(event_type, None, Some((start, end)), None)?;
        }
        Ok(())
    }

    fn emit_event(
        &mut self,
        event_type: u8,
        name: Option<(usize, usize)>,
        text: Option<(usize, usize)>,
        attrs: Option<&AttrSpans>,
    ) -> Result<()> {
        let attr_start = self.table.attr_count();
        let attr_count = attrs.map_or(0, AttrSpans::len);
        let attr_count = to_u32_count(attr_count, "span table attr count")?;
        let (name_start, name_end) = encode_optional_span(name)?;
        let (text_start, text_end) = encode_optional_span(text)?;

        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
                self.table.push_attr(SpanAttrRecord {
                    name_start: to_i32_span(attr.name_start)?,
                    name_end: to_i32_span(attr.name_end)?,
                    value_start: to_i32_span(attr.value_start)?,
                    value_end: to_i32_span(attr.value_end)?,
                })?;
            }
        }

        self.table.push_event(SpanEventRecord {
            event_type: event_type as u32,
            name_start,
            name_end,
            text_start,
            text_end,
            attr_start,
            attr_count,
        })
    }
}

impl<'a> SpanTableUtf16Parser<'a> {
    fn parse(&mut self) -> Result<()> {
        self.emit_event(START_DOCUMENT, None, None, None)?;

        let mut position = 0;
        while position < self.input.len() {
            let Some(lt) = find_unit(self.input, b'<' as u16, position, self.input.len()) else {
                self.emit_text(position, self.input.len(), CHARACTERS)?;
                break;
            };
            self.emit_text(position, lt, CHARACTERS)?;
            position = self.parse_markup(lt)?;
        }

        if !self.element_stack.is_empty() {
            return Err(Error::from_reason(
                "Unexpected end of document. Not all elements were closed.",
            ));
        }

        self.emit_event(END_DOCUMENT, None, None, None)?;
        Ok(())
    }

    fn parse_markup(&mut self, position: usize) -> Result<usize> {
        if position + 1 >= self.input.len() {
            return Err(Error::from_reason("Unclosed start tag"));
        }

        match self.input[position + 1] {
            value if value == b'/' as u16 => self.parse_end_tag(position),
            value if value == b'!' as u16 => self.parse_bang(position),
            value if value == b'?' as u16 => self.parse_processing_instruction(position),
            _ => self.parse_start_tag(position),
        }
    }

    fn parse_bang(&mut self, position: usize) -> Result<usize> {
        if starts_with_ascii_u16(self.input, position, b"<![CDATA[") {
            let Some(end) = find_ascii_sequence_u16(self.input, b"]]>", position + 9) else {
                return Err(Error::from_reason("Unclosed CDATA section"));
            };
            self.emit_text(position + 9, end, CDATA)?;
            return Ok(end + 3);
        }

        if starts_with_ascii_u16(self.input, position, b"<!--") {
            let Some(end) = find_ascii_sequence_u16(self.input, b"-->", position + 4) else {
                return Err(Error::from_reason("Unclosed comment"));
            };
            return Ok(end + 3);
        }

        if starts_with_ascii_u16(self.input, position, b"<!DOCTYPE") {
            let Some(end) = find_doctype_end_utf16(self.input, position + 2) else {
                return Err(Error::from_reason("Unclosed DOCTYPE declaration"));
            };
            return Ok(end + 1);
        }

        let Some(end) = find_gt_utf16(self.input, position + 2) else {
            return Err(Error::from_reason("Unclosed markup"));
        };
        Ok(end + 1)
    }

    fn parse_processing_instruction(&self, position: usize) -> Result<usize> {
        let Some(end) = find_ascii_sequence_u16(self.input, b"?>", position + 2) else {
            return Err(Error::from_reason(
                if starts_with_ascii_u16(self.input, position, b"<?xml") {
                    "Unclosed XML declaration"
                } else {
                    "Unclosed processing instruction"
                },
            ));
        };
        Ok(end + 2)
    }

    fn parse_end_tag(&mut self, position: usize) -> Result<usize> {
        let Some(end) = find_gt_utf16(self.input, position + 2) else {
            return Err(Error::from_reason("Unclosed end tag"));
        };

        let mut name_start = position + 2;
        let mut name_end = end;
        while name_start < name_end && is_whitespace_u16(self.input[name_start]) {
            name_start += 1;
        }
        while name_end > name_start && is_whitespace_u16(self.input[name_end - 1]) {
            name_end -= 1;
        }

        let Some((start, stop)) = self.element_stack.pop() else {
            return Err(Error::from_reason("Unexpected closing tag"));
        };
        if self.input[start..stop] != self.input[name_start..name_end] {
            return Err(Error::from_reason("Mismatched closing tag"));
        }

        self.emit_event(END_ELEMENT, Some((name_start, name_end)), None, None)?;
        Ok(end + 1)
    }

    fn parse_start_tag(&mut self, position: usize) -> Result<usize> {
        let Some(tag_end) = find_tag_end_utf16(self.input, position + 1) else {
            return Err(Error::from_reason("Unclosed start tag"));
        };

        let mut actual_end = tag_end;
        while actual_end > position + 1 && is_whitespace_u16(self.input[actual_end - 1]) {
            actual_end -= 1;
        }

        let mut self_closing = false;
        if actual_end > position + 1 && self.input[actual_end - 1] == b'/' as u16 {
            self_closing = true;
            actual_end -= 1;
            while actual_end > position + 1 && is_whitespace_u16(self.input[actual_end - 1]) {
                actual_end -= 1;
            }
        }

        let name_start = position + 1;
        let mut name_end = name_start;
        while name_end < actual_end {
            let unit = self.input[name_end];
            if is_whitespace_u16(unit) || unit == b'/' as u16 {
                break;
            }
            name_end += 1;
        }

        let attrs = (name_end < actual_end)
            .then(|| parse_attributes_utf16(self.input, name_end, actual_end));
        self.emit_event(
            START_ELEMENT,
            Some((name_start, name_end)),
            None,
            attrs.as_ref(),
        )?;

        if self_closing {
            self.emit_event(END_ELEMENT, Some((name_start, name_end)), None, None)?;
        } else {
            self.element_stack.push((name_start, name_end));
        }

        Ok(tag_end + 1)
    }

    fn emit_text(&mut self, start: usize, end: usize, event_type: u8) -> Result<()> {
        if start < end && !is_whitespace_only_u16(self.input, start, end) {
            self.emit_event(event_type, None, Some((start, end)), None)?;
        }
        Ok(())
    }

    fn emit_event(
        &mut self,
        event_type: u8,
        name: Option<(usize, usize)>,
        text: Option<(usize, usize)>,
        attrs: Option<&AttrSpans>,
    ) -> Result<()> {
        let attr_start = self.table.attr_count();
        let attr_count = attrs.map_or(0, AttrSpans::len);
        let attr_count = to_u32_count(attr_count, "span table attr count")?;
        let (name_start, name_end) = encode_optional_span(name)?;
        let (text_start, text_end) = encode_optional_span(text)?;

        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
                self.table.push_attr(SpanAttrRecord {
                    name_start: to_i32_span(attr.name_start)?,
                    name_end: to_i32_span(attr.name_end)?,
                    value_start: to_i32_span(attr.value_start)?,
                    value_end: to_i32_span(attr.value_end)?,
                })?;
            }
        }

        self.table.push_event(SpanEventRecord {
            event_type: event_type as u32,
            name_start,
            name_end,
            text_start,
            text_end,
            attr_start,
            attr_count,
        })
    }
}

impl SpanTableBuilder {
    fn new(input_units: usize, flags: u32) -> Result<Self> {
        let input_units = to_u32_count(input_units, "span table input units")?;
        let table = vec![0; SPAN_TABLE_HEADER_BYTES];
        Ok(Self {
            input_units,
            flags,
            table,
            attrs: Vec::new(),
            event_count: 0,
            attr_count: 0,
        })
    }

    fn attr_count(&self) -> u32 {
        self.attr_count
    }

    fn push_event(&mut self, event: SpanEventRecord) -> Result<()> {
        self.event_count = self
            .event_count
            .checked_add(1)
            .ok_or_else(|| Error::from_reason("Span table event count overflow"))?;
        push_u32(&mut self.table, event.event_type);
        push_i32(&mut self.table, event.name_start);
        push_i32(&mut self.table, event.name_end);
        push_i32(&mut self.table, event.text_start);
        push_i32(&mut self.table, event.text_end);
        push_u32(&mut self.table, event.attr_start);
        push_u32(&mut self.table, event.attr_count);
        Ok(())
    }

    fn push_attr(&mut self, attr: SpanAttrRecord) -> Result<()> {
        self.attr_count = self
            .attr_count
            .checked_add(1)
            .ok_or_else(|| Error::from_reason("Span table attr count overflow"))?;
        push_i32(&mut self.attrs, attr.name_start);
        push_i32(&mut self.attrs, attr.name_end);
        push_i32(&mut self.attrs, attr.value_start);
        push_i32(&mut self.attrs, attr.value_end);
        Ok(())
    }

    fn finish(mut self) -> Result<Vec<u8>> {
        let event_bytes = (self.event_count as usize)
            .checked_mul(SPAN_TABLE_EVENT_BYTES)
            .ok_or_else(|| Error::from_reason("Span table event byte size overflow"))?;
        let attr_bytes = (self.attr_count as usize)
            .checked_mul(SPAN_TABLE_ATTR_BYTES)
            .ok_or_else(|| Error::from_reason("Span table attr byte size overflow"))?;
        let total_bytes = SPAN_TABLE_HEADER_BYTES
            .checked_add(event_bytes)
            .and_then(|value| value.checked_add(attr_bytes))
            .ok_or_else(|| Error::from_reason("Span table byte size overflow"))?;

        debug_assert_eq!(self.table.len(), SPAN_TABLE_HEADER_BYTES + event_bytes);
        debug_assert_eq!(self.attrs.len(), attr_bytes);

        write_u32_at(&mut self.table, 0, SPAN_TABLE_MAGIC);
        write_u32_at(&mut self.table, 4, self.event_count);
        write_u32_at(&mut self.table, 8, self.attr_count);
        write_u32_at(&mut self.table, 12, self.input_units);
        write_u32_at(&mut self.table, 16, SPAN_TABLE_EVENT_BYTES as u32);
        write_u32_at(&mut self.table, 20, SPAN_TABLE_ATTR_BYTES as u32);
        write_u32_at(&mut self.table, 24, self.flags);

        self.table
            .try_reserve_exact(attr_bytes)
            .map_err(|error| Error::from_reason(error.to_string()))?;
        self.table.extend_from_slice(&self.attrs);
        debug_assert_eq!(self.table.len(), total_bytes);
        Ok(self.table)
    }
}

pub(crate) fn parse_span_table_bytes(table: &[u8]) -> Result<ParsedSpanTable<'_>> {
    if table.len() < SPAN_TABLE_HEADER_BYTES {
        return Err(Error::from_reason(
            "Structural index table is shorter than the header",
        ));
    }
    let magic = read_u32_le(table, 0)?;
    if magic != SPAN_TABLE_MAGIC {
        return Err(Error::from_reason("Invalid structural index magic"));
    }

    let event_count = read_u32_le(table, 4)?;
    let attr_count = read_u32_le(table, 8)?;
    let input_units = read_u32_le(table, 12)?;
    let event_stride = read_u32_le(table, 16)?;
    let attr_stride = read_u32_le(table, 20)?;
    let flags = read_u32_le(table, 24)?;
    if event_stride != SPAN_TABLE_EVENT_BYTES as u32 || attr_stride != SPAN_TABLE_ATTR_BYTES as u32
    {
        return Err(Error::from_reason(
            "Unsupported structural index table strides",
        ));
    }

    let event_bytes = (event_count as usize)
        .checked_mul(SPAN_TABLE_EVENT_BYTES)
        .ok_or_else(|| Error::from_reason("Structural index event byte size overflow"))?;
    let attr_bytes = (attr_count as usize)
        .checked_mul(SPAN_TABLE_ATTR_BYTES)
        .ok_or_else(|| Error::from_reason("Structural index attr byte size overflow"))?;
    let attr_base = SPAN_TABLE_HEADER_BYTES
        .checked_add(event_bytes)
        .ok_or_else(|| Error::from_reason("Structural index event region overflow"))?;
    let expected_bytes = attr_base
        .checked_add(attr_bytes)
        .ok_or_else(|| Error::from_reason("Structural index byte size overflow"))?;
    if table.len() != expected_bytes {
        return Err(Error::from_reason("Structural index table length mismatch"));
    }

    Ok(ParsedSpanTable {
        events: &table[SPAN_TABLE_HEADER_BYTES..attr_base],
        attrs: &table[attr_base..],
        event_count,
        attr_count,
        input_units,
        flags,
    })
}

pub(crate) fn read_table_event(
    table: &ParsedSpanTable<'_>,
    index: usize,
) -> Result<TableEventRecord> {
    if index >= table.event_count as usize {
        return Err(Error::from_reason(
            "Structural index event index out of range",
        ));
    }
    let offset = index * SPAN_TABLE_EVENT_BYTES;
    Ok(TableEventRecord {
        event_type: read_u32_le(table.events, offset)?,
        name_start: read_i32_le(table.events, offset + 4)?,
        name_end: read_i32_le(table.events, offset + 8)?,
        text_start: read_i32_le(table.events, offset + 12)?,
        text_end: read_i32_le(table.events, offset + 16)?,
        attr_start: read_u32_le(table.events, offset + 20)?,
        attr_count: read_u32_le(table.events, offset + 24)?,
    })
}

pub(crate) fn read_table_attr(
    table: &ParsedSpanTable<'_>,
    index: usize,
) -> Result<TableAttrRecord> {
    if index >= table.attr_count as usize {
        return Err(Error::from_reason(
            "Structural index attr index out of range",
        ));
    }
    let offset = index * SPAN_TABLE_ATTR_BYTES;
    Ok(TableAttrRecord {
        name_start: read_i32_le(table.attrs, offset)?,
        name_end: read_i32_le(table.attrs, offset + 4)?,
        value_start: read_i32_le(table.attrs, offset + 8)?,
        value_end: read_i32_le(table.attrs, offset + 12)?,
    })
}

impl TableEventRecord {
    pub(crate) fn name_range(self) -> Result<Option<(usize, usize)>> {
        decode_table_range(self.name_start, self.name_end)
    }

    pub(crate) fn text_range(self) -> Result<Option<(usize, usize)>> {
        decode_table_range(self.text_start, self.text_end)
    }
}

impl TableAttrRecord {
    pub(crate) fn name_range(self) -> Result<Option<(usize, usize)>> {
        decode_table_range(self.name_start, self.name_end)
    }

    pub(crate) fn value_range(self) -> Result<Option<(usize, usize)>> {
        decode_table_range(self.value_start, self.value_end)
    }
}

pub(crate) fn decode_table_range(start: i32, end: i32) -> Result<Option<(usize, usize)>> {
    if start < 0 || end < 0 {
        return Ok(None);
    }
    let start = usize::try_from(start).map_err(|_| Error::from_reason("Negative span start"))?;
    let end = usize::try_from(end).map_err(|_| Error::from_reason("Negative span end"))?;
    if end < start {
        return Err(Error::from_reason(
            "Structural index span end precedes start",
        ));
    }
    Ok(Some((start, end)))
}

pub(crate) fn read_u32_le(input: &[u8], offset: usize) -> Result<u32> {
    let bytes = input
        .get(offset..offset + 4)
        .ok_or_else(|| Error::from_reason("Unexpected end of structural index table"))?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

pub(crate) fn read_i32_le(input: &[u8], offset: usize) -> Result<i32> {
    let bytes = input
        .get(offset..offset + 4)
        .ok_or_else(|| Error::from_reason("Unexpected end of structural index table"))?;
    Ok(i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

pub(crate) fn encode_optional_span(span: Option<(usize, usize)>) -> Result<(i32, i32)> {
    match span {
        Some((start, end)) => Ok((to_i32_span(start)?, to_i32_span(end)?)),
        None => Ok((NO_SPAN, NO_SPAN)),
    }
}

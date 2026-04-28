use super::*;

#[cfg(feature = "napi-bindings")]
use napi::bindgen_prelude::{Buffer, Uint8Array};

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct StreamingEventBatch {
    pub buffer: Buffer,
    pub table: Buffer,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub struct StaxXmlStreamingEventBatchParser {
    started: bool,
    finished: bool,
    pending: Vec<u8>,
    element_stack: Vec<Vec<u8>>,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn create_streaming_event_batch_parser() -> StaxXmlStreamingEventBatchParser {
    StaxXmlStreamingEventBatchParser::new()
}

impl StaxXmlStreamingEventBatchParser {
    pub(crate) fn new() -> Self {
        Self {
            started: false,
            finished: false,
            pending: Vec::new(),
            element_stack: Vec::new(),
        }
    }

    fn parse_chunk(&mut self, chunk: &[u8], is_final: bool) -> Result<(Vec<u8>, Vec<u8>)> {
        if self.finished {
            return Err(Error::from_reason("Streaming event batch parser is already finished"));
        }

        let mut buffer = Vec::with_capacity(self.pending.len() + chunk.len());
        buffer.extend_from_slice(&self.pending);
        buffer.extend_from_slice(chunk);
        self.pending.clear();

        let mut table = SpanTableBuilder::new(buffer.len(), 1)?;
        if !self.started {
            self.started = true;
            push_event(&mut table, START_DOCUMENT, None, None, None)?;
        }

        let mut position = 0;
        while position < buffer.len() {
            let Some(lt_offset) = memchr(b'<', &buffer[position..]) else {
                if is_final {
                    emit_text(&mut table, &buffer, position, buffer.len(), CHARACTERS)?;
                } else {
                    let safe_end = valid_utf8_prefix_end(&buffer, position, buffer.len());
                    emit_text(&mut table, &buffer, position, safe_end, CHARACTERS)?;
                    self.pending.extend_from_slice(&buffer[safe_end..]);
                }
                break;
            };
            let lt = position + lt_offset;
            emit_text(&mut table, &buffer, position, lt, CHARACTERS)?;
            match parse_markup(&buffer, lt, &mut table, &mut self.element_stack) {
                MarkupResult::Complete(next) => position = next,
                MarkupResult::Incomplete => {
                    if is_final {
                        return Err(incomplete_markup_error(&buffer, lt));
                    }
                    self.pending.extend_from_slice(&buffer[lt..]);
                    position = buffer.len();
                }
                MarkupResult::Error(error) => return Err(error),
            }
        }

        if is_final {
            if !self.pending.is_empty() {
                let pending = std::mem::take(&mut self.pending);
                emit_text(&mut table, &pending, 0, pending.len(), CHARACTERS)?;
            }
            if !self.element_stack.is_empty() {
                return Err(Error::from_reason(
                    "Unexpected end of document. Not all elements were closed.",
                ));
            }
            push_event(&mut table, END_DOCUMENT, None, None, None)?;
            self.finished = true;
        }

        Ok((buffer, table.finish()?))
    }
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
impl StaxXmlStreamingEventBatchParser {
    #[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
    pub fn push_chunk(
        &mut self,
        chunk: Uint8Array,
        is_final: bool,
    ) -> napi::Result<StreamingEventBatch> {
        let (buffer, table) = self
            .parse_chunk(chunk.as_ref(), is_final)
            .map_err(napi::Error::from)?;
        Ok(StreamingEventBatch {
            buffer: Buffer::from(buffer),
            table: Buffer::from(table),
        })
    }
}

enum MarkupResult {
    Complete(usize),
    Incomplete,
    Error(Error),
}

fn parse_markup(
    input: &[u8],
    position: usize,
    table: &mut SpanTableBuilder,
    element_stack: &mut Vec<Vec<u8>>,
) -> MarkupResult {
    if position + 1 >= input.len() {
        return MarkupResult::Incomplete;
    }
    match input[position + 1] {
        b'/' => parse_end_tag(input, position, table, element_stack),
        b'!' => parse_bang(input, position, table),
        b'?' => parse_processing_instruction(input, position),
        _ => parse_start_tag(input, position, table, element_stack),
    }
}

fn parse_bang(input: &[u8], position: usize, table: &mut SpanTableBuilder) -> MarkupResult {
    if starts_with(input, position, b"<![CDATA[") {
        let Some(end) = find_bytes(input, b"]]>", position + 9) else {
            return MarkupResult::Incomplete;
        };
        return match emit_text(table, input, position + 9, end, CDATA) {
            Ok(()) => MarkupResult::Complete(end + 3),
            Err(error) => MarkupResult::Error(error),
        };
    }
    if starts_with(input, position, b"<!--") {
        let Some(end) = find_bytes(input, b"-->", position + 4) else {
            return MarkupResult::Incomplete;
        };
        return MarkupResult::Complete(end + 3);
    }
    if starts_with(input, position, b"<!DOCTYPE") {
        let Some(end) = find_doctype_end(input, position + 2) else {
            return MarkupResult::Incomplete;
        };
        return MarkupResult::Complete(end + 1);
    }
    let Some(end) = find_gt(input, position + 2) else {
        return MarkupResult::Incomplete;
    };
    MarkupResult::Complete(end + 1)
}

fn parse_processing_instruction(input: &[u8], position: usize) -> MarkupResult {
    let Some(end) = find_bytes(input, b"?>", position + 2) else {
        return MarkupResult::Incomplete;
    };
    MarkupResult::Complete(end + 2)
}

fn parse_end_tag(
    input: &[u8],
    position: usize,
    table: &mut SpanTableBuilder,
    element_stack: &mut Vec<Vec<u8>>,
) -> MarkupResult {
    let Some(end) = find_gt(input, position + 2) else {
        return MarkupResult::Incomplete;
    };
    let mut name_start = position + 2;
    let mut name_end = end;
    while name_start < name_end && is_whitespace(input[name_start]) {
        name_start += 1;
    }
    while name_end > name_start && is_whitespace(input[name_end - 1]) {
        name_end -= 1;
    }
    let Some(open_name) = element_stack.pop() else {
        return MarkupResult::Error(Error::from_reason("Unexpected closing tag"));
    };
    if open_name.as_slice() != &input[name_start..name_end] {
        return MarkupResult::Error(Error::from_reason("Mismatched closing tag"));
    }
    match push_event(table, END_ELEMENT, Some((name_start, name_end)), None, None) {
        Ok(()) => MarkupResult::Complete(end + 1),
        Err(error) => MarkupResult::Error(error),
    }
}

fn parse_start_tag(
    input: &[u8],
    position: usize,
    table: &mut SpanTableBuilder,
    element_stack: &mut Vec<Vec<u8>>,
) -> MarkupResult {
    let Some(tag_end) = find_tag_end(input, position + 1) else {
        return MarkupResult::Incomplete;
    };
    let mut actual_end = tag_end;
    while actual_end > position + 1 && is_whitespace(input[actual_end - 1]) {
        actual_end -= 1;
    }
    let mut self_closing = false;
    if actual_end > position + 1 && input[actual_end - 1] == b'/' {
        self_closing = true;
        actual_end -= 1;
        while actual_end > position + 1 && is_whitespace(input[actual_end - 1]) {
            actual_end -= 1;
        }
    }
    let name_start = position + 1;
    let mut name_end = name_start;
    while name_end < actual_end {
        let byte = input[name_end];
        if is_whitespace(byte) || byte == b'/' {
            break;
        }
        name_end += 1;
    }
    let attrs = (name_end < actual_end).then(|| parse_attributes(input, name_end, actual_end));
    if let Err(error) = push_event(
        table,
        START_ELEMENT,
        Some((name_start, name_end)),
        None,
        attrs.as_ref(),
    ) {
        return MarkupResult::Error(error);
    }
    if self_closing {
        if let Err(error) = push_event(table, END_ELEMENT, Some((name_start, name_end)), None, None)
        {
            return MarkupResult::Error(error);
        }
    } else {
        element_stack.push(input[name_start..name_end].to_vec());
    }
    MarkupResult::Complete(tag_end + 1)
}

fn emit_text(
    table: &mut SpanTableBuilder,
    input: &[u8],
    start: usize,
    end: usize,
    event_type: u8,
) -> Result<()> {
    if start < end && !is_whitespace_only(input, start, end) {
        push_event(table, event_type, None, Some((start, end)), None)?;
    }
    Ok(())
}

fn push_event(
    table: &mut SpanTableBuilder,
    event_type: u8,
    name: Option<(usize, usize)>,
    text: Option<(usize, usize)>,
    attrs: Option<&AttrSpans>,
) -> Result<()> {
    let attr_start = table.attr_count();
    let attr_count = to_u32_count(attrs.map_or(0, AttrSpans::len), "streaming span table attr count")?;
    let (name_start, name_end) = encode_optional_span(name)?;
    let (text_start, text_end) = encode_optional_span(text)?;
    if let Some(attrs) = attrs {
        for attr in attrs.iter() {
            table.push_attr(SpanAttrRecord {
                name_start: to_i32_span(attr.name_start)?,
                name_end: to_i32_span(attr.name_end)?,
                value_start: to_i32_span(attr.value_start)?,
                value_end: to_i32_span(attr.value_end)?,
            })?;
        }
    }
    table.push_event(SpanEventRecord {
        event_type: event_type as u32,
        name_start,
        name_end,
        text_start,
        text_end,
        attr_start,
        attr_count,
    })
}

fn encode_optional_span(span: Option<(usize, usize)>) -> Result<(i32, i32)> {
    match span {
        Some((start, end)) => Ok((to_i32_span(start)?, to_i32_span(end)?)),
        None => Ok((-1, -1)),
    }
}

fn valid_utf8_prefix_end(input: &[u8], start: usize, end: usize) -> usize {
    let mut candidate = end;
    let floor = start.max(end.saturating_sub(4));
    while candidate > floor && std::str::from_utf8(&input[start..candidate]).is_err() {
        candidate -= 1;
    }
    candidate
}

fn incomplete_markup_error(input: &[u8], position: usize) -> Error {
    if starts_with(input, position, b"<![CDATA[") {
        return Error::from_reason("Unclosed CDATA section");
    }
    if starts_with(input, position, b"<!--") {
        return Error::from_reason("Unclosed comment");
    }
    if starts_with(input, position, b"<!DOCTYPE") {
        return Error::from_reason("Unclosed DOCTYPE declaration");
    }
    if starts_with(input, position, b"<?xml") {
        return Error::from_reason("Unclosed XML declaration");
    }
    if position + 1 < input.len() && input[position + 1] == b'?' {
        return Error::from_reason("Unclosed processing instruction");
    }
    if position + 1 < input.len() && input[position + 1] == b'/' {
        return Error::from_reason("Unclosed end tag");
    }
    Error::from_reason("Unclosed start tag")
}

fn find_bytes(input: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    input[from..]
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|offset| from + offset)
}

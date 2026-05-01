use super::*;

#[cfg(feature = "napi-bindings")]
use napi::bindgen_prelude::{Buffer, Uint8Array};

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct StreamingEventBatch {
    pub buffer: Uint8Array,
    pub table: Buffer,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub struct StaxXmlStreamingEventBatchParser {
    started: bool,
    finished: bool,
    pending: Vec<u8>,
    element_stack: Vec<Vec<u8>>,
    name_interner: NameIdInterner,
    value_interner: Utf8ValueIdInterner,
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
            name_interner: NameIdInterner::utf8(),
            value_interner: Utf8ValueIdInterner::new(),
        }
    }

    fn parse_batch(
        &mut self,
        chunks: Vec<Uint8Array>,
        is_final: bool,
    ) -> Result<(Uint8Array, Vec<u8>)> {
        if chunks.len() <= 1 {
            let chunk = chunks
                .into_iter()
                .next()
                .unwrap_or_else(|| Uint8Array::from(Vec::<u8>::new()));
            return self.parse_chunk(chunk, is_final);
        }

        if self.finished {
            return Err(Error::from_reason(
                "Streaming event batch parser is already finished",
            ));
        }

        let chunk_bytes_len = chunks.iter().map(|chunk| chunk.len()).sum::<usize>();
        let pending = std::mem::take(&mut self.pending);
        let mut buffer = Vec::with_capacity(pending.len() + chunk_bytes_len);
        buffer.extend_from_slice(&pending);
        for chunk in chunks {
            buffer.extend_from_slice(chunk.as_ref());
        }
        let table = self.parse_buffer(&buffer, is_final)?;
        Ok((Uint8Array::from(buffer), table))
    }

    fn parse_chunk(&mut self, chunk: Uint8Array, is_final: bool) -> Result<(Uint8Array, Vec<u8>)> {
        if self.finished {
            return Err(Error::from_reason(
                "Streaming event batch parser is already finished",
            ));
        }

        if self.pending.is_empty() {
            let table = self.parse_buffer(chunk.as_ref(), is_final)?;
            return Ok((chunk, table));
        }

        let pending = std::mem::take(&mut self.pending);
        let mut buffer = Vec::with_capacity(pending.len() + chunk.len());
        buffer.extend_from_slice(&pending);
        buffer.extend_from_slice(chunk.as_ref());
        let table = self.parse_buffer(&buffer, is_final)?;
        Ok((Uint8Array::from(buffer), table))
    }

    fn parse_buffer(&mut self, buffer: &[u8], is_final: bool) -> Result<Vec<u8>> {
        let mut table = SpanTableBuilder::new(buffer.len(), 1 | SPAN_TABLE_FLAG_VALUE_IDS)?;
        if !self.started {
            self.started = true;
            push_event(
                &mut table,
                Utf8InternerPair::new(&mut self.name_interner, &mut self.value_interner),
                buffer,
                START_DOCUMENT,
                None,
                None,
                None,
            )?;
        }

        let mut position = 0;
        while position < buffer.len() {
            let Some(lt_offset) = memchr(b'<', &buffer[position..]) else {
                if is_final {
                    emit_text(
                        &mut table,
                        &mut self.name_interner,
                        &mut self.value_interner,
                        buffer,
                        position,
                        buffer.len(),
                        CHARACTERS,
                    )?;
                } else {
                    self.pending.extend_from_slice(&buffer[position..]);
                }
                break;
            };
            let lt = position + lt_offset;
            emit_text(
                &mut table,
                &mut self.name_interner,
                &mut self.value_interner,
                buffer,
                position,
                lt,
                CHARACTERS,
            )?;
            match parse_markup(
                buffer,
                lt,
                &mut table,
                &mut self.name_interner,
                &mut self.value_interner,
                &mut self.element_stack,
            ) {
                MarkupResult::Complete(next) => position = next,
                MarkupResult::Incomplete => {
                    if is_final {
                        return Err(incomplete_markup_error(buffer, lt));
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
                emit_text(
                    &mut table,
                    &mut self.name_interner,
                    &mut self.value_interner,
                    &pending,
                    0,
                    pending.len(),
                    CHARACTERS,
                )?;
            }
            if !self.element_stack.is_empty() {
                return Err(Error::from_reason(
                    "Unexpected end of document. Not all elements were closed.",
                ));
            }
            push_event(
                &mut table,
                Utf8InternerPair::new(&mut self.name_interner, &mut self.value_interner),
                buffer,
                END_DOCUMENT,
                None,
                None,
                None,
            )?;
            self.finished = true;
        }

        table.finish()
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
            .parse_chunk(chunk, is_final)
            .map_err(napi::Error::from)?;
        Ok(StreamingEventBatch {
            buffer,
            table: Buffer::from(table),
        })
    }

    #[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
    pub fn push_batch(
        &mut self,
        chunks: Vec<Uint8Array>,
        is_final: bool,
    ) -> napi::Result<StreamingEventBatch> {
        let (buffer, table) = self
            .parse_batch(chunks, is_final)
            .map_err(napi::Error::from)?;
        Ok(StreamingEventBatch {
            buffer,
            table: Buffer::from(table),
        })
    }
}

enum MarkupResult {
    Complete(usize),
    Incomplete,
    Error(Error),
}

struct Utf8InternerPair<'a> {
    name_ids: &'a mut NameIdInterner,
    value_ids: &'a mut Utf8ValueIdInterner,
}

impl<'a> Utf8InternerPair<'a> {
    fn new(name_ids: &'a mut NameIdInterner, value_ids: &'a mut Utf8ValueIdInterner) -> Self {
        Self {
            name_ids,
            value_ids,
        }
    }
}

fn parse_markup(
    input: &[u8],
    position: usize,
    table: &mut SpanTableBuilder,
    name_interner: &mut NameIdInterner,
    value_interner: &mut Utf8ValueIdInterner,
    element_stack: &mut Vec<Vec<u8>>,
) -> MarkupResult {
    if position + 1 >= input.len() {
        return MarkupResult::Incomplete;
    }
    match input[position + 1] {
        b'/' => parse_end_tag(input, position, table, name_interner, value_interner, element_stack),
        b'!' => parse_bang(input, position, table, name_interner, value_interner),
        b'?' => parse_processing_instruction(input, position),
        _ => parse_start_tag(input, position, table, name_interner, value_interner, element_stack),
    }
}

fn parse_bang(
    input: &[u8],
    position: usize,
    table: &mut SpanTableBuilder,
    name_interner: &mut NameIdInterner,
    value_interner: &mut Utf8ValueIdInterner,
) -> MarkupResult {
    if starts_with(input, position, b"<![CDATA[") {
        let Some(end) = find_bytes(input, b"]]>", position + 9) else {
            return MarkupResult::Incomplete;
        };
        return match emit_text(table, name_interner, value_interner, input, position + 9, end, CDATA) {
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
    name_interner: &mut NameIdInterner,
    value_interner: &mut Utf8ValueIdInterner,
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
    match push_event(
        table,
        Utf8InternerPair::new(name_interner, value_interner),
        input,
        END_ELEMENT,
        Some((name_start, name_end)),
        None,
        None,
    ) {
        Ok(()) => MarkupResult::Complete(end + 1),
        Err(error) => MarkupResult::Error(error),
    }
}

fn parse_start_tag(
    input: &[u8],
    position: usize,
    table: &mut SpanTableBuilder,
    name_interner: &mut NameIdInterner,
    value_interner: &mut Utf8ValueIdInterner,
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
        Utf8InternerPair::new(name_interner, value_interner),
        input,
        START_ELEMENT,
        Some((name_start, name_end)),
        None,
        attrs.as_ref(),
    ) {
        return MarkupResult::Error(error);
    }
    if self_closing {
        if let Err(error) = push_event(
            table,
            Utf8InternerPair::new(name_interner, value_interner),
            input,
            END_ELEMENT,
            Some((name_start, name_end)),
            None,
            None,
        ) {
            return MarkupResult::Error(error);
        }
    } else {
        element_stack.push(input[name_start..name_end].to_vec());
    }
    MarkupResult::Complete(tag_end + 1)
}

fn emit_text(
    table: &mut SpanTableBuilder,
    name_interner: &mut NameIdInterner,
    value_interner: &mut Utf8ValueIdInterner,
    input: &[u8],
    start: usize,
    end: usize,
    event_type: u8,
) -> Result<()> {
    if start < end && !is_whitespace_only(input, start, end) {
        push_event(
            table,
            Utf8InternerPair::new(name_interner, value_interner),
            input,
            event_type,
            None,
            Some((start, end)),
            None,
        )?;
    }
    Ok(())
}

fn push_event(
    table: &mut SpanTableBuilder,
    interners: Utf8InternerPair<'_>,
    input: &[u8],
    event_type: u8,
    name: Option<(usize, usize)>,
    text: Option<(usize, usize)>,
    attrs: Option<&AttrSpans>,
) -> Result<()> {
    let attr_start = table.attr_count();
    let attr_count = to_u32_count(
        attrs.map_or(0, AttrSpans::len),
        "streaming span table attr count",
    )?;
    let (name_start, name_end) = encode_optional_span(name)?;
    let (text_start, text_end) = encode_optional_span(text)?;
    let name_id = interners.name_ids.intern_utf8(input, name)?;
    let text_value_id = interners.value_ids.intern(input, text)?;
    if let Some(attrs) = attrs {
        for attr in attrs.iter() {
            table.push_attr(SpanAttrRecord {
                name_start: to_i32_span(attr.name_start)?,
                name_end: to_i32_span(attr.name_end)?,
                value_start: to_i32_span(attr.value_start)?,
                value_end: to_i32_span(attr.value_end)?,
                name_id: interners
                    .name_ids
                    .intern_utf8(input, Some((attr.name_start, attr.name_end)))?,
                value_id: interners
                    .value_ids
                    .intern(input, Some((attr.value_start, attr.value_end)))?,
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
        name_id,
        text_value_id,
    })
}

fn encode_optional_span(span: Option<(usize, usize)>) -> Result<(i32, i32)> {
    match span {
        Some((start, end)) => Ok((to_i32_span(start)?, to_i32_span(end)?)),
        None => Ok((-1, -1)),
    }
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

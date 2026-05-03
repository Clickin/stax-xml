use super::*;

#[cfg(feature = "napi-bindings")]
use napi::bindgen_prelude::{Buffer, Uint8Array};

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct StreamingEventBatch {
    pub buffer: Uint8Array,
    pub table: Option<Buffer>,
    pub soa_table: Option<Buffer>,
    pub string_arena: Option<String>,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct StreamingEventBatchParserOptions {
    pub batch_layout: Option<String>,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub struct StaxXmlStreamingEventBatchParser {
    started: bool,
    finished: bool,
    pending: Vec<u8>,
    element_stack: Vec<Vec<u8>>,
    name_interner: NameIdInterner,
    value_interner: Utf8ValueIdInterner,
    batch_layout: StreamingBatchLayout,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn create_streaming_event_batch_parser(
    options: Option<StreamingEventBatchParserOptions>,
) -> StaxXmlStreamingEventBatchParser {
    match StreamingBatchLayout::from_options(options) {
        StreamingBatchLayout::SpanTable => StaxXmlStreamingEventBatchParser::new(),
        layout => StaxXmlStreamingEventBatchParser::new_with_layout(layout),
    }
}

pub(crate) const SOA_STRING_ARENA_MAGIC: u32 = 0x3141_4f53;
pub(crate) const SOA_STRING_ARENA_VERSION: u32 = 1;
pub(crate) const SOA_STRING_ARENA_SOURCE_KIND_UTF8: u32 = 1;
pub(crate) const SOA_STRING_ARENA_HEADER_WORDS: usize = 32;
pub(crate) const SOA_STRING_ARENA_EVENT_COLUMNS: usize = 13;
pub(crate) const SOA_STRING_ARENA_ATTR_COLUMNS: usize = 10;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum StreamingBatchLayout {
    SpanTable,
    SoaStringArena,
}

impl StreamingBatchLayout {
    fn from_options(options: Option<StreamingEventBatchParserOptions>) -> Self {
        match options.and_then(|value| value.batch_layout) {
            Some(layout) if layout == "soa-string-arena" => Self::SoaStringArena,
            _ => Self::SpanTable,
        }
    }
}

enum StreamingBatchPayload {
    SpanTable(Vec<u8>),
    SoaStringArena { table: Vec<u8>, arena: String },
}

impl StaxXmlStreamingEventBatchParser {
    pub(crate) fn new() -> Self {
        Self::new_with_layout(StreamingBatchLayout::SpanTable)
    }

    pub(crate) fn new_with_layout(batch_layout: StreamingBatchLayout) -> Self {
        Self {
            started: false,
            finished: false,
            pending: Vec::new(),
            element_stack: Vec::new(),
            name_interner: NameIdInterner::utf8(),
            value_interner: Utf8ValueIdInterner::new(),
            batch_layout,
        }
    }

    fn parse_batch(
        &mut self,
        chunks: Vec<Uint8Array>,
        is_final: bool,
    ) -> Result<(Uint8Array, StreamingBatchPayload)> {
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

    fn parse_chunk(
        &mut self,
        chunk: Uint8Array,
        is_final: bool,
    ) -> Result<(Uint8Array, StreamingBatchPayload)> {
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

    fn parse_buffer(&mut self, buffer: &[u8], is_final: bool) -> Result<StreamingBatchPayload> {
        match self.batch_layout {
            StreamingBatchLayout::SpanTable => {
                let table = SpanTableBuilder::new(buffer.len(), 1 | SPAN_TABLE_FLAG_VALUE_IDS)?;
                self.parse_buffer_with_builder(buffer, is_final, table)
                    .map(StreamingBatchPayload::SpanTable)
            }
            StreamingBatchLayout::SoaStringArena => {
                let table = StreamingSoaStringArenaBuilder::new(buffer.len())?;
                let (table, arena) = self.parse_buffer_with_builder(buffer, is_final, table)?;
                Ok(StreamingBatchPayload::SoaStringArena { table, arena })
            }
        }
    }

    fn parse_buffer_with_builder<B: StreamingBatchBuilder>(
        &mut self,
        buffer: &[u8],
        is_final: bool,
        mut table: B,
    ) -> Result<B::Output> {
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
        let (buffer, payload) = self
            .parse_chunk(chunk, is_final)
            .map_err(napi::Error::from)?;
        Ok(make_napi_streaming_batch(buffer, payload))
    }

    #[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
    pub fn push_batch(
        &mut self,
        chunks: Vec<Uint8Array>,
        is_final: bool,
    ) -> napi::Result<StreamingEventBatch> {
        let (buffer, payload) = self
            .parse_batch(chunks, is_final)
            .map_err(napi::Error::from)?;
        Ok(make_napi_streaming_batch(buffer, payload))
    }
}

fn make_napi_streaming_batch(
    buffer: Uint8Array,
    payload: StreamingBatchPayload,
) -> StreamingEventBatch {
    match payload {
        StreamingBatchPayload::SpanTable(table) => StreamingEventBatch {
            buffer,
            table: Some(Buffer::from(table)),
            soa_table: None,
            string_arena: None,
        },
        StreamingBatchPayload::SoaStringArena { table, arena } => StreamingEventBatch {
            buffer,
            table: None,
            soa_table: Some(Buffer::from(table)),
            string_arena: Some(arena),
        },
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

trait StreamingBatchBuilder {
    type Output;

    fn attr_count(&self) -> u32;
    fn push_attr(&mut self, attr: SpanAttrRecord, input: &[u8]) -> Result<()>;
    fn push_event(&mut self, event: SpanEventRecord, input: &[u8]) -> Result<()>;
    fn finish(self) -> Result<Self::Output>;
}

impl StreamingBatchBuilder for SpanTableBuilder {
    type Output = Vec<u8>;

    fn attr_count(&self) -> u32 {
        SpanTableBuilder::attr_count(self)
    }

    fn push_attr(&mut self, attr: SpanAttrRecord, _input: &[u8]) -> Result<()> {
        SpanTableBuilder::push_attr(self, attr)
    }

    fn push_event(&mut self, event: SpanEventRecord, _input: &[u8]) -> Result<()> {
        SpanTableBuilder::push_event(self, event)
    }

    fn finish(self) -> Result<Self::Output> {
        SpanTableBuilder::finish(self)
    }
}

struct StreamingSoaStringArenaBuilder {
    input_units: u32,
    event_types: Vec<u32>,
    name_starts: Vec<i32>,
    name_ends: Vec<i32>,
    text_starts: Vec<i32>,
    text_ends: Vec<i32>,
    attr_starts: Vec<u32>,
    attr_counts: Vec<u32>,
    event_name_ids: Vec<u32>,
    event_text_value_ids: Vec<u32>,
    event_name_arena_starts: Vec<i32>,
    event_name_arena_ends: Vec<i32>,
    event_text_arena_starts: Vec<i32>,
    event_text_arena_ends: Vec<i32>,
    attr_name_starts: Vec<i32>,
    attr_name_ends: Vec<i32>,
    attr_value_starts: Vec<i32>,
    attr_value_ends: Vec<i32>,
    attr_name_ids: Vec<u32>,
    attr_value_ids: Vec<u32>,
    attr_name_arena_starts: Vec<i32>,
    attr_name_arena_ends: Vec<i32>,
    attr_value_arena_starts: Vec<i32>,
    attr_value_arena_ends: Vec<i32>,
    arena: String,
    arena_units: usize,
    attr_count: u32,
}

impl StreamingSoaStringArenaBuilder {
    fn new(input_units: usize) -> Result<Self> {
        Ok(Self {
            input_units: to_u32_count(input_units, "SoA string arena input units")?,
            event_types: Vec::new(),
            name_starts: Vec::new(),
            name_ends: Vec::new(),
            text_starts: Vec::new(),
            text_ends: Vec::new(),
            attr_starts: Vec::new(),
            attr_counts: Vec::new(),
            event_name_ids: Vec::new(),
            event_text_value_ids: Vec::new(),
            event_name_arena_starts: Vec::new(),
            event_name_arena_ends: Vec::new(),
            event_text_arena_starts: Vec::new(),
            event_text_arena_ends: Vec::new(),
            attr_name_starts: Vec::new(),
            attr_name_ends: Vec::new(),
            attr_value_starts: Vec::new(),
            attr_value_ends: Vec::new(),
            attr_name_ids: Vec::new(),
            attr_value_ids: Vec::new(),
            attr_name_arena_starts: Vec::new(),
            attr_name_arena_ends: Vec::new(),
            attr_value_arena_starts: Vec::new(),
            attr_value_arena_ends: Vec::new(),
            arena: String::new(),
            arena_units: 0,
            attr_count: 0,
        })
    }

    fn append_span_from_i32(&mut self, input: &[u8], start: i32, end: i32) -> Result<(i32, i32)> {
        if start < 0 || end < 0 {
            return Ok((NO_SPAN, NO_SPAN));
        }
        if end < start {
            return Err(Error::from_reason(
                "SoA string arena span end precedes start",
            ));
        }
        let start = usize::try_from(start)
            .map_err(|_| Error::from_reason("SoA string arena span start out of range"))?;
        let end = usize::try_from(end)
            .map_err(|_| Error::from_reason("SoA string arena span end out of range"))?;
        let Some(bytes) = input.get(start..end) else {
            return Err(Error::from_reason(
                "SoA string arena span out of input range",
            ));
        };
        let Ok(value) = std::str::from_utf8(bytes) else {
            return Ok((NO_SPAN, NO_SPAN));
        };
        let arena_start = i32::try_from(self.arena_units)
            .map_err(|_| Error::from_reason("SoA string arena offset exceeded i32 range"))?;
        self.arena.push_str(value);
        self.arena_units = self
            .arena_units
            .checked_add(value.encode_utf16().count())
            .ok_or_else(|| Error::from_reason("SoA string arena offset overflow"))?;
        let arena_end = i32::try_from(self.arena_units)
            .map_err(|_| Error::from_reason("SoA string arena offset exceeded i32 range"))?;
        Ok((arena_start, arena_end))
    }

    fn push_column_u32(table: &mut Vec<u8>, column: &[u32]) {
        for value in column {
            push_u32(table, *value);
        }
    }

    fn push_column_i32(table: &mut Vec<u8>, column: &[i32]) {
        for value in column {
            push_i32(table, *value);
        }
    }
}

impl StreamingBatchBuilder for StreamingSoaStringArenaBuilder {
    type Output = (Vec<u8>, String);

    fn attr_count(&self) -> u32 {
        self.attr_count
    }

    fn push_attr(&mut self, attr: SpanAttrRecord, input: &[u8]) -> Result<()> {
        self.attr_count = self
            .attr_count
            .checked_add(1)
            .ok_or_else(|| Error::from_reason("SoA string arena attr count overflow"))?;
        let (name_arena_start, name_arena_end) =
            self.append_span_from_i32(input, attr.name_start, attr.name_end)?;
        let (value_arena_start, value_arena_end) =
            self.append_span_from_i32(input, attr.value_start, attr.value_end)?;
        self.attr_name_starts.push(attr.name_start);
        self.attr_name_ends.push(attr.name_end);
        self.attr_value_starts.push(attr.value_start);
        self.attr_value_ends.push(attr.value_end);
        self.attr_name_ids.push(attr.name_id);
        self.attr_value_ids.push(attr.value_id);
        self.attr_name_arena_starts.push(name_arena_start);
        self.attr_name_arena_ends.push(name_arena_end);
        self.attr_value_arena_starts.push(value_arena_start);
        self.attr_value_arena_ends.push(value_arena_end);
        Ok(())
    }

    fn push_event(&mut self, event: SpanEventRecord, input: &[u8]) -> Result<()> {
        let (name_arena_start, name_arena_end) =
            self.append_span_from_i32(input, event.name_start, event.name_end)?;
        let (text_arena_start, text_arena_end) =
            self.append_span_from_i32(input, event.text_start, event.text_end)?;
        self.event_types.push(event.event_type);
        self.name_starts.push(event.name_start);
        self.name_ends.push(event.name_end);
        self.text_starts.push(event.text_start);
        self.text_ends.push(event.text_end);
        self.attr_starts.push(event.attr_start);
        self.attr_counts.push(event.attr_count);
        self.event_name_ids.push(event.name_id);
        self.event_text_value_ids.push(event.text_value_id);
        self.event_name_arena_starts.push(name_arena_start);
        self.event_name_arena_ends.push(name_arena_end);
        self.event_text_arena_starts.push(text_arena_start);
        self.event_text_arena_ends.push(text_arena_end);
        Ok(())
    }

    fn finish(self) -> Result<Self::Output> {
        let event_count = to_u32_count(self.event_types.len(), "SoA string arena event count")?;
        let attr_count = self.attr_count;
        debug_assert_eq!(self.name_starts.len(), event_count as usize);
        debug_assert_eq!(self.attr_name_starts.len(), attr_count as usize);

        let event_count_usize = event_count as usize;
        let attr_count_usize = attr_count as usize;
        let event_words = event_count_usize
            .checked_mul(SOA_STRING_ARENA_EVENT_COLUMNS)
            .ok_or_else(|| Error::from_reason("SoA string arena event word size overflow"))?;
        let attr_words = attr_count_usize
            .checked_mul(SOA_STRING_ARENA_ATTR_COLUMNS)
            .ok_or_else(|| Error::from_reason("SoA string arena attr word size overflow"))?;
        let total_words = SOA_STRING_ARENA_HEADER_WORDS
            .checked_add(event_words)
            .and_then(|value| value.checked_add(attr_words))
            .ok_or_else(|| Error::from_reason("SoA string arena table word size overflow"))?;
        let total_bytes = total_words
            .checked_mul(4)
            .ok_or_else(|| Error::from_reason("SoA string arena table byte size overflow"))?;

        let mut table = vec![0; SOA_STRING_ARENA_HEADER_WORDS * 4];
        let mut cursor = SOA_STRING_ARENA_HEADER_WORDS as u32;
        let mut write_column_offset = |word: usize, len: usize, table: &mut [u8]| -> Result<u32> {
            let offset = cursor;
            write_u32_at(table, word * 4, offset);
            cursor = cursor
                .checked_add(to_u32_count(len, "SoA string arena column length")?)
                .ok_or_else(|| Error::from_reason("SoA string arena column offset overflow"))?;
            Ok(offset)
        };

        write_u32_at(&mut table, 0, SOA_STRING_ARENA_MAGIC);
        write_u32_at(&mut table, 4, SOA_STRING_ARENA_VERSION);
        write_u32_at(&mut table, 8, event_count);
        write_u32_at(&mut table, 12, attr_count);
        write_u32_at(&mut table, 16, self.input_units);
        write_u32_at(&mut table, 20, SOA_STRING_ARENA_SOURCE_KIND_UTF8);
        write_column_offset(6, event_count_usize, &mut table)?;
        write_column_offset(7, event_count_usize, &mut table)?;
        write_column_offset(8, event_count_usize, &mut table)?;
        write_column_offset(9, event_count_usize, &mut table)?;
        write_column_offset(10, event_count_usize, &mut table)?;
        write_column_offset(11, event_count_usize, &mut table)?;
        write_column_offset(12, event_count_usize, &mut table)?;
        write_column_offset(13, event_count_usize, &mut table)?;
        write_column_offset(14, event_count_usize, &mut table)?;
        write_column_offset(15, event_count_usize, &mut table)?;
        write_column_offset(16, event_count_usize, &mut table)?;
        write_column_offset(17, event_count_usize, &mut table)?;
        write_column_offset(18, event_count_usize, &mut table)?;
        write_column_offset(19, attr_count_usize, &mut table)?;
        write_column_offset(20, attr_count_usize, &mut table)?;
        write_column_offset(21, attr_count_usize, &mut table)?;
        write_column_offset(22, attr_count_usize, &mut table)?;
        write_column_offset(23, attr_count_usize, &mut table)?;
        write_column_offset(24, attr_count_usize, &mut table)?;
        write_column_offset(25, attr_count_usize, &mut table)?;
        write_column_offset(26, attr_count_usize, &mut table)?;
        write_column_offset(27, attr_count_usize, &mut table)?;
        write_column_offset(28, attr_count_usize, &mut table)?;
        write_u32_at(&mut table, 29 * 4, cursor);
        if cursor as usize != total_words {
            return Err(Error::from_reason("SoA string arena table length mismatch"));
        }

        table
            .try_reserve_exact(total_bytes - table.len())
            .map_err(|error| Error::from_reason(error.to_string()))?;
        Self::push_column_u32(&mut table, &self.event_types);
        Self::push_column_i32(&mut table, &self.name_starts);
        Self::push_column_i32(&mut table, &self.name_ends);
        Self::push_column_i32(&mut table, &self.text_starts);
        Self::push_column_i32(&mut table, &self.text_ends);
        Self::push_column_u32(&mut table, &self.attr_starts);
        Self::push_column_u32(&mut table, &self.attr_counts);
        Self::push_column_u32(&mut table, &self.event_name_ids);
        Self::push_column_u32(&mut table, &self.event_text_value_ids);
        Self::push_column_i32(&mut table, &self.event_name_arena_starts);
        Self::push_column_i32(&mut table, &self.event_name_arena_ends);
        Self::push_column_i32(&mut table, &self.event_text_arena_starts);
        Self::push_column_i32(&mut table, &self.event_text_arena_ends);
        Self::push_column_i32(&mut table, &self.attr_name_starts);
        Self::push_column_i32(&mut table, &self.attr_name_ends);
        Self::push_column_i32(&mut table, &self.attr_value_starts);
        Self::push_column_i32(&mut table, &self.attr_value_ends);
        Self::push_column_u32(&mut table, &self.attr_name_ids);
        Self::push_column_u32(&mut table, &self.attr_value_ids);
        Self::push_column_i32(&mut table, &self.attr_name_arena_starts);
        Self::push_column_i32(&mut table, &self.attr_name_arena_ends);
        Self::push_column_i32(&mut table, &self.attr_value_arena_starts);
        Self::push_column_i32(&mut table, &self.attr_value_arena_ends);
        debug_assert_eq!(table.len(), total_bytes);
        Ok((table, self.arena))
    }
}

fn parse_markup<B: StreamingBatchBuilder>(
    input: &[u8],
    position: usize,
    table: &mut B,
    name_interner: &mut NameIdInterner,
    value_interner: &mut Utf8ValueIdInterner,
    element_stack: &mut Vec<Vec<u8>>,
) -> MarkupResult {
    if position + 1 >= input.len() {
        return MarkupResult::Incomplete;
    }
    match input[position + 1] {
        b'/' => parse_end_tag(
            input,
            position,
            table,
            name_interner,
            value_interner,
            element_stack,
        ),
        b'!' => parse_bang(input, position, table, name_interner, value_interner),
        b'?' => parse_processing_instruction(input, position),
        _ => parse_start_tag(
            input,
            position,
            table,
            name_interner,
            value_interner,
            element_stack,
        ),
    }
}

fn parse_bang<B: StreamingBatchBuilder>(
    input: &[u8],
    position: usize,
    table: &mut B,
    name_interner: &mut NameIdInterner,
    value_interner: &mut Utf8ValueIdInterner,
) -> MarkupResult {
    if starts_with(input, position, b"<![CDATA[") {
        let Some(end) = find_bytes(input, b"]]>", position + 9) else {
            return MarkupResult::Incomplete;
        };
        return match emit_text(
            table,
            name_interner,
            value_interner,
            input,
            position + 9,
            end,
            CDATA,
        ) {
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

fn parse_end_tag<B: StreamingBatchBuilder>(
    input: &[u8],
    position: usize,
    table: &mut B,
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

fn parse_start_tag<B: StreamingBatchBuilder>(
    input: &[u8],
    position: usize,
    table: &mut B,
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

fn emit_text<B: StreamingBatchBuilder>(
    table: &mut B,
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

fn push_event<B: StreamingBatchBuilder>(
    table: &mut B,
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
            table.push_attr(
                SpanAttrRecord {
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
                },
                input,
            )?;
        }
    }
    table.push_event(
        SpanEventRecord {
            event_type: event_type as u32,
            name_start,
            name_end,
            text_start,
            text_end,
            attr_start,
            attr_count,
            name_id,
            text_value_id,
        },
        input,
    )
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

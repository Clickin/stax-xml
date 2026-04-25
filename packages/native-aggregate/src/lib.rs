use memchr::memchr;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::fs;
use std::mem::MaybeUninit;

const START_DOCUMENT: u8 = 0;
const END_DOCUMENT: u8 = 1;
const START_ELEMENT: u8 = 2;
const END_ELEMENT: u8 = 3;
const CHARACTERS: u8 = 4;
const CDATA: u8 = 5;
const INLINE_ATTR_SPANS: usize = 16;
const SPAN_TABLE_MAGIC: u32 = 0x3154_5053;
const SPAN_TABLE_HEADER_U32S: usize = 7;
const SPAN_TABLE_HEADER_BYTES: usize = SPAN_TABLE_HEADER_U32S * 4;
const SPAN_TABLE_EVENT_FIELDS: usize = 7;
const SPAN_TABLE_EVENT_BYTES: usize = SPAN_TABLE_EVENT_FIELDS * 4;
const SPAN_TABLE_ATTR_FIELDS: usize = 4;
const SPAN_TABLE_ATTR_BYTES: usize = SPAN_TABLE_ATTR_FIELDS * 4;
const NO_SPAN: i32 = -1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Tier {
    CountOnly,
    FullStringDirect,
    EventObjectFull,
}

#[napi(object)]
pub struct AggregateResult {
    pub tier: String,
    pub input_bytes: f64,
    pub event_count: u32,
    pub checksum: i32,
    pub attr_count_total: u32,
    pub object_count: u32,
}

#[repr(C)]
pub struct FfiAggregateResult {
    pub event_count: u32,
    pub checksum: i32,
    pub attr_count_total: u32,
    pub object_count: u32,
    pub input_units: usize,
}

#[derive(Default)]
struct AggregateState {
    event_count: u32,
    checksum: i32,
    attr_count_total: u32,
    object_count: u32,
    object_sink: Vec<Option<NativeEventObject>>,
}

struct NativeEventObject {
    event_type: u8,
    name: Option<String>,
    text: Option<String>,
    attributes: Vec<(String, String)>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct AttrSpan {
    name_start: usize,
    name_end: usize,
    value_start: usize,
    value_end: usize,
}

struct AttrSpans {
    len: usize,
    inline: [MaybeUninit<AttrSpan>; INLINE_ATTR_SPANS],
    overflow: Vec<AttrSpan>,
}

struct AttrSpanIter<'a> {
    spans: &'a AttrSpans,
    index: usize,
}

struct Parser<'a> {
    input: &'a [u8],
    tier: Tier,
    state: AggregateState,
    element_stack: Vec<(usize, usize)>,
}

struct Utf16Parser<'a> {
    input: &'a [u16],
    tier: Tier,
    state: AggregateState,
    element_stack: Vec<(usize, usize)>,
}

struct SpanTableUtf16Parser<'a> {
    input: &'a [u16],
    events: Vec<SpanEventRecord>,
    attrs: Vec<SpanAttrRecord>,
    element_stack: Vec<(usize, usize)>,
}

struct SpanEventRecord {
    event_type: u32,
    name_start: i32,
    name_end: i32,
    text_start: i32,
    text_end: i32,
    attr_start: u32,
    attr_count: u32,
}

struct SpanAttrRecord {
    name_start: i32,
    name_end: i32,
    value_start: i32,
    value_end: i32,
}

#[napi]
pub fn parse_aggregate_buffer(input: Buffer, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    parse_aggregate(input.as_ref(), tier)
}

#[napi]
pub fn parse_aggregate_uint8array(input: Uint8Array, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    parse_aggregate(input.as_ref(), tier)
}

#[napi]
pub fn parse_aggregate_file(path: String, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    let bytes = fs::read(path).map_err(|error| Error::from_reason(error.to_string()))?;
    parse_aggregate(&bytes, tier)
}

#[napi]
pub fn parse_aggregate_string_utf8(input: String, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    parse_aggregate(input.as_bytes(), tier)
}

#[napi]
pub fn parse_aggregate_string_utf16(input: Utf16String, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    parse_aggregate_utf16(&input, tier)
}

#[napi]
pub fn parse_span_table_string_utf16(input: Utf16String) -> Result<Buffer> {
    parse_span_table_utf16(&input).map(Buffer::from)
}

#[no_mangle]
/// Parses UTF-16 XML code units through the aggregate scanner C ABI.
///
/// # Safety
///
/// `input` must point to `len` readable UTF-16 code units and `out` must point
/// to writable storage for one `FfiAggregateResult`. Both pointers must remain
/// valid for the duration of the call and must not alias in a way that violates
/// Rust's aliasing rules.
pub unsafe extern "C" fn stax_xml_parse_aggregate_utf16_units(
    input: *const u16,
    len: usize,
    tier_id: u32,
    out: *mut FfiAggregateResult,
) -> i32 {
    if input.is_null() || out.is_null() {
        return -1;
    }
    let tier = match tier_id {
        0 => Tier::CountOnly,
        1 => Tier::FullStringDirect,
        2 => Tier::EventObjectFull,
        _ => return -3,
    };
    let input = unsafe { std::slice::from_raw_parts(input, len) };
    match parse_aggregate_utf16(input, tier) {
        Ok(result) => {
            unsafe {
                *out = FfiAggregateResult {
                    event_count: result.event_count,
                    checksum: result.checksum,
                    attr_count_total: result.attr_count_total,
                    object_count: result.object_count,
                    input_units: len,
                };
            }
            0
        }
        Err(_) => -2,
    }
}

fn parse_tier(value: &str) -> Result<Tier> {
    match value {
        "count-only" => Ok(Tier::CountOnly),
        "full-string-direct" => Ok(Tier::FullStringDirect),
        "event-object-full" => Ok(Tier::EventObjectFull),
        _ => Err(Error::from_reason(format!(
            "Unknown native aggregate tier: {value}"
        ))),
    }
}

fn parse_aggregate(input: &[u8], tier: Tier) -> Result<AggregateResult> {
    let mut parser = Parser {
        input,
        tier,
        state: AggregateState {
            object_sink: if tier == Tier::EventObjectFull {
                (0..1024).map(|_| None).collect()
            } else {
                Vec::new()
            },
            ..AggregateState::default()
        },
        element_stack: Vec::new(),
    };
    parser.parse()?;
    Ok(AggregateResult {
        tier: tier_name(tier).to_string(),
        input_bytes: input.len() as f64,
        event_count: parser.state.event_count,
        checksum: parser.state.checksum,
        attr_count_total: parser.state.attr_count_total,
        object_count: parser.state.object_count,
    })
}

fn parse_aggregate_utf16(input: &[u16], tier: Tier) -> Result<AggregateResult> {
    let mut parser = Utf16Parser {
        input,
        tier,
        state: AggregateState {
            object_sink: if tier == Tier::EventObjectFull {
                (0..1024).map(|_| None).collect()
            } else {
                Vec::new()
            },
            ..AggregateState::default()
        },
        element_stack: Vec::new(),
    };
    parser.parse()?;
    Ok(AggregateResult {
        tier: tier_name(tier).to_string(),
        input_bytes: (input.len() * 2) as f64,
        event_count: parser.state.event_count,
        checksum: parser.state.checksum,
        attr_count_total: parser.state.attr_count_total,
        object_count: parser.state.object_count,
    })
}

fn parse_span_table_utf16(input: &[u16]) -> Result<Vec<u8>> {
    let mut parser = SpanTableUtf16Parser {
        input,
        events: Vec::new(),
        attrs: Vec::new(),
        element_stack: Vec::new(),
    };
    parser.parse()?;
    encode_span_table(input.len(), &parser.events, &parser.attrs)
}

fn tier_name(tier: Tier) -> &'static str {
    match tier {
        Tier::CountOnly => "count-only",
        Tier::FullStringDirect => "full-string-direct",
        Tier::EventObjectFull => "event-object-full",
    }
}

impl<'a> Parser<'a> {
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
            let Some(end) = find_gt(self.input, position + 2) else {
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
            if is_whitespace(byte) || byte == b'/' || byte == b'>' {
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
        self.state.event_count = self.state.event_count.wrapping_add(1);
        self.state.checksum = mix_checksum(self.state.checksum, event_type as i32);

        match self.tier {
            Tier::CountOnly => {
                let attr_len = attrs.map_or(0, AttrSpans::len);
                self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
                self.state.attr_count_total =
                    self.state.attr_count_total.wrapping_add(attr_len as u32);
            }
            Tier::FullStringDirect => {
                self.consume_full_string_direct(name, text, attrs)?;
            }
            Tier::EventObjectFull => {
                self.consume_event_object_full(event_type, name, text, attrs)?;
            }
        }

        Ok(())
    }

    fn consume_full_string_direct(
        &mut self,
        name: Option<(usize, usize)>,
        text: Option<(usize, usize)>,
        attrs: Option<&AttrSpans>,
    ) -> Result<()> {
        if let Some((start, end)) = name {
            self.state.checksum = fold_span(self.state.checksum, self.input, start, end)?;
        }
        if let Some((start, end)) = text {
            self.state.checksum = fold_trimmed_span(self.state.checksum, self.input, start, end)?;
        }
        let attr_len = attrs.map_or(0, AttrSpans::len);
        self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
        self.state.attr_count_total = self.state.attr_count_total.wrapping_add(attr_len as u32);
        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
                self.state.checksum = fold_span(
                    self.state.checksum,
                    self.input,
                    attr.name_start,
                    attr.name_end,
                )?;
                self.state.checksum = fold_span(
                    self.state.checksum,
                    self.input,
                    attr.value_start,
                    attr.value_end,
                )?;
            }
        }
        Ok(())
    }

    fn consume_event_object_full(
        &mut self,
        event_type: u8,
        name: Option<(usize, usize)>,
        text: Option<(usize, usize)>,
        attrs: Option<&AttrSpans>,
    ) -> Result<()> {
        let name = match name {
            Some((start, end)) => {
                let value = materialize_span(self.input, start, end)?;
                self.state.checksum = fold_string(self.state.checksum, &value);
                Some(value)
            }
            None => None,
        };
        let text = match text {
            Some((start, end)) => {
                let value = materialize_span(self.input, start, end)?;
                self.state.checksum = fold_string(self.state.checksum, value.trim());
                Some(value)
            }
            None => None,
        };
        let attr_len = attrs.map_or(0, AttrSpans::len);
        self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
        self.state.attr_count_total = self.state.attr_count_total.wrapping_add(attr_len as u32);

        let mut attributes = Vec::with_capacity(attr_len);
        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
                let attr_name = materialize_span(self.input, attr.name_start, attr.name_end)?;
                let attr_value = materialize_span(self.input, attr.value_start, attr.value_end)?;
                self.state.checksum = fold_string(self.state.checksum, &attr_name);
                self.state.checksum = fold_string(self.state.checksum, &attr_value);
                attributes.push((attr_name, attr_value));
            }
        }

        let object = NativeEventObject {
            event_type,
            name,
            text,
            attributes,
        };
        self.state.object_count = self.state.object_count.wrapping_add(1);
        let slot = (self.state.object_count as usize - 1) & (self.state.object_sink.len() - 1);
        self.state.object_sink[slot] = Some(object);
        Ok(())
    }
}

impl<'a> Utf16Parser<'a> {
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
            let Some(end) = find_gt_utf16(self.input, position + 2) else {
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
            if is_whitespace_u16(unit) || unit == b'/' as u16 || unit == b'>' as u16 {
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
        self.state.event_count = self.state.event_count.wrapping_add(1);
        self.state.checksum = mix_checksum(self.state.checksum, event_type as i32);

        match self.tier {
            Tier::CountOnly => {
                let attr_len = attrs.map_or(0, AttrSpans::len);
                self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
                self.state.attr_count_total =
                    self.state.attr_count_total.wrapping_add(attr_len as u32);
            }
            Tier::FullStringDirect => {
                self.consume_full_string_direct(name, text, attrs);
            }
            Tier::EventObjectFull => {
                self.consume_event_object_full(event_type, name, text, attrs)?;
            }
        }

        Ok(())
    }

    fn consume_full_string_direct(
        &mut self,
        name: Option<(usize, usize)>,
        text: Option<(usize, usize)>,
        attrs: Option<&AttrSpans>,
    ) {
        if let Some((start, end)) = name {
            self.state.checksum = fold_units(self.state.checksum, self.input, start, end);
        }
        if let Some((start, end)) = text {
            self.state.checksum = fold_trimmed_units(self.state.checksum, self.input, start, end);
        }
        let attr_len = attrs.map_or(0, AttrSpans::len);
        self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
        self.state.attr_count_total = self.state.attr_count_total.wrapping_add(attr_len as u32);
        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
                self.state.checksum = fold_units(
                    self.state.checksum,
                    self.input,
                    attr.name_start,
                    attr.name_end,
                );
                self.state.checksum = fold_units(
                    self.state.checksum,
                    self.input,
                    attr.value_start,
                    attr.value_end,
                );
            }
        }
    }

    fn consume_event_object_full(
        &mut self,
        event_type: u8,
        name: Option<(usize, usize)>,
        text: Option<(usize, usize)>,
        attrs: Option<&AttrSpans>,
    ) -> Result<()> {
        let name = match name {
            Some((start, end)) => {
                let value = materialize_units(self.input, start, end)?;
                self.state.checksum = fold_string(self.state.checksum, &value);
                Some(value)
            }
            None => None,
        };
        let text = match text {
            Some((start, end)) => {
                let value = materialize_units(self.input, start, end)?;
                self.state.checksum = fold_string(self.state.checksum, value.trim());
                Some(value)
            }
            None => None,
        };
        let attr_len = attrs.map_or(0, AttrSpans::len);
        self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
        self.state.attr_count_total = self.state.attr_count_total.wrapping_add(attr_len as u32);

        let mut attributes = Vec::with_capacity(attr_len);
        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
                let attr_name = materialize_units(self.input, attr.name_start, attr.name_end)?;
                let attr_value = materialize_units(self.input, attr.value_start, attr.value_end)?;
                self.state.checksum = fold_string(self.state.checksum, &attr_name);
                self.state.checksum = fold_string(self.state.checksum, &attr_value);
                attributes.push((attr_name, attr_value));
            }
        }

        let object = NativeEventObject {
            event_type,
            name,
            text,
            attributes,
        };
        self.state.object_count = self.state.object_count.wrapping_add(1);
        let slot = (self.state.object_count as usize - 1) & (self.state.object_sink.len() - 1);
        self.state.object_sink[slot] = Some(object);
        Ok(())
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
            let Some(end) = find_gt_utf16(self.input, position + 2) else {
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
            if is_whitespace_u16(unit) || unit == b'/' as u16 || unit == b'>' as u16 {
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
        let attr_start = to_u32_count(self.attrs.len(), "span table attr start")?;
        let attr_count = attrs.map_or(0, AttrSpans::len);
        let attr_count = to_u32_count(attr_count, "span table attr count")?;
        let (name_start, name_end) = encode_optional_span(name)?;
        let (text_start, text_end) = encode_optional_span(text)?;

        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
                self.attrs.push(SpanAttrRecord {
                    name_start: to_i32_span(attr.name_start)?,
                    name_end: to_i32_span(attr.name_end)?,
                    value_start: to_i32_span(attr.value_start)?,
                    value_end: to_i32_span(attr.value_end)?,
                });
            }
        }

        self.events.push(SpanEventRecord {
            event_type: event_type as u32,
            name_start,
            name_end,
            text_start,
            text_end,
            attr_start,
            attr_count,
        });
        Ok(())
    }
}

impl Drop for NativeEventObject {
    fn drop(&mut self) {
        let _ = self.event_type;
        let _ = self.name.as_deref();
        let _ = self.text.as_deref();
        let _ = self.attributes.len();
    }
}

fn parse_attributes(input: &[u8], start: usize, end: usize) -> AttrSpans {
    let mut attrs = AttrSpans::new();
    let mut index = start;
    while index < end {
        while index < end && is_whitespace(input[index]) {
            index += 1;
        }
        if index >= end {
            break;
        }

        let name_start = index;
        while index < end && input[index] != b'=' && !is_whitespace(input[index]) {
            index += 1;
        }
        let name_end = index;

        while index < end && is_whitespace(input[index]) {
            index += 1;
        }
        if index >= end || input[index] != b'=' {
            attrs.push(AttrSpan {
                name_start,
                name_end,
                value_start: name_start,
                value_end: name_end,
            });
            continue;
        }

        index += 1;
        while index < end && is_whitespace(input[index]) {
            index += 1;
        }
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

fn parse_attributes_utf16(input: &[u16], start: usize, end: usize) -> AttrSpans {
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

    fn len(&self) -> usize {
        self.len
    }

    fn iter(&self) -> AttrSpanIter<'_> {
        AttrSpanIter {
            spans: self,
            index: 0,
        }
    }

    #[cfg(test)]
    fn overflow_len_for_test(&self) -> usize {
        self.overflow.len()
    }

    #[cfg(test)]
    fn to_vec_for_test(&self) -> Vec<AttrSpan> {
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

fn materialize_span(input: &[u8], start: usize, end: usize) -> Result<String> {
    std::str::from_utf8(&input[start..end])
        .map(|value| value.to_owned())
        .map_err(|error| Error::from_reason(error.to_string()))
}

fn materialize_units(input: &[u16], start: usize, end: usize) -> Result<String> {
    String::from_utf16(&input[start..end]).map_err(|error| Error::from_reason(error.to_string()))
}

fn fold_span(seed: i32, input: &[u8], start: usize, end: usize) -> Result<i32> {
    std::str::from_utf8(&input[start..end])
        .map(|value| fold_string(seed, value))
        .map_err(|error| Error::from_reason(error.to_string()))
}

fn fold_trimmed_span(seed: i32, input: &[u8], start: usize, end: usize) -> Result<i32> {
    std::str::from_utf8(&input[start..end])
        .map(|value| fold_string(seed, value.trim()))
        .map_err(|error| Error::from_reason(error.to_string()))
}

fn fold_units(seed: i32, input: &[u16], start: usize, end: usize) -> i32 {
    let mut next = seed;
    for unit in input[start..end].iter().copied() {
        next = next.wrapping_mul(31).wrapping_add(unit as i32);
    }
    next
}

fn fold_trimmed_units(seed: i32, input: &[u16], start: usize, end: usize) -> i32 {
    let (start, end) = trim_units(input, start, end);
    fold_units(seed, input, start, end)
}

fn trim_units(input: &[u16], mut start: usize, mut end: usize) -> (usize, usize) {
    while start < end && is_js_trim_whitespace_u16(input[start]) {
        start += 1;
    }
    while end > start && is_js_trim_whitespace_u16(input[end - 1]) {
        end -= 1;
    }
    (start, end)
}

fn encode_span_table(
    input_units: usize,
    events: &[SpanEventRecord],
    attrs: &[SpanAttrRecord],
) -> Result<Vec<u8>> {
    let event_count = to_u32_count(events.len(), "span table event count")?;
    let attr_count = to_u32_count(attrs.len(), "span table attr count")?;
    let input_units = to_u32_count(input_units, "span table input units")?;
    let event_bytes = events
        .len()
        .checked_mul(SPAN_TABLE_EVENT_BYTES)
        .ok_or_else(|| Error::from_reason("Span table event byte size overflow"))?;
    let attr_bytes = attrs
        .len()
        .checked_mul(SPAN_TABLE_ATTR_BYTES)
        .ok_or_else(|| Error::from_reason("Span table attr byte size overflow"))?;
    let total_bytes = SPAN_TABLE_HEADER_BYTES
        .checked_add(event_bytes)
        .and_then(|value| value.checked_add(attr_bytes))
        .ok_or_else(|| Error::from_reason("Span table byte size overflow"))?;

    let mut out = Vec::with_capacity(total_bytes);
    push_u32(&mut out, SPAN_TABLE_MAGIC);
    push_u32(&mut out, event_count);
    push_u32(&mut out, attr_count);
    push_u32(&mut out, input_units);
    push_u32(&mut out, SPAN_TABLE_EVENT_BYTES as u32);
    push_u32(&mut out, SPAN_TABLE_ATTR_BYTES as u32);
    push_u32(&mut out, 0);

    for event in events {
        push_u32(&mut out, event.event_type);
        push_i32(&mut out, event.name_start);
        push_i32(&mut out, event.name_end);
        push_i32(&mut out, event.text_start);
        push_i32(&mut out, event.text_end);
        push_u32(&mut out, event.attr_start);
        push_u32(&mut out, event.attr_count);
    }

    for attr in attrs {
        push_i32(&mut out, attr.name_start);
        push_i32(&mut out, attr.name_end);
        push_i32(&mut out, attr.value_start);
        push_i32(&mut out, attr.value_end);
    }

    debug_assert_eq!(out.len(), total_bytes);
    Ok(out)
}

fn encode_optional_span(span: Option<(usize, usize)>) -> Result<(i32, i32)> {
    match span {
        Some((start, end)) => Ok((to_i32_span(start)?, to_i32_span(end)?)),
        None => Ok((NO_SPAN, NO_SPAN)),
    }
}

fn to_i32_span(value: usize) -> Result<i32> {
    i32::try_from(value).map_err(|_| Error::from_reason("Span table offset exceeded i32 range"))
}

fn to_u32_count(value: usize, label: &str) -> Result<u32> {
    u32::try_from(value).map_err(|_| Error::from_reason(format!("{label} exceeded u32 range")))
}

fn push_u32(out: &mut Vec<u8>, value: u32) {
    out.extend_from_slice(&value.to_le_bytes());
}

fn push_i32(out: &mut Vec<u8>, value: i32) {
    out.extend_from_slice(&value.to_le_bytes());
}

fn mix_checksum(seed: i32, value: i32) -> i32 {
    (seed ^ value).wrapping_mul(16_777_619)
}

fn fold_string(seed: i32, value: &str) -> i32 {
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
fn fold_string_reference(seed: i32, value: &str) -> i32 {
    let mut next = seed;
    for code_unit in value.encode_utf16() {
        next = next.wrapping_mul(31).wrapping_add(code_unit as i32);
    }
    next
}

fn starts_with(input: &[u8], position: usize, value: &[u8]) -> bool {
    position + value.len() <= input.len() && &input[position..position + value.len()] == value
}

fn starts_with_ascii_u16(input: &[u16], position: usize, value: &[u8]) -> bool {
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

fn find_bytes(input: &[u8], needle: &[u8], from: usize) -> Option<usize> {
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

fn find_ascii_sequence_u16(input: &[u16], needle: &[u8], from: usize) -> Option<usize> {
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

fn find_unit(input: &[u16], needle: u16, from: usize, until: usize) -> Option<usize> {
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

fn find_gt(input: &[u8], from: usize) -> Option<usize> {
    memchr(b'>', &input[from..]).map(|offset| from + offset)
}

fn find_gt_utf16(input: &[u16], from: usize) -> Option<usize> {
    find_unit(input, b'>' as u16, from, input.len())
}

fn find_tag_end(input: &[u8], from: usize) -> Option<usize> {
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

fn find_tag_end_utf16(input: &[u16], from: usize) -> Option<usize> {
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

fn is_whitespace(byte: u8) -> bool {
    matches!(byte, b' ' | b'\t' | b'\n' | b'\r')
}

fn is_whitespace_u16(unit: u16) -> bool {
    matches!(unit, 0x20 | 0x09 | 0x0a | 0x0d)
}

fn is_js_trim_whitespace_u16(unit: u16) -> bool {
    matches!(
        unit,
        0x0009 | 0x000a | 0x000b | 0x000c | 0x000d | 0x0020 | 0x00a0 | 0x1680 | 0x2000
            ..=0x200a | 0x2028 | 0x2029 | 0x202f | 0x205f | 0x3000 | 0xfeff
    )
}

fn is_whitespace_only(input: &[u8], start: usize, end: usize) -> bool {
    input[start..end].iter().all(|byte| is_whitespace(*byte))
}

fn is_whitespace_only_u16(input: &[u16], start: usize, end: usize) -> bool {
    input[start..end]
        .iter()
        .all(|unit| is_whitespace_u16(*unit))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tag_end_ignores_gt_inside_double_and_single_quotes() {
        let input = br#"<item expr="left > right" single='alpha > beta'><name>ok</name></item>"#;

        let end = find_tag_end(input, 1).expect("start tag should close");

        assert_eq!(input[end], b'>');
        assert_eq!(&input[end - 5..=end], b"beta'>");
    }

    #[test]
    fn tag_end_rejects_incomplete_quoted_tail() {
        let input = br#"<item expr="left > right"#;

        assert_eq!(find_tag_end(input, 1), None);
    }

    #[test]
    fn attributes_keep_quoted_gt_inside_values() {
        let input = br#"<item expr="left > right" single='alpha > beta'>"#;
        let tag_end = find_tag_end(input, 1).expect("start tag should close");
        let attrs = parse_attributes(input, 5, tag_end);

        assert_eq!(attrs.len(), 2);
        let attrs = attrs.to_vec_for_test();
        assert_eq!(&input[attrs[0].name_start..attrs[0].name_end], b"expr");
        assert_eq!(
            &input[attrs[0].value_start..attrs[0].value_end],
            b"left > right"
        );
        assert_eq!(&input[attrs[1].name_start..attrs[1].name_end], b"single");
        assert_eq!(
            &input[attrs[1].value_start..attrs[1].value_end],
            b"alpha > beta"
        );
    }

    #[test]
    fn attr_heavy_fixture_shape_stays_inline() {
        let input = br#"<item a0="0" a1="1" a2="2" a3="3" a4="4" a5="5" a6="6" a7="7" a8="8" a9="9" a10="10" a11="11">"#;
        let tag_end = find_tag_end(input, 1).expect("start tag should close");
        let attrs = parse_attributes(input, 5, tag_end);

        assert_eq!(attrs.len(), 12);
        assert_eq!(attrs.overflow_len_for_test(), 0);
        let attr_names: Vec<&[u8]> = attrs
            .iter()
            .map(|attr| &input[attr.name_start..attr.name_end])
            .collect();
        assert_eq!(attr_names.first().copied(), Some(&b"a0"[..]));
        assert_eq!(attr_names.last().copied(), Some(&b"a11"[..]));
    }

    #[test]
    fn fold_string_fast_path_matches_utf16_reference() {
        let samples = ["ascii-value-123", "본문 café 🌊", "emoji-🌊-suffix"];

        for sample in samples {
            assert_eq!(fold_string(17, sample), fold_string_reference(17, sample));
        }
    }

    #[test]
    fn fold_span_variants_match_materialized_reference() {
        let input = "  ascii-value  <x>본문 café 🌊</x>".as_bytes();

        let ascii = std::str::from_utf8(&input[2..13]).unwrap();
        assert_eq!(fold_span(31, input, 2, 13).unwrap(), fold_string(31, ascii));

        let text = std::str::from_utf8(&input[0..15]).unwrap();
        assert_eq!(
            fold_trimmed_span(31, input, 0, 15).unwrap(),
            fold_string(31, text.trim())
        );
    }

    #[test]
    fn utf16_aggregate_matches_utf8_parser() {
        let sample =
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE root><root><item a=\"1 > 0\" b='x > y'>안녕</item><![CDATA[<raw>value</raw>]]><empty /></root>";
        let units: Vec<u16> = sample.encode_utf16().collect();

        for tier in [
            Tier::CountOnly,
            Tier::FullStringDirect,
            Tier::EventObjectFull,
        ] {
            let byte_result = parse_aggregate(sample.as_bytes(), tier).unwrap();
            let utf16_result = parse_aggregate_utf16(&units, tier).unwrap();

            assert_eq!(utf16_result.event_count, byte_result.event_count);
            assert_eq!(utf16_result.checksum, byte_result.checksum);
            assert_eq!(utf16_result.attr_count_total, byte_result.attr_count_total);
        }
    }

    #[test]
    fn span_table_utf16_records_events_and_attrs() {
        let sample =
            "<root><item a=\"1 > 0\" b='x > y'>안녕</item><![CDATA[<raw>value</raw>]]><empty /></root>";
        let units: Vec<u16> = sample.encode_utf16().collect();
        let aggregate = parse_aggregate_utf16(&units, Tier::CountOnly).unwrap();

        let table = parse_span_table_utf16(&units).unwrap();

        assert_eq!(read_u32(&table, 0), SPAN_TABLE_MAGIC);
        assert_eq!(read_u32(&table, 4), aggregate.event_count);
        assert_eq!(read_u32(&table, 8), aggregate.attr_count_total);
        assert_eq!(read_u32(&table, 12), units.len() as u32);
        assert_eq!(read_u32(&table, 16), SPAN_TABLE_EVENT_BYTES as u32);
        assert_eq!(read_u32(&table, 20), SPAN_TABLE_ATTR_BYTES as u32);

        let event_stride = read_u32(&table, 16) as usize;
        let attr_stride = read_u32(&table, 20) as usize;
        let item_event = SPAN_TABLE_HEADER_BYTES + event_stride * 2;
        assert_eq!(read_u32(&table, item_event), START_ELEMENT as u32);
        assert_eq!(
            span_to_string(
                &units,
                read_i32(&table, item_event + 4),
                read_i32(&table, item_event + 8)
            ),
            "item"
        );
        assert_eq!(read_u32(&table, item_event + 24), 2);

        let attr_start = read_u32(&table, item_event + 20) as usize;
        let attr_base = SPAN_TABLE_HEADER_BYTES
            + event_stride * aggregate.event_count as usize
            + attr_stride * attr_start;
        assert_eq!(
            span_to_string(
                &units,
                read_i32(&table, attr_base),
                read_i32(&table, attr_base + 4)
            ),
            "a"
        );
        assert_eq!(
            span_to_string(
                &units,
                read_i32(&table, attr_base + 8),
                read_i32(&table, attr_base + 12)
            ),
            "1 > 0"
        );
    }

    #[test]
    fn utf16_tag_end_rejects_incomplete_quoted_tail() {
        let input: Vec<u16> = "<item expr=\"left > right".encode_utf16().collect();

        assert_eq!(find_tag_end_utf16(&input, 1), None);
    }

    #[test]
    fn ffi_utf16_units_reports_aggregate() {
        let sample = "<root><item a=\"1\">안녕</item></root>";
        let units: Vec<u16> = sample.encode_utf16().collect();
        let mut out = FfiAggregateResult {
            event_count: 0,
            checksum: 0,
            attr_count_total: 0,
            object_count: 0,
            input_units: 0,
        };

        let status = unsafe {
            stax_xml_parse_aggregate_utf16_units(units.as_ptr(), units.len(), 1, &mut out)
        };

        assert_eq!(status, 0);
        assert_eq!(out.input_units, units.len());
        assert!(out.event_count > 0);
        assert_eq!(out.attr_count_total, 1);
    }

    fn read_u32(input: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes(input[offset..offset + 4].try_into().unwrap())
    }

    fn read_i32(input: &[u8], offset: usize) -> i32 {
        i32::from_le_bytes(input[offset..offset + 4].try_into().unwrap())
    }

    fn span_to_string(input: &[u16], start: i32, end: i32) -> String {
        String::from_utf16(&input[start as usize..end as usize]).unwrap()
    }
}

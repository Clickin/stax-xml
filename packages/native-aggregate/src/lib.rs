// simdxml notice:
// The native aggregate structural-scanner diagnostics and quote-skipping
// scanner shape are informed by and partially adapted from simdxml
// (https://github.com/simdxml/simdxml), which is licensed MIT OR Apache-2.0.
// stax-xml uses those ideas under simdxml's MIT license option.
use memchr::memchr;
use napi::bindgen_prelude::*;
use napi_derive::napi;
#[cfg(target_arch = "aarch64")]
use std::arch::aarch64::*;
#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;
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
    EventCountUnsafeGt,
    EventCountByteLoop,
    EventCountSkipQuotes,
    EventCountNoText,
    EventCountNoChecksum,
    EventCountNoTextNoChecksum,
    EventCountTwoStage,
    EventCountAutoStage,
    EventCountUnchecked,
    EventCountOnly,
    CountOnly,
    CountEqTwoStage,
    CountAutoStage,
    NameStringOnly,
    TextStringOnly,
    AttrValueStringOnly,
    FullStringDirect,
    EventObjectFull,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SimdPolicy {
    Auto,
    Off,
    Avx2,
    Sse42,
    Neon,
}

impl Tier {
    fn needs_start_attributes(self) -> bool {
        !matches!(
            self,
            Self::EventCountUnsafeGt
                | Self::EventCountUnchecked
                | Self::EventCountByteLoop
                | Self::EventCountSkipQuotes
                | Self::EventCountNoText
                | Self::EventCountNoChecksum
                | Self::EventCountNoTextNoChecksum
                | Self::EventCountTwoStage
                | Self::EventCountAutoStage
                | Self::EventCountOnly
                | Self::NameStringOnly
                | Self::TextStringOnly
        )
    }

    fn validates_element_stack(self) -> bool {
        !matches!(
            self,
            Self::EventCountUnsafeGt
                | Self::EventCountByteLoop
                | Self::EventCountSkipQuotes
                | Self::EventCountNoText
                | Self::EventCountNoChecksum
                | Self::EventCountNoTextNoChecksum
                | Self::EventCountTwoStage
                | Self::EventCountAutoStage
                | Self::CountEqTwoStage
                | Self::CountAutoStage
                | Self::EventCountUnchecked
        )
    }

    fn tag_end_strategy(self) -> TagEndStrategy {
        match self {
            Self::EventCountUnsafeGt => TagEndStrategy::UnsafeGt,
            Self::EventCountByteLoop => TagEndStrategy::ByteLoop,
            Self::EventCountSkipQuotes => TagEndStrategy::SkipQuotes,
            _ => TagEndStrategy::Default,
        }
    }

    fn skips_text_events(self) -> bool {
        matches!(
            self,
            Self::EventCountNoText | Self::EventCountNoTextNoChecksum
        )
    }

    fn folds_event_checksum(self) -> bool {
        !matches!(
            self,
            Self::EventCountNoChecksum | Self::EventCountNoTextNoChecksum
        )
    }

    fn needs_start_name(self) -> bool {
        self.validates_element_stack() || self.needs_start_attributes()
    }

    fn uses_two_stage_bytes(self) -> bool {
        matches!(self, Self::EventCountTwoStage | Self::CountEqTwoStage)
    }

    fn uses_auto_stage_bytes(self) -> bool {
        matches!(self, Self::EventCountAutoStage | Self::CountAutoStage)
    }

    fn uses_fast_event_count_bytes(self) -> bool {
        matches!(
            self,
            Self::EventCountNoText | Self::EventCountNoTextNoChecksum
        )
    }
}

#[derive(Clone, Copy)]
enum TagEndStrategy {
    Default,
    ByteLoop,
    SkipQuotes,
    UnsafeGt,
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

#[napi(object)]
pub struct ItemProjectionResult {
    pub input_bytes: f64,
    pub item_count: u32,
    pub checksum: i32,
}

#[napi(object)]
pub struct ItemProjectionRecord {
    pub id: i32,
    pub name: String,
    pub value: String,
}

#[napi(object)]
pub struct ItemProjectionRowsResult {
    pub input_bytes: f64,
    pub event_count: u32,
    pub max_depth: u32,
    pub rows: Vec<ItemProjectionRecord>,
}

#[napi(object)]
pub struct ObjectRowsProjectionSpec {
    pub item_name: String,
    pub fields: Vec<ObjectRowsProjectionFieldSpec>,
}

#[napi(object)]
pub struct ObjectRowsProjectionFieldSpec {
    pub output_name: String,
    pub value_kind: String,
    pub source_kind: String,
    pub source_name: String,
    pub text_mode: String,
}

#[napi(object)]
pub struct ObjectRowsProjectionColumn {
    pub present: Vec<bool>,
    pub values: Vec<String>,
    pub number_values: Vec<f64>,
    pub span_starts: Vec<i32>,
    pub span_ends: Vec<i32>,
}

#[napi(object)]
pub struct ObjectRowsProjectionResult {
    pub input_bytes: f64,
    pub event_count: u32,
    pub max_depth: u32,
    pub field_count: u32,
    pub row_count: u32,
    pub columns: Vec<ObjectRowsProjectionColumn>,
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

struct SpanTableParser<'a> {
    input: &'a [u8],
    table: SpanTableBuilder,
    element_stack: Vec<(usize, usize)>,
}

struct SpanTableBuilder {
    input_units: u32,
    flags: u32,
    table: Vec<u8>,
    attrs: Vec<u8>,
    event_count: u32,
    attr_count: u32,
}

struct ItemProjectionParser<'a> {
    input: &'a [u8],
    rows: Vec<ItemProjectionRow>,
    element_stack: Vec<(usize, usize)>,
    current_item: Option<CurrentItemProjection>,
    capture: Option<ItemProjectionCapture>,
}

struct ObjectRowsProjectionParser<'a> {
    input: &'a [u8],
    spec: NormalizedObjectRowsSpec,
    state: ObjectRowsProjectionState,
    event_count: u32,
    element_stack: Vec<(usize, usize)>,
}

#[derive(Clone, Copy)]
struct ItemProjectionRow {
    id: i32,
    name_start: usize,
    name_end: usize,
    value_start: usize,
    value_end: usize,
}

struct CurrentItemProjection {
    depth: usize,
    id: i32,
    name: Option<(usize, usize)>,
    value: Option<(usize, usize)>,
}

#[derive(Clone, Copy)]
enum ItemProjectionField {
    Name,
    Value,
}

#[derive(Clone, Copy)]
struct ItemProjectionCapture {
    depth: usize,
    field: ItemProjectionField,
}

struct SpanTableUtf16Parser<'a> {
    input: &'a [u16],
    table: SpanTableBuilder,
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

struct ParsedSpanTable<'a> {
    events: &'a [u8],
    attrs: &'a [u8],
    event_count: u32,
    attr_count: u32,
    input_units: u32,
    flags: u32,
}

#[derive(Clone, Copy)]
struct TableEventRecord {
    event_type: u32,
    name_start: i32,
    name_end: i32,
    text_start: i32,
    text_end: i32,
    attr_start: u32,
    attr_count: u32,
}

#[derive(Clone, Copy)]
struct TableAttrRecord {
    name_start: i32,
    name_end: i32,
    value_start: i32,
    value_end: i32,
}

struct TableProjectionState {
    depth: usize,
    max_depth: usize,
    current_item: Option<CurrentItemProjection>,
    capture: Option<ItemProjectionCapture>,
    rows: Vec<ItemProjectionRow>,
}

struct TableProjectionOutcome {
    event_count: u32,
    max_depth: usize,
    rows: Vec<ItemProjectionRow>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ObjectRowsSourceKind {
    Attribute,
    Element,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ObjectRowsTextMode {
    Direct,
    Subtree,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ObjectRowsValueKind {
    String,
    Number,
}

struct NormalizedObjectRowsField {
    value_kind: ObjectRowsValueKind,
    source_kind: ObjectRowsSourceKind,
    source_name: Vec<u8>,
    text_mode: ObjectRowsTextMode,
}

struct NormalizedObjectRowsSpec {
    item_name: Vec<u8>,
    fields: Vec<NormalizedObjectRowsField>,
}

struct ObjectRowsProjectionState {
    depth: usize,
    max_depth: usize,
    current_row: Option<CurrentObjectRowsProjection>,
    capture: Option<ObjectRowsProjectionCapture>,
    row_count: usize,
    columns: Vec<ObjectRowsProjectionColumn>,
}

struct CurrentObjectRowsProjection {
    depth: usize,
    completed: Vec<bool>,
    present: Vec<bool>,
    values: Vec<String>,
    number_values: Vec<f64>,
    number_buffers: Vec<Vec<u8>>,
}

struct ObjectRowsProjectionCapture {
    depth: usize,
    field_indices: Vec<usize>,
    text_mode: ObjectRowsTextMode,
}

#[napi]
pub fn parse_aggregate_buffer(input: Buffer, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    parse_aggregate(input.as_ref(), tier)
}

#[napi]
pub fn parse_aggregate_buffer_with_simd(
    input: Buffer,
    tier: String,
    simd: String,
) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    let simd = parse_simd_policy(&simd)?;
    parse_aggregate_with_simd_policy(input.as_ref(), tier, simd)
}

#[napi]
pub fn parse_aggregate_uint8array(input: Uint8Array, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    parse_aggregate(input.as_ref(), tier)
}

#[napi]
pub fn parse_aggregate_uint8array_with_simd(
    input: Uint8Array,
    tier: String,
    simd: String,
) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    let simd = parse_simd_policy(&simd)?;
    parse_aggregate_with_simd_policy(input.as_ref(), tier, simd)
}

#[napi]
pub fn parse_aggregate_file(path: String, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    let bytes = fs::read(path).map_err(|error| Error::from_reason(error.to_string()))?;
    parse_aggregate(&bytes, tier)
}

#[napi]
pub fn parse_aggregate_file_with_simd(
    path: String,
    tier: String,
    simd: String,
) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    let simd = parse_simd_policy(&simd)?;
    let bytes = fs::read(path).map_err(|error| Error::from_reason(error.to_string()))?;
    parse_aggregate_with_simd_policy(&bytes, tier, simd)
}

#[napi]
pub fn parse_aggregate_string_utf8(input: String, tier: String) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    parse_aggregate(input.as_bytes(), tier)
}

#[napi]
pub fn parse_aggregate_string_utf8_with_simd(
    input: String,
    tier: String,
    simd: String,
) -> Result<AggregateResult> {
    let tier = parse_tier(&tier)?;
    let simd = parse_simd_policy(&simd)?;
    parse_aggregate_with_simd_policy(input.as_bytes(), tier, simd)
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

#[napi]
pub fn parse_span_table_uint8array(input: Uint8Array) -> Result<Buffer> {
    parse_span_table(input.as_ref()).map(Buffer::from)
}

#[napi]
pub fn parse_structural_index_string_utf16(input: Utf16String) -> Result<Buffer> {
    parse_span_table_utf16(&input).map(Buffer::from)
}

#[napi]
pub fn parse_structural_index_uint8array(input: Uint8Array) -> Result<Buffer> {
    parse_span_table(input.as_ref()).map(Buffer::from)
}

#[napi]
pub fn parse_item_projection_uint8array(input: Uint8Array) -> Result<ItemProjectionResult> {
    parse_item_projection(input.as_ref())
}

#[napi]
pub fn parse_item_projection_via_table_uint8array(
    input: Uint8Array,
) -> Result<ItemProjectionResult> {
    parse_item_projection_via_table(input.as_ref())
}

#[napi]
pub fn parse_item_rows_via_table_uint8array(input: Uint8Array) -> Result<ItemProjectionRowsResult> {
    parse_item_rows_via_table(input.as_ref())
}

#[napi]
pub fn parse_object_rows_via_table_uint8array(
    input: Uint8Array,
    spec: ObjectRowsProjectionSpec,
) -> Result<ObjectRowsProjectionResult> {
    parse_object_rows_via_table(input.as_ref(), &spec)
}

#[napi]
pub fn parse_object_rows_uint8array(
    input: Uint8Array,
    spec: ObjectRowsProjectionSpec,
) -> Result<ObjectRowsProjectionResult> {
    parse_object_rows(input.as_ref(), &spec)
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
        3 => Tier::NameStringOnly,
        4 => Tier::TextStringOnly,
        5 => Tier::AttrValueStringOnly,
        6 => Tier::EventCountOnly,
        7 => Tier::EventCountUnchecked,
        8 => Tier::EventCountUnsafeGt,
        9 => Tier::EventCountByteLoop,
        10 => Tier::EventCountSkipQuotes,
        11 => Tier::EventCountNoText,
        12 => Tier::EventCountTwoStage,
        13 => Tier::CountEqTwoStage,
        14 => Tier::EventCountAutoStage,
        15 => Tier::CountAutoStage,
        16 => Tier::EventCountNoChecksum,
        17 => Tier::EventCountNoTextNoChecksum,
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
        "event-count-unsafe-gt" => Ok(Tier::EventCountUnsafeGt),
        "event-count-byte-loop" => Ok(Tier::EventCountByteLoop),
        "event-count-skip-quotes" => Ok(Tier::EventCountSkipQuotes),
        "event-count-no-text" => Ok(Tier::EventCountNoText),
        "event-count-no-checksum" => Ok(Tier::EventCountNoChecksum),
        "event-count-no-text-no-checksum" => Ok(Tier::EventCountNoTextNoChecksum),
        "event-count-two-stage" => Ok(Tier::EventCountTwoStage),
        "event-count-auto-stage" => Ok(Tier::EventCountAutoStage),
        "event-count-unchecked" => Ok(Tier::EventCountUnchecked),
        "event-count-only" => Ok(Tier::EventCountOnly),
        "count-only" => Ok(Tier::CountOnly),
        "count-eq-two-stage" => Ok(Tier::CountEqTwoStage),
        "count-auto-stage" => Ok(Tier::CountAutoStage),
        "name-string-only" => Ok(Tier::NameStringOnly),
        "text-string-only" => Ok(Tier::TextStringOnly),
        "attr-value-string-only" => Ok(Tier::AttrValueStringOnly),
        "full-string-direct" => Ok(Tier::FullStringDirect),
        "event-object-full" => Ok(Tier::EventObjectFull),
        _ => Err(Error::from_reason(format!(
            "Unknown native aggregate tier: {value}"
        ))),
    }
}

fn parse_simd_policy(value: &str) -> Result<SimdPolicy> {
    match value {
        "" | "auto" | "auto-safe" => Ok(SimdPolicy::Auto),
        "off" | "scalar" => Ok(SimdPolicy::Off),
        "avx2" => Ok(SimdPolicy::Avx2),
        "sse42" | "sse4.2" => Ok(SimdPolicy::Sse42),
        "neon" => Ok(SimdPolicy::Neon),
        _ => Err(Error::from_reason(format!(
            "Unknown native SIMD policy: {value}. Expected auto, off, avx2, sse42, or neon.",
        ))),
    }
}

fn parse_aggregate(input: &[u8], tier: Tier) -> Result<AggregateResult> {
    parse_aggregate_with_simd_policy(input, tier, SimdPolicy::Auto)
}

fn parse_aggregate_with_simd_policy(
    input: &[u8],
    tier: Tier,
    simd: SimdPolicy,
) -> Result<AggregateResult> {
    if tier.uses_auto_stage_bytes() {
        return parse_aggregate_auto_stage(input, tier, simd);
    }
    if tier.uses_two_stage_bytes() {
        return parse_aggregate_two_stage(input, tier, simd);
    }

    parse_aggregate_with_parser(input, tier, tier)
}

fn parse_aggregate_with_parser(
    input: &[u8],
    execution_tier: Tier,
    result_tier: Tier,
) -> Result<AggregateResult> {
    if execution_tier.uses_fast_event_count_bytes() {
        return parse_aggregate_fast_event_count(input, execution_tier, result_tier);
    }

    let mut parser = Parser {
        input,
        tier: execution_tier,
        state: AggregateState {
            object_sink: if execution_tier == Tier::EventObjectFull {
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
        tier: tier_name(result_tier).to_string(),
        input_bytes: input.len() as f64,
        event_count: parser.state.event_count,
        checksum: parser.state.checksum,
        attr_count_total: parser.state.attr_count_total,
        object_count: parser.state.object_count,
    })
}

fn parse_aggregate_auto_stage(
    input: &[u8],
    tier: Tier,
    simd: SimdPolicy,
) -> Result<AggregateResult> {
    let (two_stage_tier, parser_tier) = match tier {
        Tier::EventCountAutoStage => (Tier::EventCountTwoStage, Tier::EventCountUnchecked),
        Tier::CountAutoStage => (Tier::CountEqTwoStage, Tier::CountOnly),
        _ => unreachable!("auto-stage dispatch called with non-auto tier"),
    };

    let mut result = if should_use_two_stage(input) {
        parse_aggregate_two_stage(input, two_stage_tier, simd)?
    } else {
        parse_aggregate_with_parser(input, parser_tier, tier)?
    };
    result.tier = tier_name(tier).to_string();
    Ok(result)
}

fn should_use_two_stage(input: &[u8]) -> bool {
    let sample = &input[..input.len().min(4096)];
    let lt_count = memchr::memchr_iter(b'<', sample).count().max(1);
    let quote_count =
        memchr::memchr_iter(b'"', sample).count() + memchr::memchr_iter(b'\'', sample).count();
    quote_count > lt_count * 5
}

fn parse_aggregate_fast_event_count(
    input: &[u8],
    execution_tier: Tier,
    result_tier: Tier,
) -> Result<AggregateResult> {
    let skip_text = execution_tier.skips_text_events();
    let fold_checksum = execution_tier.folds_event_checksum();
    let mut state = AggregateState::default();
    emit_fast_event_count_event(&mut state, START_DOCUMENT, fold_checksum);

    let mut position = 0usize;
    while position < input.len() {
        let Some(lt_offset) = memchr(b'<', &input[position..]) else {
            if !skip_text && has_non_whitespace(input, position, input.len()) {
                emit_fast_event_count_event(&mut state, CHARACTERS, fold_checksum);
            }
            break;
        };
        let lt = position + lt_offset;
        if !skip_text && lt > position && has_non_whitespace(input, position, lt) {
            emit_fast_event_count_event(&mut state, CHARACTERS, fold_checksum);
        }
        if lt + 1 >= input.len() {
            return Err(Error::from_reason("Unclosed start tag"));
        }

        position = match input[lt + 1] {
            b'/' => {
                let Some(end) = find_gt(input, lt + 2) else {
                    return Err(Error::from_reason("Unclosed end tag"));
                };
                emit_fast_event_count_event(&mut state, END_ELEMENT, fold_checksum);
                end + 1
            }
            b'!' => parse_fast_event_count_bang(input, lt, skip_text, fold_checksum, &mut state)?,
            b'?' => {
                let Some(end) = find_bytes(input, b"?>", lt + 2) else {
                    return Err(Error::from_reason(if starts_with(input, lt, b"<?xml") {
                        "Unclosed XML declaration"
                    } else {
                        "Unclosed processing instruction"
                    }));
                };
                end + 2
            }
            _ => {
                let Some(tag_end) = find_tag_end(input, lt + 1) else {
                    return Err(Error::from_reason("Unclosed start tag"));
                };
                let (_, self_closing) = trim_start_tag_end(input, lt, tag_end);
                emit_fast_event_count_event(&mut state, START_ELEMENT, fold_checksum);
                if self_closing {
                    emit_fast_event_count_event(&mut state, END_ELEMENT, fold_checksum);
                }
                tag_end + 1
            }
        };
    }

    emit_fast_event_count_event(&mut state, END_DOCUMENT, fold_checksum);

    Ok(AggregateResult {
        tier: tier_name(result_tier).to_string(),
        input_bytes: input.len() as f64,
        event_count: state.event_count,
        checksum: state.checksum,
        attr_count_total: state.attr_count_total,
        object_count: state.object_count,
    })
}

fn parse_fast_event_count_bang(
    input: &[u8],
    position: usize,
    skip_text: bool,
    fold_checksum: bool,
    state: &mut AggregateState,
) -> Result<usize> {
    if starts_with(input, position, b"<![CDATA[") {
        let Some(end) = find_bytes(input, b"]]>", position + 9) else {
            return Err(Error::from_reason("Unclosed CDATA section"));
        };
        if !skip_text && end > position + 9 && has_non_whitespace(input, position + 9, end) {
            emit_fast_event_count_event(state, CDATA, fold_checksum);
        }
        return Ok(end + 3);
    }

    if starts_with(input, position, b"<!--") {
        let Some(end) = find_bytes(input, b"-->", position + 4) else {
            return Err(Error::from_reason("Unclosed comment"));
        };
        return Ok(end + 3);
    }

    if starts_with(input, position, b"<!DOCTYPE") {
        let Some(end) = find_gt(input, position + 2) else {
            return Err(Error::from_reason("Unclosed DOCTYPE declaration"));
        };
        return Ok(end + 1);
    }

    let Some(end) = find_gt(input, position + 2) else {
        return Err(Error::from_reason("Unclosed markup"));
    };
    Ok(end + 1)
}

fn emit_fast_event_count_event(state: &mut AggregateState, event_type: u8, fold_checksum: bool) {
    state.event_count = state.event_count.wrapping_add(1);
    if fold_checksum {
        state.checksum = mix_checksum(state.checksum, event_type as i32);
    }
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

fn parse_aggregate_two_stage(
    input: &[u8],
    tier: Tier,
    simd: SimdPolicy,
) -> Result<AggregateResult> {
    let include_eq = tier == Tier::CountEqTwoStage;
    let structural = classify_structural_masks(input, include_eq, simd)?;
    let gt_positions: Vec<usize> = BitPositionIter::new(&structural.gt_bits).collect();
    let mut gt_index = 0usize;
    let mut text_start = 0usize;

    let mut state = AggregateState::default();
    emit_two_stage_event(&mut state, START_DOCUMENT, 0, include_eq);

    for lt in BitPositionIter::new(&structural.lt_bits) {
        if lt < text_start {
            continue;
        }

        if text_start < lt && has_non_whitespace(input, text_start, lt) {
            emit_two_stage_event(&mut state, CHARACTERS, 0, include_eq);
        }

        if lt + 1 >= input.len() {
            return Err(Error::from_reason("Unclosed start tag"));
        }

        while gt_index < gt_positions.len() && gt_positions[gt_index] <= lt {
            gt_index += 1;
        }

        match input[lt + 1] {
            b'/' => {
                let Some(gt) = gt_positions.get(gt_index).copied() else {
                    return Err(Error::from_reason("Unclosed end tag"));
                };
                emit_two_stage_event(&mut state, END_ELEMENT, 0, include_eq);
                text_start = gt + 1;
                gt_index += 1;
            }
            b'!' => {
                if starts_with(input, lt, b"<![CDATA[") {
                    let Some(end) = find_bytes(input, b"]]>", lt + 9) else {
                        return Err(Error::from_reason("Unclosed CDATA section"));
                    };
                    if end > lt + 9 && has_non_whitespace(input, lt + 9, end) {
                        emit_two_stage_event(&mut state, CDATA, 0, include_eq);
                    }
                    text_start = end + 3;
                } else if starts_with(input, lt, b"<!--") {
                    let Some(end) = find_bytes(input, b"-->", lt + 4) else {
                        return Err(Error::from_reason("Unclosed comment"));
                    };
                    text_start = end + 3;
                } else if starts_with(input, lt, b"<!DOCTYPE") {
                    let Some(gt) = gt_positions.get(gt_index).copied() else {
                        return Err(Error::from_reason("Unclosed DOCTYPE declaration"));
                    };
                    text_start = gt + 1;
                    gt_index += 1;
                } else {
                    let Some(gt) = gt_positions.get(gt_index).copied() else {
                        return Err(Error::from_reason("Unclosed markup"));
                    };
                    text_start = gt + 1;
                    gt_index += 1;
                }
            }
            b'?' => {
                let Some(end) = find_bytes(input, b"?>", lt + 2) else {
                    return Err(Error::from_reason(if starts_with(input, lt, b"<?xml") {
                        "Unclosed XML declaration"
                    } else {
                        "Unclosed processing instruction"
                    }));
                };
                text_start = end + 2;
            }
            _ => {
                let Some(gt) = gt_positions.get(gt_index).copied() else {
                    return Err(Error::from_reason("Unclosed start tag"));
                };

                let (actual_end, self_closing) = trim_start_tag_end(input, lt, gt);
                let name_end = scan_name_end(input, lt + 1, actual_end);
                let attr_count = if include_eq && name_end < actual_end {
                    count_mask_bits_in_range(&structural.eq_bits, name_end, actual_end)
                } else {
                    0
                };

                emit_two_stage_event(&mut state, START_ELEMENT, attr_count, include_eq);
                if self_closing {
                    emit_two_stage_event(&mut state, END_ELEMENT, 0, include_eq);
                }

                text_start = gt + 1;
                gt_index += 1;
            }
        }
    }

    if text_start < input.len() && has_non_whitespace(input, text_start, input.len()) {
        emit_two_stage_event(&mut state, CHARACTERS, 0, include_eq);
    }

    emit_two_stage_event(&mut state, END_DOCUMENT, 0, include_eq);

    Ok(AggregateResult {
        tier: tier_name(tier).to_string(),
        input_bytes: input.len() as f64,
        event_count: state.event_count,
        checksum: state.checksum,
        attr_count_total: state.attr_count_total,
        object_count: state.object_count,
    })
}

fn emit_two_stage_event(
    state: &mut AggregateState,
    event_type: u8,
    attr_count: usize,
    fold_attr_count: bool,
) {
    state.event_count = state.event_count.wrapping_add(1);
    state.checksum = mix_checksum(state.checksum, event_type as i32);
    if fold_attr_count {
        state.checksum = mix_checksum(state.checksum, attr_count as i32);
        state.attr_count_total = state.attr_count_total.wrapping_add(attr_count as u32);
    }
}

fn trim_start_tag_end(input: &[u8], lt: usize, gt: usize) -> (usize, bool) {
    let mut actual_end = gt;
    while actual_end > lt + 1 && is_whitespace(input[actual_end - 1]) {
        actual_end -= 1;
    }

    if actual_end > lt + 1 && input[actual_end - 1] == b'/' {
        actual_end -= 1;
        while actual_end > lt + 1 && is_whitespace(input[actual_end - 1]) {
            actual_end -= 1;
        }
        (actual_end, true)
    } else {
        (actual_end, false)
    }
}

fn scan_name_end(input: &[u8], mut index: usize, end: usize) -> usize {
    while index < end {
        let byte = input[index];
        if is_whitespace(byte) || byte == b'/' {
            break;
        }
        index += 1;
    }
    index
}

fn parse_span_table_utf16(input: &[u16]) -> Result<Vec<u8>> {
    let mut parser = SpanTableUtf16Parser {
        input,
        table: SpanTableBuilder::new(input.len(), 0)?,
        element_stack: Vec::new(),
    };
    parser.parse()?;
    parser.table.finish()
}

fn parse_span_table(input: &[u8]) -> Result<Vec<u8>> {
    let mut parser = SpanTableParser {
        input,
        table: SpanTableBuilder::new(input.len(), 1)?,
        element_stack: Vec::new(),
    };
    parser.parse()?;
    parser.table.finish()
}

fn parse_item_projection(input: &[u8]) -> Result<ItemProjectionResult> {
    let mut parser = ItemProjectionParser {
        input,
        rows: Vec::new(),
        element_stack: Vec::new(),
        current_item: None,
        capture: None,
    };
    parser.parse()?;

    let mut checksum = parser.rows.len() as i32;
    for row in &parser.rows {
        checksum = mix_js_benchmark_checksum(checksum, row.id);
        checksum = fold_span_js_benchmark_checksum(checksum, input, row.name_start, row.name_end)?;
        checksum =
            fold_span_js_benchmark_checksum(checksum, input, row.value_start, row.value_end)?;
    }

    Ok(ItemProjectionResult {
        input_bytes: input.len() as f64,
        item_count: to_u32_count(parser.rows.len(), "item projection row count")?,
        checksum,
    })
}

fn parse_item_projection_via_table(input: &[u8]) -> Result<ItemProjectionResult> {
    let table = parse_span_table(input)?;
    project_items_from_span_table(input, &table)
}

fn parse_item_rows_via_table(input: &[u8]) -> Result<ItemProjectionRowsResult> {
    let table = parse_span_table(input)?;
    project_item_rows_from_span_table(input, &table)
}

fn parse_object_rows(
    input: &[u8],
    spec: &ObjectRowsProjectionSpec,
) -> Result<ObjectRowsProjectionResult> {
    let spec = normalize_object_rows_spec(spec)?;
    let mut parser = ObjectRowsProjectionParser {
        input,
        state: create_object_rows_projection_state(spec.fields.len()),
        spec,
        event_count: 0,
        element_stack: Vec::new(),
    };
    parser.parse()?;

    Ok(ObjectRowsProjectionResult {
        input_bytes: input.len() as f64,
        event_count: parser.event_count,
        max_depth: to_u32_count(parser.state.max_depth, "object rows projection max depth")?,
        field_count: to_u32_count(
            parser.spec.fields.len(),
            "object rows projection field count",
        )?,
        row_count: to_u32_count(parser.state.row_count, "object rows projection row count")?,
        columns: parser.state.columns,
    })
}

fn parse_object_rows_via_table(
    input: &[u8],
    spec: &ObjectRowsProjectionSpec,
) -> Result<ObjectRowsProjectionResult> {
    let table = parse_span_table(input)?;
    project_object_rows_from_span_table(input, &table, spec)
}

fn tier_name(tier: Tier) -> &'static str {
    match tier {
        Tier::EventCountUnsafeGt => "event-count-unsafe-gt",
        Tier::EventCountByteLoop => "event-count-byte-loop",
        Tier::EventCountSkipQuotes => "event-count-skip-quotes",
        Tier::EventCountNoText => "event-count-no-text",
        Tier::EventCountNoChecksum => "event-count-no-checksum",
        Tier::EventCountNoTextNoChecksum => "event-count-no-text-no-checksum",
        Tier::EventCountTwoStage => "event-count-two-stage",
        Tier::EventCountAutoStage => "event-count-auto-stage",
        Tier::EventCountUnchecked => "event-count-unchecked",
        Tier::EventCountOnly => "event-count-only",
        Tier::CountOnly => "count-only",
        Tier::CountEqTwoStage => "count-eq-two-stage",
        Tier::CountAutoStage => "count-auto-stage",
        Tier::NameStringOnly => "name-string-only",
        Tier::TextStringOnly => "text-string-only",
        Tier::AttrValueStringOnly => "attr-value-string-only",
        Tier::FullStringDirect => "full-string-direct",
        Tier::EventObjectFull => "event-object-full",
    }
}

impl<'a> Parser<'a> {
    fn parse(&mut self) -> Result<()> {
        self.emit_event(START_DOCUMENT, None, None, None)?;

        let mut position = 0;
        while position < self.input.len() {
            let text_start = position;
            position = skip_whitespace(self.input, position);
            if position >= self.input.len() {
                break;
            }
            if self.input[position] == b'<' {
                position = self.parse_markup(position)?;
                continue;
            }

            let Some(lt_offset) = memchr(b'<', &self.input[position..]) else {
                self.emit_non_whitespace_text(text_start, self.input.len(), CHARACTERS)?;
                break;
            };
            let lt = position + lt_offset;
            self.emit_non_whitespace_text(text_start, lt, CHARACTERS)?;
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

        if !self.tier.validates_element_stack() {
            self.emit_event(END_ELEMENT, None, None, None)?;
            return Ok(end + 1);
        }

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
        let tag_end = match self.tier.tag_end_strategy() {
            TagEndStrategy::UnsafeGt => find_gt(self.input, position + 1),
            TagEndStrategy::ByteLoop => find_tag_end_byte_loop(self.input, position + 1),
            TagEndStrategy::SkipQuotes => find_tag_end_skip_quotes(self.input, position + 1),
            TagEndStrategy::Default => find_tag_end(self.input, position + 1),
        };
        let Some(tag_end) = tag_end else {
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

        if !self.tier.needs_start_name() {
            self.emit_event(START_ELEMENT, None, None, None)?;
            if self_closing {
                self.emit_event(END_ELEMENT, None, None, None)?;
            }
            return Ok(tag_end + 1);
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

        if self.tier == Tier::CountOnly {
            let attr_count = if name_end < actual_end {
                count_attributes(self.input, name_end, actual_end)
            } else {
                0
            };
            self.emit_count_only_event(START_ELEMENT, attr_count);
        } else {
            let attrs = (self.tier.needs_start_attributes() && name_end < actual_end)
                .then(|| parse_attributes(self.input, name_end, actual_end));
            self.emit_event(
                START_ELEMENT,
                Some((name_start, name_end)),
                None,
                attrs.as_ref(),
            )?;
        }

        if self_closing {
            let end_name = self
                .tier
                .validates_element_stack()
                .then_some((name_start, name_end));
            self.emit_event(END_ELEMENT, end_name, None, None)?;
        } else {
            if self.tier.validates_element_stack() {
                self.element_stack.push((name_start, name_end));
            }
        }

        Ok(tag_end + 1)
    }

    fn emit_text(&mut self, start: usize, end: usize, event_type: u8) -> Result<()> {
        if self.tier.skips_text_events() {
            return Ok(());
        }
        if start < end && !is_whitespace_only(self.input, start, end) {
            self.emit_event(event_type, None, Some((start, end)), None)?;
        }
        Ok(())
    }

    fn emit_non_whitespace_text(&mut self, start: usize, end: usize, event_type: u8) -> Result<()> {
        if self.tier.skips_text_events() {
            return Ok(());
        }
        if start < end {
            self.emit_event(event_type, None, Some((start, end)), None)?;
        }
        Ok(())
    }

    fn emit_count_only_event(&mut self, event_type: u8, attr_count: usize) {
        self.state.event_count = self.state.event_count.wrapping_add(1);
        self.state.checksum = mix_checksum(self.state.checksum, event_type as i32);
        self.state.checksum = mix_checksum(self.state.checksum, attr_count as i32);
        self.state.attr_count_total = self.state.attr_count_total.wrapping_add(attr_count as u32);
    }

    fn emit_event(
        &mut self,
        event_type: u8,
        name: Option<(usize, usize)>,
        text: Option<(usize, usize)>,
        attrs: Option<&AttrSpans>,
    ) -> Result<()> {
        self.state.event_count = self.state.event_count.wrapping_add(1);
        if self.tier.folds_event_checksum() {
            self.state.checksum = mix_checksum(self.state.checksum, event_type as i32);
        }

        match self.tier {
            Tier::EventCountUnsafeGt
            | Tier::EventCountByteLoop
            | Tier::EventCountSkipQuotes
            | Tier::EventCountNoText
            | Tier::EventCountNoChecksum
            | Tier::EventCountNoTextNoChecksum
            | Tier::EventCountTwoStage
            | Tier::EventCountAutoStage
            | Tier::EventCountUnchecked
            | Tier::EventCountOnly => {}
            Tier::CountOnly | Tier::CountEqTwoStage | Tier::CountAutoStage => {
                let attr_len = attrs.map_or(0, AttrSpans::len);
                self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
                self.state.attr_count_total =
                    self.state.attr_count_total.wrapping_add(attr_len as u32);
            }
            Tier::NameStringOnly => {
                self.consume_name_string_only(name)?;
            }
            Tier::TextStringOnly => {
                self.consume_text_string_only(text)?;
            }
            Tier::AttrValueStringOnly => {
                self.consume_attr_value_string_only(attrs)?;
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

    fn consume_name_string_only(&mut self, name: Option<(usize, usize)>) -> Result<()> {
        if let Some((start, end)) = name {
            self.state.checksum = fold_span(self.state.checksum, self.input, start, end)?;
        }
        Ok(())
    }

    fn consume_text_string_only(&mut self, text: Option<(usize, usize)>) -> Result<()> {
        if let Some((start, end)) = text {
            self.state.checksum = fold_trimmed_span(self.state.checksum, self.input, start, end)?;
        }
        Ok(())
    }

    fn consume_attr_value_string_only(&mut self, attrs: Option<&AttrSpans>) -> Result<()> {
        let attr_len = attrs.map_or(0, AttrSpans::len);
        self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
        self.state.attr_count_total = self.state.attr_count_total.wrapping_add(attr_len as u32);
        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
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
            let text_start = position;
            while position < self.input.len() && is_whitespace_u16(self.input[position]) {
                position += 1;
            }
            if position >= self.input.len() {
                break;
            }
            if self.input[position] == b'<' as u16 {
                position = self.parse_markup(position)?;
                continue;
            }

            let Some(lt) = find_unit(self.input, b'<' as u16, position, self.input.len()) else {
                self.emit_non_whitespace_text(text_start, self.input.len(), CHARACTERS)?;
                break;
            };
            self.emit_non_whitespace_text(text_start, lt, CHARACTERS)?;
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

        if !self.tier.validates_element_stack() {
            self.emit_event(END_ELEMENT, None, None, None)?;
            return Ok(end + 1);
        }

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
        let tag_end = match self.tier.tag_end_strategy() {
            TagEndStrategy::UnsafeGt => find_gt_utf16(self.input, position + 1),
            _ => find_tag_end_utf16(self.input, position + 1),
        };
        let Some(tag_end) = tag_end else {
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

        if !self.tier.needs_start_name() {
            self.emit_event(START_ELEMENT, None, None, None)?;
            if self_closing {
                self.emit_event(END_ELEMENT, None, None, None)?;
            }
            return Ok(tag_end + 1);
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

        if self.tier == Tier::CountOnly {
            let attr_count = if name_end < actual_end {
                count_attributes_utf16(self.input, name_end, actual_end)
            } else {
                0
            };
            self.emit_count_only_event(START_ELEMENT, attr_count);
        } else {
            let attrs = (self.tier.needs_start_attributes() && name_end < actual_end)
                .then(|| parse_attributes_utf16(self.input, name_end, actual_end));
            self.emit_event(
                START_ELEMENT,
                Some((name_start, name_end)),
                None,
                attrs.as_ref(),
            )?;
        }

        if self_closing {
            let end_name = self
                .tier
                .validates_element_stack()
                .then_some((name_start, name_end));
            self.emit_event(END_ELEMENT, end_name, None, None)?;
        } else {
            if self.tier.validates_element_stack() {
                self.element_stack.push((name_start, name_end));
            }
        }

        Ok(tag_end + 1)
    }

    fn emit_text(&mut self, start: usize, end: usize, event_type: u8) -> Result<()> {
        if self.tier.skips_text_events() {
            return Ok(());
        }
        if start < end && !is_whitespace_only_u16(self.input, start, end) {
            self.emit_event(event_type, None, Some((start, end)), None)?;
        }
        Ok(())
    }

    fn emit_non_whitespace_text(&mut self, start: usize, end: usize, event_type: u8) -> Result<()> {
        if self.tier.skips_text_events() {
            return Ok(());
        }
        if start < end {
            self.emit_event(event_type, None, Some((start, end)), None)?;
        }
        Ok(())
    }

    fn emit_count_only_event(&mut self, event_type: u8, attr_count: usize) {
        self.state.event_count = self.state.event_count.wrapping_add(1);
        self.state.checksum = mix_checksum(self.state.checksum, event_type as i32);
        self.state.checksum = mix_checksum(self.state.checksum, attr_count as i32);
        self.state.attr_count_total = self.state.attr_count_total.wrapping_add(attr_count as u32);
    }

    fn emit_event(
        &mut self,
        event_type: u8,
        name: Option<(usize, usize)>,
        text: Option<(usize, usize)>,
        attrs: Option<&AttrSpans>,
    ) -> Result<()> {
        self.state.event_count = self.state.event_count.wrapping_add(1);
        if self.tier.folds_event_checksum() {
            self.state.checksum = mix_checksum(self.state.checksum, event_type as i32);
        }

        match self.tier {
            Tier::EventCountUnsafeGt
            | Tier::EventCountByteLoop
            | Tier::EventCountSkipQuotes
            | Tier::EventCountNoText
            | Tier::EventCountNoChecksum
            | Tier::EventCountNoTextNoChecksum
            | Tier::EventCountTwoStage
            | Tier::EventCountAutoStage
            | Tier::EventCountUnchecked
            | Tier::EventCountOnly => {}
            Tier::CountOnly | Tier::CountEqTwoStage | Tier::CountAutoStage => {
                let attr_len = attrs.map_or(0, AttrSpans::len);
                self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
                self.state.attr_count_total =
                    self.state.attr_count_total.wrapping_add(attr_len as u32);
            }
            Tier::NameStringOnly => {
                self.consume_name_string_only(name);
            }
            Tier::TextStringOnly => {
                self.consume_text_string_only(text);
            }
            Tier::AttrValueStringOnly => {
                self.consume_attr_value_string_only(attrs);
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

    fn consume_name_string_only(&mut self, name: Option<(usize, usize)>) {
        if let Some((start, end)) = name {
            self.state.checksum = fold_units(self.state.checksum, self.input, start, end);
        }
    }

    fn consume_text_string_only(&mut self, text: Option<(usize, usize)>) {
        if let Some((start, end)) = text {
            self.state.checksum = fold_trimmed_units(self.state.checksum, self.input, start, end);
        }
    }

    fn consume_attr_value_string_only(&mut self, attrs: Option<&AttrSpans>) {
        let attr_len = attrs.map_or(0, AttrSpans::len);
        self.state.checksum = mix_checksum(self.state.checksum, attr_len as i32);
        self.state.attr_count_total = self.state.attr_count_total.wrapping_add(attr_len as u32);
        if let Some(attrs) = attrs {
            for attr in attrs.iter() {
                self.state.checksum = fold_units(
                    self.state.checksum,
                    self.input,
                    attr.value_start,
                    attr.value_end,
                );
            }
        }
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

impl<'a> ItemProjectionParser<'a> {
    fn parse(&mut self) -> Result<()> {
        let mut position = 0;
        while position < self.input.len() {
            let Some(lt_offset) = memchr(b'<', &self.input[position..]) else {
                self.capture_text(position, self.input.len());
                break;
            };
            let lt = position + lt_offset;
            self.capture_text(position, lt);
            position = self.parse_markup(lt)?;
        }

        if !self.element_stack.is_empty() {
            return Err(Error::from_reason(
                "Unexpected end of document. Not all elements were closed.",
            ));
        }

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
            self.capture_text(position + 9, end);
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

        let depth = self.element_stack.len() + 1;
        self.start_projection_element(name_start, name_end, name_end, actual_end, depth);

        if self_closing {
            self.end_projection_element(name_start, name_end, depth);
        } else {
            self.element_stack.push((name_start, name_end));
        }

        Ok(tag_end + 1)
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

        self.end_projection_element(name_start, name_end, self.element_stack.len() + 1);
        Ok(end + 1)
    }

    fn start_projection_element(
        &mut self,
        name_start: usize,
        name_end: usize,
        attr_start: usize,
        attr_end: usize,
        depth: usize,
    ) {
        if span_eq(self.input, name_start, name_end, b"item") && self.current_item.is_none() {
            self.current_item = Some(CurrentItemProjection {
                depth,
                id: read_projection_id(self.input, attr_start, attr_end),
                name: None,
                value: None,
            });
            return;
        }

        let Some(item) = &self.current_item else {
            return;
        };
        if depth != item.depth + 1 {
            return;
        }

        if span_eq(self.input, name_start, name_end, b"name") {
            self.capture = Some(ItemProjectionCapture {
                depth,
                field: ItemProjectionField::Name,
            });
        } else if span_eq(self.input, name_start, name_end, b"value") {
            self.capture = Some(ItemProjectionCapture {
                depth,
                field: ItemProjectionField::Value,
            });
        }
    }

    fn end_projection_element(&mut self, name_start: usize, name_end: usize, depth: usize) {
        if matches!(self.capture, Some(capture) if capture.depth == depth) {
            self.capture = None;
        }

        let should_finish_item = self.current_item.as_ref().is_some_and(|item| {
            item.depth == depth && span_eq(self.input, name_start, name_end, b"item")
        });
        if !should_finish_item {
            return;
        }

        let item = self.current_item.take().expect("checked item presence");
        if let (Some((name_start, name_end)), Some((value_start, value_end))) =
            (item.name, item.value)
        {
            self.rows.push(ItemProjectionRow {
                id: item.id,
                name_start,
                name_end,
                value_start,
                value_end,
            });
        }
    }

    fn capture_text(&mut self, start: usize, end: usize) {
        if start >= end || is_whitespace_only(self.input, start, end) {
            return;
        }
        let Some(capture) = self.capture else {
            return;
        };
        if self.element_stack.len() != capture.depth {
            return;
        }
        let Some(item) = &mut self.current_item else {
            return;
        };
        match capture.field {
            ItemProjectionField::Name => item.name = Some((start, end)),
            ItemProjectionField::Value => item.value = Some((start, end)),
        }
    }
}

impl<'a> ObjectRowsProjectionParser<'a> {
    fn parse(&mut self) -> Result<()> {
        self.event_count += 1; // START_DOCUMENT
        let mut position = 0;
        while position < self.input.len() {
            let Some(lt_offset) = memchr(b'<', &self.input[position..]) else {
                self.capture_text(position, self.input.len(), CHARACTERS)?;
                break;
            };
            let lt = position + lt_offset;
            self.capture_text(position, lt, CHARACTERS)?;
            position = self.parse_markup(lt)?;
        }

        if !self.element_stack.is_empty() {
            return Err(Error::from_reason(
                "Unexpected end of document. Not all elements were closed.",
            ));
        }
        if self.state.depth != 0 {
            return Err(Error::from_reason(
                "Object rows projection ended with open elements",
            ));
        }
        self.event_count += 1; // END_DOCUMENT
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
            self.capture_text(position + 9, end, CDATA)?;
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

        self.event_count += 1;
        self.state.depth += 1;
        self.state.max_depth = self.state.max_depth.max(self.state.depth);
        start_object_rows_projection_element_direct(
            self.input,
            name_start,
            name_end,
            name_end,
            actual_end,
            &self.spec,
            &mut self.state,
        )?;

        if self_closing {
            self.event_count += 1;
            end_object_rows_projection_element_direct(
                self.input,
                name_start,
                name_end,
                &self.spec,
                &mut self.state,
            )?;
            self.state.depth = self
                .state
                .depth
                .checked_sub(1)
                .ok_or_else(|| Error::from_reason("Object rows projection depth underflow"))?;
        } else {
            self.element_stack.push((name_start, name_end));
        }

        Ok(tag_end + 1)
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

        self.event_count += 1;
        end_object_rows_projection_element_direct(
            self.input,
            name_start,
            name_end,
            &self.spec,
            &mut self.state,
        )?;
        self.state.depth = self
            .state
            .depth
            .checked_sub(1)
            .ok_or_else(|| Error::from_reason("Object rows projection depth underflow"))?;
        Ok(end + 1)
    }

    fn capture_text(&mut self, start: usize, end: usize, _event_type: u8) -> Result<()> {
        if start < end && !is_whitespace_only(self.input, start, end) {
            self.event_count += 1;
            capture_object_rows_projection_text_span(
                self.input,
                start,
                end,
                &self.spec,
                &mut self.state,
            )?;
        }
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
    let _ = scan_attribute_spans(input, start, end, |attr| {
        attrs.push(attr);
        Ok(())
    });
    attrs
}

fn count_attributes(input: &[u8], start: usize, end: usize) -> usize {
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

fn scan_attribute_spans<F>(input: &[u8], start: usize, end: usize, mut visit: F) -> Result<()>
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

fn read_projection_id(input: &[u8], start: usize, end: usize) -> i32 {
    let attrs = parse_attributes(input, start, end);
    for attr in attrs.iter() {
        if span_eq(input, attr.name_start, attr.name_end, b"id") {
            return parse_i32_ascii(input, attr.value_start, attr.value_end).unwrap_or(0);
        }
    }
    0
}

fn parse_i32_ascii(input: &[u8], start: usize, end: usize) -> Option<i32> {
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

fn span_eq(input: &[u8], start: usize, end: usize, expected: &[u8]) -> bool {
    end >= start && end - start == expected.len() && &input[start..end] == expected
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

fn count_attributes_utf16(input: &[u16], start: usize, end: usize) -> usize {
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

fn parse_f64_js_prefix(input: &[u8], start: usize, end: usize) -> Result<f64> {
    parse_f64_js_prefix_bytes(&input[start..end])
}

fn parse_f64_js_prefix_bytes(input: &[u8]) -> Result<f64> {
    let value =
        std::str::from_utf8(input).map_err(|error| Error::from_reason(error.to_string()))?;
    let value = value.trim_start();
    let token_end = parse_float_prefix_end(value.as_bytes())
        .ok_or_else(|| Error::from_reason("Object rows projection number field was invalid"))?;
    value[..token_end]
        .parse::<f64>()
        .map_err(|error| Error::from_reason(error.to_string()))
}

fn parse_float_prefix_end(input: &[u8]) -> Option<usize> {
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

fn materialize_units(input: &[u16], start: usize, end: usize) -> Result<String> {
    String::from_utf16(&input[start..end]).map_err(|error| Error::from_reason(error.to_string()))
}

fn fold_span(seed: i32, input: &[u8], start: usize, end: usize) -> Result<i32> {
    fold_utf8_bytes(seed, &input[start..end])
}

fn fold_span_js_benchmark_checksum(
    seed: i32,
    input: &[u8],
    start: usize,
    end: usize,
) -> Result<i32> {
    std::str::from_utf8(&input[start..end])
        .map(|value| fold_string_js_benchmark_checksum(seed, value))
        .map_err(|error| Error::from_reason(error.to_string()))
}

fn fold_string_js_benchmark_checksum(seed: i32, value: &str) -> i32 {
    let mut next = seed;
    for code_unit in value.encode_utf16() {
        next = mix_js_benchmark_checksum(next, code_unit as i32);
    }
    next
}

fn fold_trimmed_span(seed: i32, input: &[u8], start: usize, end: usize) -> Result<i32> {
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

fn fold_utf8_bytes(seed: i32, bytes: &[u8]) -> Result<i32> {
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

fn trim_ascii_bytes(input: &[u8], mut start: usize, mut end: usize) -> (usize, usize) {
    while start < end && is_js_trim_ascii_byte(input[start]) {
        start += 1;
    }
    while end > start && is_js_trim_ascii_byte(input[end - 1]) {
        end -= 1;
    }
    (start, end)
}

fn is_js_trim_ascii_byte(byte: u8) -> bool {
    matches!(byte, b'\t' | b'\n' | 0x0b | 0x0c | b'\r' | b' ')
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

impl SpanTableBuilder {
    fn new(input_units: usize, flags: u32) -> Result<Self> {
        let input_units = to_u32_count(input_units, "span table input units")?;
        let mut table = Vec::with_capacity(SPAN_TABLE_HEADER_BYTES);
        table.resize(SPAN_TABLE_HEADER_BYTES, 0);
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

fn project_items_from_span_table(input: &[u8], table: &[u8]) -> Result<ItemProjectionResult> {
    let outcome = project_item_rows_from_span_table_bytes(input, table)?;

    let mut checksum = outcome.rows.len() as i32;
    for row in &outcome.rows {
        checksum = mix_js_benchmark_checksum(checksum, row.id);
        checksum = fold_span_js_benchmark_checksum(checksum, input, row.name_start, row.name_end)?;
        checksum =
            fold_span_js_benchmark_checksum(checksum, input, row.value_start, row.value_end)?;
    }

    Ok(ItemProjectionResult {
        input_bytes: input.len() as f64,
        item_count: to_u32_count(outcome.rows.len(), "item table projection row count")?,
        checksum,
    })
}

fn project_item_rows_from_span_table(
    input: &[u8],
    table: &[u8],
) -> Result<ItemProjectionRowsResult> {
    let outcome = project_item_rows_from_span_table_bytes(input, table)?;
    let rows = outcome
        .rows
        .iter()
        .map(|row| {
            Ok(ItemProjectionRecord {
                id: row.id,
                name: materialize_span(input, row.name_start, row.name_end)?,
                value: materialize_span(input, row.value_start, row.value_end)?,
            })
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(ItemProjectionRowsResult {
        input_bytes: input.len() as f64,
        event_count: outcome.event_count,
        max_depth: to_u32_count(outcome.max_depth, "item table projection max depth")?,
        rows,
    })
}

fn project_item_rows_from_span_table_bytes(
    input: &[u8],
    table: &[u8],
) -> Result<TableProjectionOutcome> {
    let table = parse_span_table_bytes(table)?;
    if table.flags & 0xff != 1 {
        return Err(Error::from_reason(
            "Item projection requires a UTF-8 structural index table",
        ));
    }
    if table.input_units as usize != input.len() {
        return Err(Error::from_reason("Structural index input length mismatch"));
    }

    let mut state = TableProjectionState {
        depth: 0,
        max_depth: 0,
        current_item: None,
        capture: None,
        rows: Vec::new(),
    };

    for event_index in 0..table.event_count as usize {
        let event = read_table_event(&table, event_index)?;
        match event.event_type {
            value if value == START_ELEMENT as u32 => {
                state.depth += 1;
                state.max_depth = state.max_depth.max(state.depth);
                start_table_projection_element(input, &table, event, state.depth, &mut state)?;
            }
            value if value == END_ELEMENT as u32 => {
                end_table_projection_element(input, event, state.depth, &mut state)?;
                state.depth = state
                    .depth
                    .checked_sub(1)
                    .ok_or_else(|| Error::from_reason("Structural index depth underflow"))?;
            }
            value if value == CHARACTERS as u32 || value == CDATA as u32 => {
                capture_table_projection_text(input, event, &mut state)?;
            }
            _ => {}
        }
    }

    if state.depth != 0 {
        return Err(Error::from_reason(
            "Structural index ended with open elements",
        ));
    }

    Ok(TableProjectionOutcome {
        event_count: table.event_count,
        max_depth: state.max_depth,
        rows: state.rows,
    })
}

fn start_table_projection_element(
    input: &[u8],
    table: &ParsedSpanTable<'_>,
    event: TableEventRecord,
    depth: usize,
    state: &mut TableProjectionState,
) -> Result<()> {
    let Some((name_start, name_end)) = event.name_range()? else {
        return Err(Error::from_reason(
            "Structural index start element did not include a name span",
        ));
    };

    if span_eq(input, name_start, name_end, b"item") && state.current_item.is_none() {
        state.current_item = Some(CurrentItemProjection {
            depth,
            id: read_table_projection_id(input, table, event)?,
            name: None,
            value: None,
        });
        return Ok(());
    }

    let Some(item) = &state.current_item else {
        return Ok(());
    };
    if depth != item.depth + 1 {
        return Ok(());
    }

    if span_eq(input, name_start, name_end, b"name") {
        state.capture = Some(ItemProjectionCapture {
            depth,
            field: ItemProjectionField::Name,
        });
    } else if span_eq(input, name_start, name_end, b"value") {
        state.capture = Some(ItemProjectionCapture {
            depth,
            field: ItemProjectionField::Value,
        });
    }
    Ok(())
}

fn end_table_projection_element(
    input: &[u8],
    event: TableEventRecord,
    depth: usize,
    state: &mut TableProjectionState,
) -> Result<()> {
    if matches!(state.capture, Some(capture) if capture.depth == depth) {
        state.capture = None;
    }

    let Some((name_start, name_end)) = event.name_range()? else {
        return Ok(());
    };
    let should_finish_item = state
        .current_item
        .as_ref()
        .is_some_and(|item| item.depth == depth && span_eq(input, name_start, name_end, b"item"));
    if !should_finish_item {
        return Ok(());
    }

    let item = state.current_item.take().expect("checked item presence");
    if let (Some((name_start, name_end)), Some((value_start, value_end))) = (item.name, item.value)
    {
        state.rows.push(ItemProjectionRow {
            id: item.id,
            name_start,
            name_end,
            value_start,
            value_end,
        });
    }
    Ok(())
}

fn capture_table_projection_text(
    input: &[u8],
    event: TableEventRecord,
    state: &mut TableProjectionState,
) -> Result<()> {
    let Some((start, end)) = event.text_range()? else {
        return Ok(());
    };
    if start >= end || is_whitespace_only(input, start, end) {
        return Ok(());
    }
    let Some(capture) = state.capture else {
        return Ok(());
    };
    if state.depth != capture.depth {
        return Ok(());
    }
    let Some(item) = &mut state.current_item else {
        return Ok(());
    };
    match capture.field {
        ItemProjectionField::Name => item.name = Some((start, end)),
        ItemProjectionField::Value => item.value = Some((start, end)),
    }
    Ok(())
}

fn read_table_projection_id(
    input: &[u8],
    table: &ParsedSpanTable<'_>,
    event: TableEventRecord,
) -> Result<i32> {
    for attr_offset in 0..event.attr_count as usize {
        let attr = read_table_attr(table, event.attr_start as usize + attr_offset)?;
        let Some((name_start, name_end)) = attr.name_range()? else {
            continue;
        };
        if !span_eq(input, name_start, name_end, b"id") {
            continue;
        }
        let Some((value_start, value_end)) = attr.value_range()? else {
            return Ok(0);
        };
        return Ok(parse_i32_ascii(input, value_start, value_end).unwrap_or(0));
    }
    Ok(0)
}

fn project_object_rows_from_span_table(
    input: &[u8],
    table: &[u8],
    spec: &ObjectRowsProjectionSpec,
) -> Result<ObjectRowsProjectionResult> {
    let table = parse_span_table_bytes(table)?;
    if table.flags & 0xff != 1 {
        return Err(Error::from_reason(
            "Object rows projection requires a UTF-8 structural index table",
        ));
    }
    if table.input_units as usize != input.len() {
        return Err(Error::from_reason("Structural index input length mismatch"));
    }

    let spec = normalize_object_rows_spec(spec)?;
    let mut state = create_object_rows_projection_state(spec.fields.len());

    for event_index in 0..table.event_count as usize {
        let event = read_table_event(&table, event_index)?;
        match event.event_type {
            value if value == START_ELEMENT as u32 => {
                state.depth += 1;
                state.max_depth = state.max_depth.max(state.depth);
                start_object_rows_projection_element(input, &table, event, &spec, &mut state)?;
            }
            value if value == END_ELEMENT as u32 => {
                end_object_rows_projection_element(input, event, &spec, &mut state)?;
                state.depth = state
                    .depth
                    .checked_sub(1)
                    .ok_or_else(|| Error::from_reason("Structural index depth underflow"))?;
            }
            value if value == CHARACTERS as u32 || value == CDATA as u32 => {
                capture_object_rows_projection_text(input, event, &spec, &mut state)?;
            }
            _ => {}
        }
    }

    if state.depth != 0 {
        return Err(Error::from_reason(
            "Structural index ended with open elements",
        ));
    }

    Ok(ObjectRowsProjectionResult {
        input_bytes: input.len() as f64,
        event_count: table.event_count,
        max_depth: to_u32_count(state.max_depth, "object rows projection max depth")?,
        field_count: to_u32_count(spec.fields.len(), "object rows projection field count")?,
        row_count: to_u32_count(state.row_count, "object rows projection row count")?,
        columns: state.columns,
    })
}

fn create_object_rows_projection_state(field_count: usize) -> ObjectRowsProjectionState {
    ObjectRowsProjectionState {
        depth: 0,
        max_depth: 0,
        current_row: None,
        capture: None,
        row_count: 0,
        columns: (0..field_count)
            .map(|_| ObjectRowsProjectionColumn {
                present: Vec::new(),
                values: Vec::new(),
                number_values: Vec::new(),
                span_starts: Vec::new(),
                span_ends: Vec::new(),
            })
            .collect(),
    }
}

fn normalize_object_rows_spec(spec: &ObjectRowsProjectionSpec) -> Result<NormalizedObjectRowsSpec> {
    if spec.item_name.is_empty() {
        return Err(Error::from_reason(
            "Object rows projection requires an item element name",
        ));
    }
    if spec.fields.is_empty() {
        return Err(Error::from_reason(
            "Object rows projection requires at least one field",
        ));
    }

    let mut fields = Vec::with_capacity(spec.fields.len());
    for field in &spec.fields {
        if field.output_name.is_empty() {
            return Err(Error::from_reason(
                "Object rows projection field output name cannot be empty",
            ));
        }
        if field.source_name.is_empty() {
            return Err(Error::from_reason(
                "Object rows projection field source name cannot be empty",
            ));
        }
        let value_kind = match field.value_kind.as_str() {
            "string" => ObjectRowsValueKind::String,
            "number" => ObjectRowsValueKind::Number,
            _ => {
                return Err(Error::from_reason(
                    "Object rows projection field value kind must be string or number",
                ));
            }
        };

        let source_kind = match field.source_kind.as_str() {
            "attribute" => ObjectRowsSourceKind::Attribute,
            "element" => ObjectRowsSourceKind::Element,
            _ => {
                return Err(Error::from_reason(
                    "Object rows projection field source kind must be attribute or element",
                ));
            }
        };
        let text_mode = match field.text_mode.as_str() {
            "direct" => ObjectRowsTextMode::Direct,
            "subtree" => ObjectRowsTextMode::Subtree,
            "" if source_kind == ObjectRowsSourceKind::Attribute => ObjectRowsTextMode::Direct,
            _ => {
                return Err(Error::from_reason(
                    "Object rows projection field text mode must be direct or subtree",
                ));
            }
        };

        fields.push(NormalizedObjectRowsField {
            value_kind,
            source_kind,
            source_name: field.source_name.as_bytes().to_vec(),
            text_mode,
        });
    }

    Ok(NormalizedObjectRowsSpec {
        item_name: spec.item_name.as_bytes().to_vec(),
        fields,
    })
}

fn start_object_rows_projection_element(
    input: &[u8],
    table: &ParsedSpanTable<'_>,
    event: TableEventRecord,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    let Some((name_start, name_end)) = event.name_range()? else {
        return Err(Error::from_reason(
            "Structural index start element did not include a name span",
        ));
    };
    let name = &input[name_start..name_end];

    if state.current_row.is_none() && name == spec.item_name.as_slice() {
        let mut row = CurrentObjectRowsProjection {
            depth: state.depth,
            completed: vec![false; spec.fields.len()],
            present: vec![false; spec.fields.len()],
            values: vec![String::new(); spec.fields.len()],
            number_values: vec![0.0; spec.fields.len()],
            number_buffers: (0..spec.fields.len()).map(|_| Vec::new()).collect(),
        };
        read_object_rows_projection_attributes(input, table, event, spec, &mut row)?;
        state.current_row = Some(row);
        return Ok(());
    }

    let Some(row) = &mut state.current_row else {
        return Ok(());
    };
    if state.depth != row.depth + 1 {
        return Ok(());
    }

    let mut field_indices = Vec::new();
    let mut text_mode = ObjectRowsTextMode::Subtree;
    for (index, field) in spec.fields.iter().enumerate() {
        if field.source_kind == ObjectRowsSourceKind::Element
            && name == field.source_name.as_slice()
            && !row.completed[index]
        {
            field_indices.push(index);
            text_mode = field.text_mode;
            row.present[index] = true;
        }
    }
    if !field_indices.is_empty() {
        state.capture = Some(ObjectRowsProjectionCapture {
            depth: state.depth,
            field_indices,
            text_mode,
        });
    }
    Ok(())
}

fn read_object_rows_projection_attributes(
    input: &[u8],
    table: &ParsedSpanTable<'_>,
    event: TableEventRecord,
    spec: &NormalizedObjectRowsSpec,
    row: &mut CurrentObjectRowsProjection,
) -> Result<()> {
    for attr_offset in 0..event.attr_count as usize {
        let attr = read_table_attr(table, event.attr_start as usize + attr_offset)?;
        let Some((name_start, name_end)) = attr.name_range()? else {
            continue;
        };
        let Some((value_start, value_end)) = attr.value_range()? else {
            continue;
        };
        let attr_name = &input[name_start..name_end];
        for (index, field) in spec.fields.iter().enumerate() {
            if field.source_kind == ObjectRowsSourceKind::Attribute
                && attr_name == field.source_name.as_slice()
            {
                match field.value_kind {
                    ObjectRowsValueKind::String => {
                        row.values[index] = materialize_span(input, value_start, value_end)?;
                    }
                    ObjectRowsValueKind::Number => {
                        row.number_values[index] =
                            parse_f64_js_prefix(input, value_start, value_end).unwrap_or(f64::NAN);
                    }
                }
                row.present[index] = true;
                row.completed[index] = true;
            }
        }
    }
    Ok(())
}

fn start_object_rows_projection_element_direct(
    input: &[u8],
    name_start: usize,
    name_end: usize,
    attr_start: usize,
    attr_end: usize,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    let name = &input[name_start..name_end];

    if state.current_row.is_none() && name == spec.item_name.as_slice() {
        let mut row = CurrentObjectRowsProjection {
            depth: state.depth,
            completed: vec![false; spec.fields.len()],
            present: vec![false; spec.fields.len()],
            values: vec![String::new(); spec.fields.len()],
            number_values: vec![0.0; spec.fields.len()],
            number_buffers: (0..spec.fields.len()).map(|_| Vec::new()).collect(),
        };
        read_object_rows_projection_attributes_direct(input, attr_start, attr_end, spec, &mut row)?;
        state.current_row = Some(row);
        return Ok(());
    }

    let Some(row) = &mut state.current_row else {
        return Ok(());
    };
    if state.depth != row.depth + 1 {
        return Ok(());
    }

    let mut field_indices = Vec::new();
    let mut text_mode = ObjectRowsTextMode::Subtree;
    for (index, field) in spec.fields.iter().enumerate() {
        if field.source_kind == ObjectRowsSourceKind::Element
            && name == field.source_name.as_slice()
            && !row.completed[index]
        {
            field_indices.push(index);
            text_mode = field.text_mode;
            row.present[index] = true;
        }
    }
    if !field_indices.is_empty() {
        state.capture = Some(ObjectRowsProjectionCapture {
            depth: state.depth,
            field_indices,
            text_mode,
        });
    }
    Ok(())
}

fn read_object_rows_projection_attributes_direct(
    input: &[u8],
    attr_start: usize,
    attr_end: usize,
    spec: &NormalizedObjectRowsSpec,
    row: &mut CurrentObjectRowsProjection,
) -> Result<()> {
    scan_attribute_spans(input, attr_start, attr_end, |attr| {
        let attr_name = &input[attr.name_start..attr.name_end];
        for (index, field) in spec.fields.iter().enumerate() {
            if field.source_kind == ObjectRowsSourceKind::Attribute
                && attr_name == field.source_name.as_slice()
            {
                match field.value_kind {
                    ObjectRowsValueKind::String => {
                        row.values[index] =
                            materialize_span(input, attr.value_start, attr.value_end)?;
                    }
                    ObjectRowsValueKind::Number => {
                        row.number_values[index] =
                            parse_f64_js_prefix(input, attr.value_start, attr.value_end)
                                .unwrap_or(f64::NAN);
                    }
                }
                row.present[index] = true;
                row.completed[index] = true;
            }
        }
        Ok(())
    })
}

fn end_object_rows_projection_element(
    input: &[u8],
    event: TableEventRecord,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    if state
        .capture
        .as_ref()
        .is_some_and(|capture| capture.depth == state.depth)
    {
        if let Some(row) = &mut state.current_row {
            if let Some(capture) = &state.capture {
                for index in &capture.field_indices {
                    if row.present[*index] {
                        match spec.fields[*index].value_kind {
                            ObjectRowsValueKind::String => {
                                row.values[*index] = row.values[*index].trim().to_owned();
                            }
                            ObjectRowsValueKind::Number => {
                                row.number_values[*index] =
                                    parse_f64_js_prefix_bytes(&row.number_buffers[*index])
                                        .unwrap_or(f64::NAN);
                            }
                        }
                    }
                    row.completed[*index] = true;
                }
            }
        }
        state.capture = None;
    }

    let Some(row) = &state.current_row else {
        return Ok(());
    };
    if row.depth != state.depth {
        return Ok(());
    }

    let Some((name_start, name_end)) = event.name_range()? else {
        return Ok(());
    };
    if &input[name_start..name_end] != spec.item_name.as_slice() {
        return Ok(());
    }

    let mut row = state.current_row.take().expect("checked row presence");
    for index in 0..spec.fields.len() {
        state.columns[index].present.push(row.present[index]);
        match spec.fields[index].value_kind {
            ObjectRowsValueKind::String => {
                state.columns[index]
                    .values
                    .push(std::mem::take(&mut row.values[index]));
            }
            ObjectRowsValueKind::Number => {
                state.columns[index]
                    .number_values
                    .push(row.number_values[index]);
            }
        }
    }
    state.row_count += 1;
    Ok(())
}

fn end_object_rows_projection_element_direct(
    input: &[u8],
    name_start: usize,
    name_end: usize,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    if state
        .capture
        .as_ref()
        .is_some_and(|capture| capture.depth == state.depth)
    {
        if let Some(row) = &mut state.current_row {
            if let Some(capture) = &state.capture {
                for index in &capture.field_indices {
                    if row.present[*index] {
                        match spec.fields[*index].value_kind {
                            ObjectRowsValueKind::String => {
                                row.values[*index] = row.values[*index].trim().to_owned();
                            }
                            ObjectRowsValueKind::Number => {
                                row.number_values[*index] =
                                    parse_f64_js_prefix_bytes(&row.number_buffers[*index])
                                        .unwrap_or(f64::NAN);
                            }
                        }
                    }
                    row.completed[*index] = true;
                }
            }
        }
        state.capture = None;
    }

    let Some(row) = &state.current_row else {
        return Ok(());
    };
    if row.depth != state.depth {
        return Ok(());
    }

    if &input[name_start..name_end] != spec.item_name.as_slice() {
        return Ok(());
    }

    let mut row = state.current_row.take().expect("checked row presence");
    for index in 0..spec.fields.len() {
        state.columns[index].present.push(row.present[index]);
        match spec.fields[index].value_kind {
            ObjectRowsValueKind::String => {
                state.columns[index]
                    .values
                    .push(std::mem::take(&mut row.values[index]));
            }
            ObjectRowsValueKind::Number => {
                state.columns[index]
                    .number_values
                    .push(row.number_values[index]);
            }
        }
    }
    state.row_count += 1;
    Ok(())
}

fn capture_object_rows_projection_text(
    input: &[u8],
    event: TableEventRecord,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    let Some((start, end)) = event.text_range()? else {
        return Ok(());
    };
    capture_object_rows_projection_text_span(input, start, end, spec, state)
}

fn capture_object_rows_projection_text_span(
    input: &[u8],
    start: usize,
    end: usize,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    let Some(capture) = &state.capture else {
        return Ok(());
    };
    if capture.text_mode == ObjectRowsTextMode::Direct && state.depth != capture.depth {
        return Ok(());
    }
    if capture.text_mode == ObjectRowsTextMode::Subtree && state.depth < capture.depth {
        return Ok(());
    }
    let Some(row) = &mut state.current_row else {
        return Ok(());
    };
    for index in &capture.field_indices {
        match spec.fields[*index].value_kind {
            ObjectRowsValueKind::String => {
                append_object_rows_projection_string(input, start, end, row, *index)?;
            }
            ObjectRowsValueKind::Number => {
                row.number_buffers[*index].extend_from_slice(&input[start..end]);
            }
        }
        row.present[*index] = true;
    }
    Ok(())
}

fn append_object_rows_projection_string(
    input: &[u8],
    start: usize,
    end: usize,
    row: &mut CurrentObjectRowsProjection,
    index: usize,
) -> Result<()> {
    row.values[index].push_str(&materialize_span(input, start, end)?);
    Ok(())
}

fn parse_span_table_bytes(table: &[u8]) -> Result<ParsedSpanTable<'_>> {
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

fn read_table_event(table: &ParsedSpanTable<'_>, index: usize) -> Result<TableEventRecord> {
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

fn read_table_attr(table: &ParsedSpanTable<'_>, index: usize) -> Result<TableAttrRecord> {
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
    fn name_range(self) -> Result<Option<(usize, usize)>> {
        decode_table_range(self.name_start, self.name_end)
    }

    fn text_range(self) -> Result<Option<(usize, usize)>> {
        decode_table_range(self.text_start, self.text_end)
    }
}

impl TableAttrRecord {
    fn name_range(self) -> Result<Option<(usize, usize)>> {
        decode_table_range(self.name_start, self.name_end)
    }

    fn value_range(self) -> Result<Option<(usize, usize)>> {
        decode_table_range(self.value_start, self.value_end)
    }
}

fn decode_table_range(start: i32, end: i32) -> Result<Option<(usize, usize)>> {
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

fn read_u32_le(input: &[u8], offset: usize) -> Result<u32> {
    let bytes = input
        .get(offset..offset + 4)
        .ok_or_else(|| Error::from_reason("Unexpected end of structural index table"))?;
    Ok(u32::from_le_bytes(
        bytes.try_into().expect("slice length checked"),
    ))
}

fn read_i32_le(input: &[u8], offset: usize) -> Result<i32> {
    let bytes = input
        .get(offset..offset + 4)
        .ok_or_else(|| Error::from_reason("Unexpected end of structural index table"))?;
    Ok(i32::from_le_bytes(
        bytes.try_into().expect("slice length checked"),
    ))
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

fn write_u32_at(out: &mut [u8], offset: usize, value: u32) {
    out[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

fn mix_checksum(seed: i32, value: i32) -> i32 {
    (seed ^ value).wrapping_mul(16_777_619)
}

fn mix_js_benchmark_checksum(seed: i32, value: i32) -> i32 {
    js_to_int32(((seed ^ value) as f64) * 16_777_619.0)
}

fn js_to_int32(value: f64) -> i32 {
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

struct StructuralMasks {
    lt_bits: Vec<u64>,
    gt_bits: Vec<u64>,
    eq_bits: Vec<u64>,
}

struct BitPositionIter<'a> {
    bits: &'a [u64],
    chunk: usize,
    current: u64,
}

impl<'a> BitPositionIter<'a> {
    fn new(bits: &'a [u64]) -> Self {
        Self {
            bits,
            chunk: 0,
            current: 0,
        }
    }
}

impl Iterator for BitPositionIter<'_> {
    type Item = usize;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if self.current != 0 {
                let bit = self.current.trailing_zeros() as usize;
                self.current &= self.current - 1;
                return Some((self.chunk - 1) * 64 + bit);
            }
            if self.chunk >= self.bits.len() {
                return None;
            }
            self.current = self.bits[self.chunk];
            self.chunk += 1;
        }
    }
}

fn classify_structural_masks(
    input: &[u8],
    include_eq: bool,
    simd: SimdPolicy,
) -> Result<StructuralMasks> {
    match simd {
        SimdPolicy::Off => Ok(classify_structural_masks_scalar(input, include_eq)),
        SimdPolicy::Auto => Ok(classify_structural_masks_auto(input, include_eq)),
        SimdPolicy::Avx2 => classify_structural_masks_avx2_explicit(input, include_eq),
        SimdPolicy::Sse42 => classify_structural_masks_sse42_explicit(input, include_eq),
        SimdPolicy::Neon => classify_structural_masks_neon_explicit(input, include_eq),
    }
}

fn classify_structural_masks_auto(input: &[u8], include_eq: bool) -> StructuralMasks {
    #[cfg(target_arch = "aarch64")]
    {
        classify_structural_masks_neon(input, include_eq)
    }

    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("avx2") {
            return unsafe { classify_structural_masks_avx2(input, include_eq) };
        }
        if std::arch::is_x86_feature_detected!("sse4.2") {
            return unsafe { classify_structural_masks_sse42(input, include_eq) };
        }
        classify_structural_masks_scalar(input, include_eq)
    }

    #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64")))]
    {
        classify_structural_masks_scalar(input, include_eq)
    }
}

fn classify_structural_masks_avx2_explicit(
    input: &[u8],
    include_eq: bool,
) -> Result<StructuralMasks> {
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("avx2") {
            return Ok(unsafe { classify_structural_masks_avx2(input, include_eq) });
        }
        return Err(Error::from_reason(
            "Native SIMD policy avx2 was requested, but AVX2 is not available on this CPU.",
        ));
    }

    #[cfg(not(target_arch = "x86_64"))]
    {
        let _ = input;
        let _ = include_eq;
        Err(Error::from_reason(
            "Native SIMD policy avx2 was requested, but this build target is not x86_64.",
        ))
    }
}

fn classify_structural_masks_sse42_explicit(
    input: &[u8],
    include_eq: bool,
) -> Result<StructuralMasks> {
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("sse4.2") {
            return Ok(unsafe { classify_structural_masks_sse42(input, include_eq) });
        }
        return Err(Error::from_reason(
            "Native SIMD policy sse42 was requested, but SSE4.2 is not available on this CPU.",
        ));
    }

    #[cfg(not(target_arch = "x86_64"))]
    {
        let _ = input;
        let _ = include_eq;
        Err(Error::from_reason(
            "Native SIMD policy sse42 was requested, but this build target is not x86_64.",
        ))
    }
}

fn classify_structural_masks_neon_explicit(
    input: &[u8],
    include_eq: bool,
) -> Result<StructuralMasks> {
    #[cfg(target_arch = "aarch64")]
    {
        return Ok(classify_structural_masks_neon(input, include_eq));
    }

    #[cfg(not(target_arch = "aarch64"))]
    {
        let _ = input;
        let _ = include_eq;
        Err(Error::from_reason(
            "Native SIMD policy neon was requested, but this build target is not aarch64.",
        ))
    }
}

fn classify_structural_masks_scalar(input: &[u8], include_eq: bool) -> StructuralMasks {
    let chunk_count = input.len().div_ceil(64);
    let mut lt_bits = vec![0u64; chunk_count];
    let mut gt_bits = vec![0u64; chunk_count];
    let mut eq_bits = if include_eq {
        vec![0u64; chunk_count]
    } else {
        Vec::new()
    };
    let mut quote = 0u8;

    for (index, byte) in input.iter().copied().enumerate() {
        let chunk = index / 64;
        let bit = index % 64;
        if quote != 0 {
            if byte == quote {
                quote = 0;
            }
            continue;
        }
        match byte {
            b'<' => lt_bits[chunk] |= 1u64 << bit,
            b'>' => gt_bits[chunk] |= 1u64 << bit,
            b'=' if include_eq => eq_bits[chunk] |= 1u64 << bit,
            b'"' | b'\'' => quote = byte,
            _ => {}
        }
    }

    StructuralMasks {
        lt_bits,
        gt_bits,
        eq_bits,
    }
}

#[cfg(target_arch = "aarch64")]
fn classify_structural_masks_neon(input: &[u8], include_eq: bool) -> StructuralMasks {
    let len = input.len();
    let chunk_count = len.div_ceil(64);
    let mut lt_bits = vec![0u64; chunk_count];
    let mut gt_bits = vec![0u64; chunk_count];
    let mut eq_bits = if include_eq {
        vec![0u64; chunk_count]
    } else {
        Vec::new()
    };

    let mut in_dquote = false;
    let mut in_squote = false;
    let full_chunks = len / 64;

    unsafe {
        let v_lt = vdupq_n_u8(b'<');
        let v_gt = vdupq_n_u8(b'>');
        let v_eq = vdupq_n_u8(b'=');
        let v_dquote = vdupq_n_u8(b'"');
        let v_squote = vdupq_n_u8(b'\'');

        for chunk in 0..full_chunks {
            let base = chunk * 64;
            let ptr = input.as_ptr().add(base);

            let v0 = vld1q_u8(ptr);
            let v1 = vld1q_u8(ptr.add(16));
            let v2 = vld1q_u8(ptr.add(32));
            let v3 = vld1q_u8(ptr.add(48));

            let lt_mask = neon_movemask_64(
                vceqq_u8(v0, v_lt),
                vceqq_u8(v1, v_lt),
                vceqq_u8(v2, v_lt),
                vceqq_u8(v3, v_lt),
            );
            let gt_mask = neon_movemask_64(
                vceqq_u8(v0, v_gt),
                vceqq_u8(v1, v_gt),
                vceqq_u8(v2, v_gt),
                vceqq_u8(v3, v_gt),
            );
            let eq_mask = if include_eq {
                neon_movemask_64(
                    vceqq_u8(v0, v_eq),
                    vceqq_u8(v1, v_eq),
                    vceqq_u8(v2, v_eq),
                    vceqq_u8(v3, v_eq),
                )
            } else {
                0
            };
            let dq_mask = neon_movemask_64(
                vceqq_u8(v0, v_dquote),
                vceqq_u8(v1, v_dquote),
                vceqq_u8(v2, v_dquote),
                vceqq_u8(v3, v_dquote),
            );
            let sq_mask = neon_movemask_64(
                vceqq_u8(v0, v_squote),
                vceqq_u8(v1, v_squote),
                vceqq_u8(v2, v_squote),
                vceqq_u8(v3, v_squote),
            );

            let quoted_mask = quote_mask(dq_mask, sq_mask, &mut in_dquote, &mut in_squote);
            lt_bits[chunk] = lt_mask & !quoted_mask;
            gt_bits[chunk] = gt_mask & !quoted_mask;
            if include_eq {
                eq_bits[chunk] = eq_mask & !quoted_mask;
            }
        }
    }

    let remaining_start = full_chunks * 64;
    if remaining_start < len {
        let chunk = full_chunks;
        let mut lt = 0u64;
        let mut gt = 0u64;
        let mut eq = 0u64;

        for index in remaining_start..len {
            let byte = input[index];
            let bit = (index - remaining_start) as u32;

            if in_dquote {
                if byte == b'"' {
                    in_dquote = false;
                }
                continue;
            }
            if in_squote {
                if byte == b'\'' {
                    in_squote = false;
                }
                continue;
            }

            match byte {
                b'<' => lt |= 1u64 << bit,
                b'>' => gt |= 1u64 << bit,
                b'=' if include_eq => eq |= 1u64 << bit,
                b'"' => in_dquote = true,
                b'\'' => in_squote = true,
                _ => {}
            }
        }

        if chunk < lt_bits.len() {
            lt_bits[chunk] = lt;
            gt_bits[chunk] = gt;
            if include_eq {
                eq_bits[chunk] = eq;
            }
        }
    }

    StructuralMasks {
        lt_bits,
        gt_bits,
        eq_bits,
    }
}

#[cfg(target_arch = "aarch64")]
#[inline(always)]
unsafe fn neon_movemask_64(v0: uint8x16_t, v1: uint8x16_t, v2: uint8x16_t, v3: uint8x16_t) -> u64 {
    let m0 = neon_movemask(v0) as u64;
    let m1 = neon_movemask(v1) as u64;
    let m2 = neon_movemask(v2) as u64;
    let m3 = neon_movemask(v3) as u64;
    m0 | (m1 << 16) | (m2 << 32) | (m3 << 48)
}

#[cfg(target_arch = "aarch64")]
#[inline(always)]
unsafe fn neon_movemask(v: uint8x16_t) -> u16 {
    const MASK: [u8; 16] = [1, 2, 4, 8, 16, 32, 64, 128, 1, 2, 4, 8, 16, 32, 64, 128];
    let mask = vld1q_u8(MASK.as_ptr());
    let masked = vandq_u8(v, mask);
    let lo_sum = vaddv_u8(vget_low_u8(masked));
    let hi_sum = vaddv_u8(vget_high_u8(masked));
    (lo_sum as u16) | ((hi_sum as u16) << 8)
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "sse4.2")]
unsafe fn classify_structural_masks_sse42(input: &[u8], include_eq: bool) -> StructuralMasks {
    let len = input.len();
    let chunk_count = len.div_ceil(64);
    let mut lt_bits = vec![0u64; chunk_count];
    let mut gt_bits = vec![0u64; chunk_count];
    let mut eq_bits = if include_eq {
        vec![0u64; chunk_count]
    } else {
        Vec::new()
    };

    let mut in_dquote = false;
    let mut in_squote = false;
    let full_chunks = len / 64;

    let v_lt = _mm_set1_epi8(b'<' as i8);
    let v_gt = _mm_set1_epi8(b'>' as i8);
    let v_eq = _mm_set1_epi8(b'=' as i8);
    let v_dquote = _mm_set1_epi8(b'"' as i8);
    let v_squote = _mm_set1_epi8(b'\'' as i8);

    for chunk in 0..full_chunks {
        let base = chunk * 64;
        let ptr = input.as_ptr().add(base) as *const __m128i;

        let v0 = _mm_loadu_si128(ptr);
        let v1 = _mm_loadu_si128(ptr.add(1));
        let v2 = _mm_loadu_si128(ptr.add(2));
        let v3 = _mm_loadu_si128(ptr.add(3));

        let lt_mask = movemask_64_sse42(
            _mm_cmpeq_epi8(v0, v_lt),
            _mm_cmpeq_epi8(v1, v_lt),
            _mm_cmpeq_epi8(v2, v_lt),
            _mm_cmpeq_epi8(v3, v_lt),
        );
        let gt_mask = movemask_64_sse42(
            _mm_cmpeq_epi8(v0, v_gt),
            _mm_cmpeq_epi8(v1, v_gt),
            _mm_cmpeq_epi8(v2, v_gt),
            _mm_cmpeq_epi8(v3, v_gt),
        );
        let eq_mask = if include_eq {
            movemask_64_sse42(
                _mm_cmpeq_epi8(v0, v_eq),
                _mm_cmpeq_epi8(v1, v_eq),
                _mm_cmpeq_epi8(v2, v_eq),
                _mm_cmpeq_epi8(v3, v_eq),
            )
        } else {
            0
        };
        let dq_mask = movemask_64_sse42(
            _mm_cmpeq_epi8(v0, v_dquote),
            _mm_cmpeq_epi8(v1, v_dquote),
            _mm_cmpeq_epi8(v2, v_dquote),
            _mm_cmpeq_epi8(v3, v_dquote),
        );
        let sq_mask = movemask_64_sse42(
            _mm_cmpeq_epi8(v0, v_squote),
            _mm_cmpeq_epi8(v1, v_squote),
            _mm_cmpeq_epi8(v2, v_squote),
            _mm_cmpeq_epi8(v3, v_squote),
        );

        let quoted_mask = quote_mask(dq_mask, sq_mask, &mut in_dquote, &mut in_squote);
        lt_bits[chunk] = lt_mask & !quoted_mask;
        gt_bits[chunk] = gt_mask & !quoted_mask;
        if include_eq {
            eq_bits[chunk] = eq_mask & !quoted_mask;
        }
    }

    let remaining_start = full_chunks * 64;
    if remaining_start < len {
        let chunk = full_chunks;
        let mut lt = 0u64;
        let mut gt = 0u64;
        let mut eq = 0u64;

        for index in remaining_start..len {
            let byte = input[index];
            let bit = (index - remaining_start) as u32;

            if in_dquote {
                if byte == b'"' {
                    in_dquote = false;
                }
                continue;
            }
            if in_squote {
                if byte == b'\'' {
                    in_squote = false;
                }
                continue;
            }

            match byte {
                b'<' => lt |= 1u64 << bit,
                b'>' => gt |= 1u64 << bit,
                b'=' if include_eq => eq |= 1u64 << bit,
                b'"' => in_dquote = true,
                b'\'' => in_squote = true,
                _ => {}
            }
        }

        if chunk < lt_bits.len() {
            lt_bits[chunk] = lt;
            gt_bits[chunk] = gt;
            if include_eq {
                eq_bits[chunk] = eq;
            }
        }
    }

    StructuralMasks {
        lt_bits,
        gt_bits,
        eq_bits,
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "sse4.2")]
unsafe fn movemask_64_sse42(v0: __m128i, v1: __m128i, v2: __m128i, v3: __m128i) -> u64 {
    let m0 = _mm_movemask_epi8(v0) as u16 as u64;
    let m1 = _mm_movemask_epi8(v1) as u16 as u64;
    let m2 = _mm_movemask_epi8(v2) as u16 as u64;
    let m3 = _mm_movemask_epi8(v3) as u16 as u64;
    m0 | (m1 << 16) | (m2 << 32) | (m3 << 48)
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn classify_structural_masks_avx2(input: &[u8], include_eq: bool) -> StructuralMasks {
    let len = input.len();
    let chunk_count = len.div_ceil(64);
    let mut lt_bits = vec![0u64; chunk_count];
    let mut gt_bits = vec![0u64; chunk_count];
    let mut eq_bits = if include_eq {
        vec![0u64; chunk_count]
    } else {
        Vec::new()
    };

    let mut in_dquote = false;
    let mut in_squote = false;
    let full_chunks = len / 64;

    let v_lt = _mm256_set1_epi8(b'<' as i8);
    let v_gt = _mm256_set1_epi8(b'>' as i8);
    let v_eq = _mm256_set1_epi8(b'=' as i8);
    let v_dquote = _mm256_set1_epi8(b'"' as i8);
    let v_squote = _mm256_set1_epi8(b'\'' as i8);

    for chunk in 0..full_chunks {
        let base = chunk * 64;
        let ptr = input.as_ptr().add(base) as *const __m256i;

        let v0 = _mm256_loadu_si256(ptr);
        let v1 = _mm256_loadu_si256(ptr.add(1));

        let lt_mask = movemask_64(_mm256_cmpeq_epi8(v0, v_lt), _mm256_cmpeq_epi8(v1, v_lt));
        let gt_mask = movemask_64(_mm256_cmpeq_epi8(v0, v_gt), _mm256_cmpeq_epi8(v1, v_gt));
        let eq_mask = if include_eq {
            movemask_64(_mm256_cmpeq_epi8(v0, v_eq), _mm256_cmpeq_epi8(v1, v_eq))
        } else {
            0
        };
        let dq_mask = movemask_64(
            _mm256_cmpeq_epi8(v0, v_dquote),
            _mm256_cmpeq_epi8(v1, v_dquote),
        );
        let sq_mask = movemask_64(
            _mm256_cmpeq_epi8(v0, v_squote),
            _mm256_cmpeq_epi8(v1, v_squote),
        );

        let quoted_mask = quote_mask(dq_mask, sq_mask, &mut in_dquote, &mut in_squote);
        lt_bits[chunk] = lt_mask & !quoted_mask;
        gt_bits[chunk] = gt_mask & !quoted_mask;
        if include_eq {
            eq_bits[chunk] = eq_mask & !quoted_mask;
        }
    }

    let remaining_start = full_chunks * 64;
    if remaining_start < len {
        let chunk = full_chunks;
        let mut lt = 0u64;
        let mut gt = 0u64;
        let mut eq = 0u64;

        for index in remaining_start..len {
            let byte = input[index];
            let bit = (index - remaining_start) as u32;

            if in_dquote {
                if byte == b'"' {
                    in_dquote = false;
                }
                continue;
            }
            if in_squote {
                if byte == b'\'' {
                    in_squote = false;
                }
                continue;
            }

            match byte {
                b'<' => lt |= 1u64 << bit,
                b'>' => gt |= 1u64 << bit,
                b'=' if include_eq => eq |= 1u64 << bit,
                b'"' => in_dquote = true,
                b'\'' => in_squote = true,
                _ => {}
            }
        }

        if chunk < lt_bits.len() {
            lt_bits[chunk] = lt;
            gt_bits[chunk] = gt;
            if include_eq {
                eq_bits[chunk] = eq;
            }
        }
    }

    StructuralMasks {
        lt_bits,
        gt_bits,
        eq_bits,
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn movemask_64(v0: __m256i, v1: __m256i) -> u64 {
    let m0 = _mm256_movemask_epi8(v0) as u32 as u64;
    let m1 = _mm256_movemask_epi8(v1) as u32 as u64;
    m0 | (m1 << 32)
}

fn prefix_xor(mask: u64) -> u64 {
    let mut value = mask;
    value ^= value << 1;
    value ^= value << 2;
    value ^= value << 4;
    value ^= value << 8;
    value ^= value << 16;
    value ^= value << 32;
    value
}

fn mask_up_to(pos: u32) -> u64 {
    if pos >= 63 {
        u64::MAX
    } else {
        (1u64 << (pos + 1)) - 1
    }
}

fn mask_from(pos: u32) -> u64 {
    if pos >= 64 {
        0
    } else {
        !((1u64 << pos) - 1)
    }
}

fn quote_mask(dq_mask: u64, sq_mask: u64, in_dquote: &mut bool, in_squote: &mut bool) -> u64 {
    if dq_mask == 0 && sq_mask == 0 {
        return if *in_dquote || *in_squote {
            u64::MAX
        } else {
            0
        };
    }

    if sq_mask == 0 && !*in_squote {
        let quoted = prefix_xor(dq_mask);
        let quoted = if *in_dquote { !quoted } else { quoted };
        *in_dquote = (dq_mask.count_ones() & 1 == 1) ^ *in_dquote;
        return quoted;
    }

    if dq_mask == 0 && !*in_dquote {
        let quoted = prefix_xor(sq_mask);
        let quoted = if *in_squote { !quoted } else { quoted };
        *in_squote = (sq_mask.count_ones() & 1 == 1) ^ *in_squote;
        return quoted;
    }

    quote_mask_slow(dq_mask, sq_mask, in_dquote, in_squote)
}

fn quote_mask_slow(dq_mask: u64, sq_mask: u64, in_dquote: &mut bool, in_squote: &mut bool) -> u64 {
    let mut quoted_mask = 0u64;
    let mut remaining = dq_mask | sq_mask;

    if *in_dquote {
        if dq_mask != 0 {
            let close = dq_mask.trailing_zeros();
            quoted_mask |= mask_up_to(close);
            *in_dquote = false;
            remaining &= !mask_up_to(close);
        } else {
            return u64::MAX;
        }
    } else if *in_squote {
        if sq_mask != 0 {
            let close = sq_mask.trailing_zeros();
            quoted_mask |= mask_up_to(close);
            *in_squote = false;
            remaining &= !mask_up_to(close);
        } else {
            return u64::MAX;
        }
    }

    while remaining != 0 {
        let open = remaining.trailing_zeros();
        remaining &= remaining - 1;
        let is_dquote = (dq_mask >> open) & 1 == 1;
        let after_open = if open < 63 {
            !((1u64 << (open + 1)) - 1)
        } else {
            0
        };
        let close_mask = if is_dquote {
            dq_mask & after_open
        } else {
            sq_mask & after_open
        };

        if close_mask != 0 {
            let close = close_mask.trailing_zeros();
            let range = mask_up_to(close) & mask_from(open);
            quoted_mask |= range;
            remaining &= !range;
        } else {
            quoted_mask |= mask_from(open);
            if is_dquote {
                *in_dquote = true;
            } else {
                *in_squote = true;
            }
            break;
        }
    }

    quoted_mask
}

fn count_mask_bits_in_range(bits: &[u64], start: usize, end: usize) -> usize {
    if start >= end || bits.is_empty() {
        return 0;
    }

    let first_chunk = start / 64;
    let last_chunk = (end - 1) / 64;
    let mut count = 0usize;

    for chunk in first_chunk..=last_chunk {
        let Some(mut mask) = bits.get(chunk).copied() else {
            break;
        };
        if chunk == first_chunk {
            mask &= mask_from((start % 64) as u32);
        }
        if chunk == last_chunk {
            mask &= mask_up_to(((end - 1) % 64) as u32);
        }
        count += mask.count_ones() as usize;
    }

    count
}

const U64_LOW_BITS: u64 = 0x0101_0101_0101_0101;
const U64_HIGH_BITS: u64 = 0x8080_8080_8080_8080;

fn repeated_byte(byte: u8) -> u64 {
    U64_LOW_BITS * byte as u64
}

fn zero_byte_high_bits(value: u64) -> u64 {
    value.wrapping_sub(U64_LOW_BITS) & !value & U64_HIGH_BITS
}

fn whitespace_byte_high_bits(word: u64) -> u64 {
    zero_byte_high_bits(word ^ repeated_byte(b' '))
        | zero_byte_high_bits(word ^ repeated_byte(b'\n'))
        | zero_byte_high_bits(word ^ repeated_byte(b'\r'))
        | zero_byte_high_bits(word ^ repeated_byte(b'\t'))
}

fn is_whitespace_word(word: u64) -> bool {
    whitespace_byte_high_bits(word) == U64_HIGH_BITS
}

fn load_u64_ne(input: &[u8], index: usize) -> u64 {
    u64::from_ne_bytes(input[index..index + 8].try_into().expect("u64 chunk"))
}

fn skip_whitespace(input: &[u8], index: usize) -> usize {
    skip_whitespace_until(input, index, input.len())
}

fn skip_whitespace_until(input: &[u8], mut index: usize, end: usize) -> usize {
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

fn has_non_whitespace(input: &[u8], start: usize, end: usize) -> bool {
    let mut index = start;
    while index + 8 <= end {
        if !is_whitespace_word(load_u64_ne(input, index)) {
            return true;
        }
        index += 8;
    }
    input[index..end].iter().any(|byte| !is_whitespace(*byte))
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

fn find_tag_end_byte_loop(input: &[u8], from: usize) -> Option<usize> {
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

fn find_tag_end_skip_quotes(input: &[u8], from: usize) -> Option<usize> {
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

fn find_tag_end(input: &[u8], from: usize) -> Option<usize> {
    find_tag_end_skip_quotes(input, from)
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
    !has_non_whitespace(input, start, end)
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
    fn two_stage_aggregate_ignores_quoted_structural_bytes() {
        let input =
            br#"<root><item expr="left > right" eq="a=b">text</item><![CDATA[<raw>ok</raw>]]></root>"#;

        let two_stage = parse_aggregate(input, Tier::EventCountTwoStage).unwrap();
        let scalar_two_stage =
            parse_aggregate_with_simd_policy(input, Tier::EventCountTwoStage, SimdPolicy::Off)
                .unwrap();
        let unchecked = parse_aggregate(input, Tier::EventCountUnchecked).unwrap();
        let eq_count = parse_aggregate(input, Tier::CountEqTwoStage).unwrap();
        let scalar_eq_count =
            parse_aggregate_with_simd_policy(input, Tier::CountEqTwoStage, SimdPolicy::Off)
                .unwrap();
        let count_only = parse_aggregate(input, Tier::CountOnly).unwrap();

        assert_eq!(two_stage.event_count, unchecked.event_count);
        assert_eq!(two_stage.checksum, unchecked.checksum);
        assert_eq!(scalar_two_stage.event_count, two_stage.event_count);
        assert_eq!(scalar_two_stage.checksum, two_stage.checksum);
        assert_eq!(eq_count.event_count, count_only.event_count);
        assert_eq!(eq_count.attr_count_total, count_only.attr_count_total);
        assert_eq!(eq_count.checksum, count_only.checksum);
        assert_eq!(scalar_eq_count.attr_count_total, eq_count.attr_count_total);

        #[cfg(not(target_arch = "aarch64"))]
        assert!(parse_aggregate_with_simd_policy(
            input,
            Tier::EventCountTwoStage,
            SimdPolicy::Neon
        )
        .is_err());
        #[cfg(target_arch = "x86_64")]
        if std::arch::is_x86_feature_detected!("avx2") {
            let avx2_two_stage =
                parse_aggregate_with_simd_policy(input, Tier::EventCountTwoStage, SimdPolicy::Avx2)
                    .unwrap();
            assert_eq!(avx2_two_stage.event_count, two_stage.event_count);
            assert_eq!(avx2_two_stage.checksum, two_stage.checksum);
        }

        #[cfg(target_arch = "x86_64")]
        if std::arch::is_x86_feature_detected!("sse4.2") {
            let sse42_two_stage = parse_aggregate_with_simd_policy(
                input,
                Tier::EventCountTwoStage,
                SimdPolicy::Sse42,
            )
            .unwrap();
            assert_eq!(sse42_two_stage.event_count, two_stage.event_count);
            assert_eq!(sse42_two_stage.checksum, two_stage.checksum);
        }
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
        let sample = "  ascii-value  <x>본문 café 🌊</x>\u{3000}trimmed\u{3000}";
        let input = sample.as_bytes();

        let ascii = std::str::from_utf8(&input[2..13]).unwrap();
        assert_eq!(fold_span(31, input, 2, 13).unwrap(), fold_string(31, ascii));

        let non_ascii_start = sample.find("본문").unwrap();
        let non_ascii_end = sample.find("</x>").unwrap();
        let non_ascii = std::str::from_utf8(&input[non_ascii_start..non_ascii_end]).unwrap();
        assert_eq!(
            fold_span(31, input, non_ascii_start, non_ascii_end).unwrap(),
            fold_string(31, non_ascii)
        );

        let text = std::str::from_utf8(&input[0..15]).unwrap();
        assert_eq!(
            fold_trimmed_span(31, input, 0, 15).unwrap(),
            fold_string(31, text.trim())
        );

        let unicode_trim_start = sample.find('\u{3000}').unwrap();
        let unicode_trim = std::str::from_utf8(&input[unicode_trim_start..]).unwrap();
        assert_eq!(
            fold_trimmed_span(31, input, unicode_trim_start, input.len()).unwrap(),
            fold_string(31, unicode_trim.trim())
        );
    }

    #[test]
    fn utf16_aggregate_matches_utf8_parser() {
        let sample =
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE root><root><item a=\"1 > 0\" b='x > y'>안녕</item><![CDATA[<raw>value</raw>]]><empty /></root>";
        let units: Vec<u16> = sample.encode_utf16().collect();

        for tier in [
            Tier::EventCountUnsafeGt,
            Tier::EventCountByteLoop,
            Tier::EventCountSkipQuotes,
            Tier::EventCountNoText,
            Tier::EventCountNoChecksum,
            Tier::EventCountNoTextNoChecksum,
            Tier::EventCountTwoStage,
            Tier::EventCountAutoStage,
            Tier::EventCountUnchecked,
            Tier::EventCountOnly,
            Tier::CountOnly,
            Tier::CountEqTwoStage,
            Tier::CountAutoStage,
            Tier::NameStringOnly,
            Tier::TextStringOnly,
            Tier::AttrValueStringOnly,
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
    fn span_table_utf8_records_byte_offsets_and_source_kind() {
        let sample =
            "<root><item a=\"1 > 0\" b='x > y'>안녕</item><![CDATA[<raw>value</raw>]]><empty /></root>";
        let aggregate = parse_aggregate(sample.as_bytes(), Tier::CountOnly).unwrap();

        let table = parse_span_table(sample.as_bytes()).unwrap();

        assert_eq!(read_u32(&table, 0), SPAN_TABLE_MAGIC);
        assert_eq!(read_u32(&table, 4), aggregate.event_count);
        assert_eq!(read_u32(&table, 8), aggregate.attr_count_total);
        assert_eq!(read_u32(&table, 12), sample.len() as u32);
        assert_eq!(read_u32(&table, 24), 1);

        let event_stride = read_u32(&table, 16) as usize;
        let item_event = SPAN_TABLE_HEADER_BYTES + event_stride * 2;
        let name_start = read_i32(&table, item_event + 4) as usize;
        let name_end = read_i32(&table, item_event + 8) as usize;
        assert_eq!(&sample.as_bytes()[name_start..name_end], b"item");
    }

    #[test]
    fn item_projection_matches_schema_checksum_without_full_table() {
        let sample =
            "<root><item id=\"7\" a=\"x\"><name>Alice</name><value>안녕</value></item><item id=\"11\"><name>Bob</name><value>cafe</value></item></root>";
        let result = parse_item_projection(sample.as_bytes()).unwrap();
        let table_result = parse_item_projection_via_table(sample.as_bytes()).unwrap();

        let mut expected = 2i32;
        expected = mix_js_benchmark_checksum(expected, 7);
        expected = fold_span_js_benchmark_checksum(
            expected,
            sample.as_bytes(),
            sample.find("Alice").unwrap(),
            sample.find("Alice").unwrap() + 5,
        )
        .unwrap();
        expected = fold_span_js_benchmark_checksum(
            expected,
            sample.as_bytes(),
            sample.find("안녕").unwrap(),
            sample.find("안녕").unwrap() + "안녕".len(),
        )
        .unwrap();
        expected = mix_js_benchmark_checksum(expected, 11);
        expected = fold_span_js_benchmark_checksum(
            expected,
            sample.as_bytes(),
            sample.find("Bob").unwrap(),
            sample.find("Bob").unwrap() + 3,
        )
        .unwrap();
        expected = fold_span_js_benchmark_checksum(
            expected,
            sample.as_bytes(),
            sample.find("cafe").unwrap(),
            sample.find("cafe").unwrap() + 4,
        )
        .unwrap();

        assert_eq!(result.item_count, 2);
        assert_eq!(result.input_bytes, sample.len() as f64);
        assert_eq!(result.checksum, expected);
        assert_eq!(table_result.item_count, result.item_count);
        assert_eq!(table_result.input_bytes, result.input_bytes);
        assert_eq!(table_result.checksum, result.checksum);
    }

    #[test]
    fn item_projection_from_table_rejects_mismatched_input_length() {
        let sample = "<root><item id=\"1\"><name>A</name><value>B</value></item></root>";
        let mut table = parse_span_table(sample.as_bytes()).unwrap();
        table[12..16].copy_from_slice(&(sample.len() as u32 + 1).to_le_bytes());

        assert!(project_items_from_span_table(sample.as_bytes(), &table).is_err());
    }

    #[test]
    fn item_rows_projection_from_table_returns_converter_rows() {
        let sample =
            "<root><item id=\"7\"><name>Alice</name><value>안녕</value></item><item id=\"11\"><name>Bob</name><value>cafe</value></item></root>";
        let result = parse_item_rows_via_table(sample.as_bytes()).unwrap();

        assert_eq!(result.input_bytes, sample.len() as f64);
        assert_eq!(result.event_count, 20);
        assert_eq!(result.max_depth, 3);
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0].id, 7);
        assert_eq!(result.rows[0].name, "Alice");
        assert_eq!(result.rows[0].value, "안녕");
        assert_eq!(result.rows[1].id, 11);
        assert_eq!(result.rows[1].name, "Bob");
        assert_eq!(result.rows[1].value, "cafe");
    }

    #[test]
    fn object_rows_projection_supports_generic_object_fields() {
        let sample =
            "<root><entry code=\"a\"><label>Alice</label><score>7</score></entry><entry code=\"b\"><label>Bob</label><score></score></entry><entry code=\"c\"><label>Cy</label></entry></root>";
        let spec = ObjectRowsProjectionSpec {
            item_name: "entry".to_owned(),
            fields: vec![
                ObjectRowsProjectionFieldSpec {
                    output_name: "code".to_owned(),
                    value_kind: "string".to_owned(),
                    source_kind: "attribute".to_owned(),
                    source_name: "code".to_owned(),
                    text_mode: "direct".to_owned(),
                },
                ObjectRowsProjectionFieldSpec {
                    output_name: "label".to_owned(),
                    value_kind: "string".to_owned(),
                    source_kind: "element".to_owned(),
                    source_name: "label".to_owned(),
                    text_mode: "subtree".to_owned(),
                },
                ObjectRowsProjectionFieldSpec {
                    output_name: "score".to_owned(),
                    value_kind: "number".to_owned(),
                    source_kind: "element".to_owned(),
                    source_name: "score".to_owned(),
                    text_mode: "subtree".to_owned(),
                },
            ],
        };

        let result = parse_object_rows(sample.as_bytes(), &spec).unwrap();
        let table_result = parse_object_rows_via_table(sample.as_bytes(), &spec).unwrap();

        assert_eq!(result.input_bytes, sample.len() as f64);
        assert_eq!(result.event_count, 24);
        assert_eq!(result.max_depth, 3);
        assert_eq!(result.field_count, 3);
        assert_eq!(result.row_count, 3);
        assert_eq!(table_result.row_count, result.row_count);
        assert_eq!(table_result.field_count, result.field_count);
        assert_eq!(result.columns[0].present, vec![true, true, true]);
        assert_eq!(result.columns[0].values, vec!["a", "b", "c"]);
        assert_eq!(result.columns[1].present, vec![true, true, true]);
        assert_eq!(result.columns[1].values, vec!["Alice", "Bob", "Cy"]);
        assert_eq!(result.columns[2].present, vec![true, true, false]);
        assert!(result.columns[2].values.is_empty());
        assert_eq!(result.columns[2].number_values[0], 7.0);
        assert!(result.columns[2].number_values[1].is_nan());
        assert_eq!(result.columns[2].number_values[2], 0.0);
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

    #[test]
    fn ffi_utf16_units_reports_error_statuses() {
        let units: Vec<u16> = "<root>".encode_utf16().collect();
        let mut out = FfiAggregateResult {
            event_count: 0,
            checksum: 0,
            attr_count_total: 0,
            object_count: 0,
            input_units: 0,
        };

        assert_eq!(
            unsafe {
                stax_xml_parse_aggregate_utf16_units(
                    std::ptr::null(),
                    0,
                    0,
                    &mut out as *mut FfiAggregateResult,
                )
            },
            -1
        );
        assert_eq!(
            unsafe {
                stax_xml_parse_aggregate_utf16_units(
                    units.as_ptr(),
                    units.len(),
                    0,
                    std::ptr::null_mut(),
                )
            },
            -1
        );
        assert_eq!(
            unsafe {
                stax_xml_parse_aggregate_utf16_units(
                    units.as_ptr(),
                    units.len(),
                    99,
                    &mut out as *mut FfiAggregateResult,
                )
            },
            -3
        );
        assert_eq!(
            unsafe {
                stax_xml_parse_aggregate_utf16_units(
                    units.as_ptr(),
                    units.len(),
                    0,
                    &mut out as *mut FfiAggregateResult,
                )
            },
            -2
        );
    }

    #[test]
    fn tier_parsing_accepts_known_names_and_rejects_unknown_names() {
        assert_eq!(
            parse_tier("event-count-unsafe-gt").unwrap(),
            Tier::EventCountUnsafeGt
        );
        assert_eq!(
            parse_tier("event-count-byte-loop").unwrap(),
            Tier::EventCountByteLoop
        );
        assert_eq!(
            parse_tier("event-count-skip-quotes").unwrap(),
            Tier::EventCountSkipQuotes
        );
        assert_eq!(
            parse_tier("event-count-no-text").unwrap(),
            Tier::EventCountNoText
        );
        assert_eq!(
            parse_tier("event-count-no-checksum").unwrap(),
            Tier::EventCountNoChecksum
        );
        assert_eq!(
            parse_tier("event-count-no-text-no-checksum").unwrap(),
            Tier::EventCountNoTextNoChecksum
        );
        assert_eq!(
            parse_tier("event-count-two-stage").unwrap(),
            Tier::EventCountTwoStage
        );
        assert_eq!(
            parse_tier("event-count-auto-stage").unwrap(),
            Tier::EventCountAutoStage
        );
        assert_eq!(
            parse_tier("event-count-unchecked").unwrap(),
            Tier::EventCountUnchecked
        );
        assert_eq!(
            parse_tier("event-count-only").unwrap(),
            Tier::EventCountOnly
        );
        assert_eq!(parse_tier("count-only").unwrap(), Tier::CountOnly);
        assert_eq!(
            parse_tier("count-eq-two-stage").unwrap(),
            Tier::CountEqTwoStage
        );
        assert_eq!(
            parse_tier("count-auto-stage").unwrap(),
            Tier::CountAutoStage
        );
        assert_eq!(
            parse_tier("name-string-only").unwrap(),
            Tier::NameStringOnly
        );
        assert_eq!(
            parse_tier("text-string-only").unwrap(),
            Tier::TextStringOnly
        );
        assert_eq!(
            parse_tier("attr-value-string-only").unwrap(),
            Tier::AttrValueStringOnly
        );
        assert_eq!(
            parse_tier("full-string-direct").unwrap(),
            Tier::FullStringDirect
        );
        assert_eq!(
            parse_tier("event-object-full").unwrap(),
            Tier::EventObjectFull
        );
        assert!(parse_tier("missing").is_err());
        assert_eq!(tier_name(Tier::EventCountUnsafeGt), "event-count-unsafe-gt");
        assert_eq!(tier_name(Tier::EventCountByteLoop), "event-count-byte-loop");
        assert_eq!(
            tier_name(Tier::EventCountSkipQuotes),
            "event-count-skip-quotes"
        );
        assert_eq!(tier_name(Tier::EventCountNoText), "event-count-no-text");
        assert_eq!(
            tier_name(Tier::EventCountNoChecksum),
            "event-count-no-checksum"
        );
        assert_eq!(
            tier_name(Tier::EventCountNoTextNoChecksum),
            "event-count-no-text-no-checksum"
        );
        assert_eq!(tier_name(Tier::EventCountTwoStage), "event-count-two-stage");
        assert_eq!(
            tier_name(Tier::EventCountAutoStage),
            "event-count-auto-stage"
        );
        assert_eq!(
            tier_name(Tier::EventCountUnchecked),
            "event-count-unchecked"
        );
        assert_eq!(tier_name(Tier::EventCountOnly), "event-count-only");
        assert_eq!(tier_name(Tier::CountOnly), "count-only");
        assert_eq!(tier_name(Tier::CountEqTwoStage), "count-eq-two-stage");
        assert_eq!(tier_name(Tier::CountAutoStage), "count-auto-stage");
        assert_eq!(tier_name(Tier::NameStringOnly), "name-string-only");
        assert_eq!(tier_name(Tier::TextStringOnly), "text-string-only");
        assert_eq!(
            tier_name(Tier::AttrValueStringOnly),
            "attr-value-string-only"
        );
        assert_eq!(tier_name(Tier::FullStringDirect), "full-string-direct");
        assert_eq!(tier_name(Tier::EventObjectFull), "event-object-full");

        assert_eq!(parse_simd_policy("").unwrap(), SimdPolicy::Auto);
        assert_eq!(parse_simd_policy("auto").unwrap(), SimdPolicy::Auto);
        assert_eq!(parse_simd_policy("auto-safe").unwrap(), SimdPolicy::Auto);
        assert_eq!(parse_simd_policy("off").unwrap(), SimdPolicy::Off);
        assert_eq!(parse_simd_policy("scalar").unwrap(), SimdPolicy::Off);
        assert_eq!(parse_simd_policy("avx2").unwrap(), SimdPolicy::Avx2);
        assert_eq!(parse_simd_policy("sse42").unwrap(), SimdPolicy::Sse42);
        assert_eq!(parse_simd_policy("sse4.2").unwrap(), SimdPolicy::Sse42);
        assert_eq!(parse_simd_policy("neon").unwrap(), SimdPolicy::Neon);
        assert!(parse_simd_policy("missing").is_err());
    }

    #[test]
    fn utf8_parser_covers_markup_boundaries_and_errors() {
        for input in [
            &b""[..],
            &b"text only"[..],
            &b"   "[..],
            &b"< />"[..],
            &b"<root ></root>"[..],
            &b"<a/b></a>"[..],
            &b"<root></ root >"[..],
            &b"<root><!--ok--><!DOCTYPE note><!ENTITY x y><?pi ok?><child><![CDATA[data]]></child><empty /></root>"[..],
        ] {
            parse_aggregate(input, Tier::CountOnly).unwrap();
        }

        for input in [
            &b"<"[..],
            &b"<>"[..],
            &b"<root"[..],
            &b"<root>"[..],
            &b"</"[..],
            &b"</>"[..],
            &b"</root>"[..],
            &b"</ root >"[..],
            &b"<a></b>"[..],
            &b"<![CDATA[open"[..],
            &b"<!--open"[..],
            &b"<!DOCTYPE"[..],
            &b"<!BROKEN"[..],
            &b"<?xml version=\"1.0\""[..],
            &b"<?pi"[..],
        ] {
            assert!(
                parse_aggregate(input, Tier::CountOnly).is_err(),
                "expected utf8 parser to reject {}",
                String::from_utf8_lossy(input)
            );
        }
    }

    #[test]
    fn utf16_parser_covers_markup_boundaries_and_errors() {
        for input in [
            "",
            "text only",
            "   ",
            "< />",
            "<root ></root>",
            "<a/b></a>",
            "<root></ root >",
            "<root><!--ok--><!DOCTYPE note><!ENTITY x y><?pi ok?><child><![CDATA[data]]></child><empty /></root>",
        ] {
            parse_aggregate_utf16(&utf16(input), Tier::CountOnly).unwrap();
        }

        for input in [
            "<",
            "<>",
            "<root",
            "<root>",
            "</",
            "</>",
            "</root>",
            "</ root >",
            "<a></b>",
            "<![CDATA[open",
            "<!--open",
            "<!DOCTYPE",
            "<!BROKEN",
            "<?xml version=\"1.0\"",
            "<?pi",
        ] {
            assert!(
                parse_aggregate_utf16(&utf16(input), Tier::CountOnly).is_err(),
                "expected utf16 parser to reject {input}"
            );
        }
    }

    #[test]
    fn span_table_parser_covers_markup_boundaries_and_errors() {
        for input in [
            "",
            "text only",
            "   ",
            "< />",
            "<root ></root>",
            "<a/b></a>",
            "<root></ root >",
            "<root><!--ok--><!DOCTYPE note><!ENTITY x y><?pi ok?><child><![CDATA[data]]></child><empty /></root>",
        ] {
            parse_span_table_utf16(&utf16(input)).unwrap();
        }

        for input in [
            "<",
            "<>",
            "<root",
            "<root>",
            "</",
            "</>",
            "</root>",
            "</ root >",
            "<a></b>",
            "<![CDATA[open",
            "<!--open",
            "<!DOCTYPE",
            "<!BROKEN",
            "<?xml version=\"1.0\"",
            "<?pi",
        ] {
            assert!(
                parse_span_table_utf16(&utf16(input)).is_err(),
                "expected span table parser to reject {input}"
            );
        }
    }

    #[test]
    fn attribute_scanners_cover_edge_cases_and_overflow() {
        assert_eq!(parse_attributes(b"", 0, 0).len(), 0);
        assert_eq!(parse_attributes(b"   ", 0, 3).len(), 0);
        assert_eq!(parse_attributes(b"name", 0, 4).len(), 1);
        assert_eq!(parse_attributes(b"name other", 0, 10).len(), 2);
        assert_eq!(parse_attributes(b"name = \"v\"", 0, 10).len(), 1);
        assert_eq!(parse_attributes(b"name='v'", 0, 8).len(), 1);
        assert_eq!(parse_attributes(b"name=   ", 0, 8).len(), 0);
        assert_eq!(parse_attributes(b"name=x", 0, 6).len(), 0);
        assert_eq!(parse_attributes(b"name=\"unterminated", 0, 18).len(), 0);
        assert_eq!(count_attributes(b"name other", 0, 10), 2);
        assert_eq!(count_attributes(b"name=\"unterminated", 0, 18), 0);

        let many = b"a0=\"0\" a1=\"1\" a2=\"2\" a3=\"3\" a4=\"4\" a5=\"5\" a6=\"6\" a7=\"7\" a8=\"8\" a9=\"9\" a10=\"10\" a11=\"11\" a12=\"12\" a13=\"13\" a14=\"14\" a15=\"15\" a16=\"16\"";
        let attrs = parse_attributes(many, 0, many.len());
        assert_eq!(attrs.len(), 17);
        assert_eq!(count_attributes(many, 0, many.len()), 17);
        assert_eq!(attrs.overflow_len_for_test(), 1);
        assert_eq!(attrs.to_vec_for_test().len(), 17);
    }

    #[test]
    fn utf16_attribute_scanner_covers_edge_cases_and_overflow() {
        assert_eq!(parse_attributes_utf16(&utf16(""), 0, 0).len(), 0);
        assert_eq!(parse_attributes_utf16(&utf16("   "), 0, 3).len(), 0);
        assert_eq!(parse_attributes_utf16(&utf16("name"), 0, 4).len(), 1);
        assert_eq!(parse_attributes_utf16(&utf16("name other"), 0, 10).len(), 2);
        assert_eq!(
            parse_attributes_utf16(&utf16("name = \"v\""), 0, 10).len(),
            1
        );
        assert_eq!(parse_attributes_utf16(&utf16("name='v'"), 0, 8).len(), 1);
        assert_eq!(parse_attributes_utf16(&utf16("name=   "), 0, 8).len(), 0);
        assert_eq!(parse_attributes_utf16(&utf16("name=x"), 0, 6).len(), 0);
        assert_eq!(
            parse_attributes_utf16(&utf16("name=\"unterminated"), 0, 18).len(),
            0
        );
        assert_eq!(count_attributes_utf16(&utf16("name other"), 0, 10), 2);
        assert_eq!(
            count_attributes_utf16(&utf16("name=\"unterminated"), 0, 18),
            0
        );

        let many =
            "a0=\"0\" a1=\"1\" a2=\"2\" a3=\"3\" a4=\"4\" a5=\"5\" a6=\"6\" a7=\"7\" a8=\"8\" a9=\"9\" a10=\"10\" a11=\"11\" a12=\"12\" a13=\"13\" a14=\"14\" a15=\"15\" a16=\"16\"";
        let attrs = parse_attributes_utf16(&utf16(many), 0, many.encode_utf16().count());
        assert_eq!(attrs.len(), 17);
        assert_eq!(
            count_attributes_utf16(&utf16(many), 0, many.encode_utf16().count()),
            17
        );
        assert_eq!(attrs.overflow_len_for_test(), 1);
        assert_eq!(attrs.to_vec_for_test().len(), 17);
    }

    #[test]
    fn low_level_helpers_cover_negative_and_boundary_paths() {
        assert_eq!(fold_string(9, ""), 9);

        assert!(starts_with(b"abc", 0, b"ab"));
        assert!(!starts_with(b"abc", 2, b"abc"));
        assert!(!starts_with(b"abc", 0, b"ax"));

        let abc = utf16("abc");
        assert!(starts_with_ascii_u16(&abc, 0, b"ab"));
        assert!(!starts_with_ascii_u16(&abc, 2, b"abc"));
        assert!(!starts_with_ascii_u16(&abc, 0, b"ax"));

        assert_eq!(find_bytes(b"abc", b"", 0), None);
        assert_eq!(find_bytes(b"abc", b"a", 3), None);
        assert_eq!(find_bytes(b"ab", b"abc", 1), None);
        assert_eq!(find_bytes(b"bbb", b"a", 0), None);
        assert_eq!(find_bytes(b"abac", b"ac", 0), Some(2));

        assert_eq!(find_ascii_sequence_u16(&abc, b"", 0), None);
        assert_eq!(find_ascii_sequence_u16(&abc, b"a", 3), None);
        assert_eq!(find_ascii_sequence_u16(&utf16("ab"), b"abc", 1), None);
        assert_eq!(find_ascii_sequence_u16(&utf16("bbb"), b"a", 0), None);
        assert_eq!(find_ascii_sequence_u16(&utf16("abac"), b"ac", 0), Some(2));

        assert_eq!(find_unit(&[1, 2], 3, 0, 2), None);
        assert_eq!(find_unit(&[1], 1, 1, 1), None);
        assert_eq!(find_unit(&[1, 2], 2, 0, 9), Some(1));

        assert_eq!(skip_whitespace(b"        <x", 0), 8);
        assert_eq!(skip_whitespace(b"text", 0), 0);
        assert_eq!(skip_whitespace_until(b"  \n\tname=\"v\"", 0, 12), 4);
        assert!(!has_non_whitespace(b" \n\r\t        ", 0, 12));
        assert!(has_non_whitespace(b" \n\r\tvalue", 0, 8));
        assert!(is_whitespace_only(b"        ", 0, 8));
        assert!(!is_whitespace_only(b"       x", 0, 8));

        assert_eq!(trim_units(&utf16(""), 0, 0), (0, 0));
        assert_eq!(trim_units(&utf16("x"), 0, 1), (0, 1));
        assert_eq!(trim_units(&utf16(" x "), 0, 3), (1, 2));
        assert_eq!(trim_units(&utf16("   "), 0, 3), (3, 3));

        let double_quote = br#"<item text="it's fine">"#;
        assert_eq!(find_tag_end(double_quote, 1), Some(double_quote.len() - 1));
        let single_quote = br#"<item text='a " b'>"#;
        assert_eq!(find_tag_end(single_quote, 1), Some(single_quote.len() - 1));

        let double_quote_utf16 = utf16("<item text=\"it's fine\">");
        assert_eq!(
            find_tag_end_utf16(&double_quote_utf16, 1),
            Some(double_quote_utf16.len() - 1)
        );
        let single_quote_utf16 = utf16("<item text='a \" b'>");
        assert_eq!(
            find_tag_end_utf16(&single_quote_utf16, 1),
            Some(single_quote_utf16.len() - 1)
        );
    }

    fn utf16(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
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

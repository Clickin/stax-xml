// simdxml notice:
// The native aggregate structural-scanner diagnostics and quote-skipping
// scanner shape are informed by and partially adapted from simdxml
// (https://github.com/simdxml/simdxml), which is licensed MIT OR Apache-2.0.
// stax-xml uses those ideas under simdxml's MIT license option.
use super::*;

pub(crate) const START_DOCUMENT: u8 = 0;
pub(crate) const END_DOCUMENT: u8 = 1;
pub(crate) const START_ELEMENT: u8 = 2;
pub(crate) const END_ELEMENT: u8 = 3;
pub(crate) const CHARACTERS: u8 = 4;
pub(crate) const CDATA: u8 = 5;
pub(crate) const INLINE_ATTR_SPANS: usize = 16;
pub(crate) const SPAN_TABLE_MAGIC: u32 = 0x3154_5053;
pub(crate) const SPAN_TABLE_HEADER_U32S: usize = 7;
pub(crate) const SPAN_TABLE_HEADER_BYTES: usize = SPAN_TABLE_HEADER_U32S * 4;
pub(crate) const SPAN_TABLE_EVENT_FIELDS: usize = 7;
pub(crate) const SPAN_TABLE_EVENT_BYTES: usize = SPAN_TABLE_EVENT_FIELDS * 4;
pub(crate) const SPAN_TABLE_ATTR_FIELDS: usize = 4;
pub(crate) const SPAN_TABLE_ATTR_BYTES: usize = SPAN_TABLE_ATTR_FIELDS * 4;
pub(crate) const NO_SPAN: i32 = -1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Tier {
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
pub(crate) enum SimdPolicy {
    Auto,
    Off,
    Avx2,
    Sse42,
    Neon,
}

impl Tier {
    pub(crate) fn needs_start_attributes(self) -> bool {
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

    pub(crate) fn validates_element_stack(self) -> bool {
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

    pub(crate) fn tag_end_strategy(self) -> TagEndStrategy {
        match self {
            Self::EventCountUnsafeGt => TagEndStrategy::UnsafeGt,
            Self::EventCountByteLoop => TagEndStrategy::ByteLoop,
            Self::EventCountSkipQuotes => TagEndStrategy::SkipQuotes,
            _ => TagEndStrategy::Default,
        }
    }

    pub(crate) fn skips_text_events(self) -> bool {
        matches!(
            self,
            Self::EventCountNoText | Self::EventCountNoTextNoChecksum
        )
    }

    pub(crate) fn folds_event_checksum(self) -> bool {
        !matches!(
            self,
            Self::EventCountNoChecksum | Self::EventCountNoTextNoChecksum
        )
    }

    pub(crate) fn needs_start_name(self) -> bool {
        self.validates_element_stack() || self.needs_start_attributes()
    }

    pub(crate) fn uses_two_stage_bytes(self) -> bool {
        matches!(self, Self::EventCountTwoStage | Self::CountEqTwoStage)
    }

    pub(crate) fn uses_auto_stage_bytes(self) -> bool {
        matches!(self, Self::EventCountAutoStage | Self::CountAutoStage)
    }

    pub(crate) fn uses_fast_event_count_bytes(self) -> bool {
        matches!(
            self,
            Self::EventCountNoText | Self::EventCountNoTextNoChecksum
        )
    }
}

#[derive(Clone, Copy)]
pub(crate) enum TagEndStrategy {
    Default,
    ByteLoop,
    SkipQuotes,
    UnsafeGt,
}

/// Benchmark-oriented aggregate counters are intentionally exposed as u32.
///
/// The public N-API shape treats these counters as modulo 2^32 values. Callers
/// that need exact counts beyond u32::MAX should partition input externally.
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct AggregateResult {
    pub tier: String,
    pub input_bytes: f64,
    pub event_count: u32,
    pub checksum: i32,
    pub attr_count_total: u32,
    pub object_count: u32,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct ItemProjectionResult {
    pub input_bytes: f64,
    pub item_count: u32,
    pub checksum: i32,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct ItemProjectionRecord {
    pub id: i32,
    pub name: String,
    pub value: String,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct ItemProjectionRowsResult {
    pub input_bytes: f64,
    pub event_count: u32,
    pub max_depth: u32,
    pub rows: Vec<ItemProjectionRecord>,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct ObjectRowsProjectionSpec {
    pub item_name: String,
    pub fields: Vec<ObjectRowsProjectionFieldSpec>,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct ObjectRowsProjectionFieldSpec {
    pub output_name: String,
    pub value_kind: String,
    pub source_kind: String,
    pub source_name: String,
    pub text_mode: String,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct ObjectRowsProjectionColumn {
    pub present: Vec<bool>,
    pub values: Vec<String>,
    pub number_values: Vec<f64>,
    pub span_starts: Vec<i32>,
    pub span_ends: Vec<i32>,
}

#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
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
pub(crate) struct AggregateState {
    pub(crate) event_count: u32,
    pub(crate) checksum: i32,
    pub(crate) attr_count_total: u32,
    pub(crate) object_count: u32,
    pub(crate) object_sink: Vec<NativeEventObject>,
}

pub(crate) struct NativeEventObject {
    pub(crate) event_type: u8,
    pub(crate) name: Option<String>,
    pub(crate) text: Option<String>,
    pub(crate) attributes: Vec<(String, String)>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct AttrSpan {
    pub(crate) name_start: usize,
    pub(crate) name_end: usize,
    pub(crate) value_start: usize,
    pub(crate) value_end: usize,
}

pub(crate) struct AttrSpans {
    pub(crate) len: usize,
    pub(crate) inline: [MaybeUninit<AttrSpan>; INLINE_ATTR_SPANS],
    pub(crate) overflow: Vec<AttrSpan>,
}

pub(crate) struct AttrSpanIter<'a> {
    pub(crate) spans: &'a AttrSpans,
    pub(crate) index: usize,
}

pub(crate) struct Parser<'a> {
    pub(crate) input: &'a [u8],
    pub(crate) tier: Tier,
    pub(crate) state: AggregateState,
    pub(crate) element_stack: Vec<(usize, usize)>,
}

pub(crate) struct Utf16Parser<'a> {
    pub(crate) input: &'a [u16],
    pub(crate) tier: Tier,
    pub(crate) state: AggregateState,
    pub(crate) element_stack: Vec<(usize, usize)>,
}

pub(crate) struct SpanTableParser<'a> {
    pub(crate) input: &'a [u8],
    pub(crate) table: SpanTableBuilder,
    pub(crate) element_stack: Vec<(usize, usize)>,
}

pub(crate) struct SpanTableBuilder {
    pub(crate) input_units: u32,
    pub(crate) flags: u32,
    pub(crate) table: Vec<u8>,
    pub(crate) attrs: Vec<u8>,
    pub(crate) event_count: u32,
    pub(crate) attr_count: u32,
}

pub(crate) struct ItemProjectionParser<'a> {
    pub(crate) input: &'a [u8],
    pub(crate) rows: Vec<ItemProjectionRow>,
    pub(crate) element_stack: Vec<(usize, usize)>,
    pub(crate) current_item: Option<CurrentItemProjection>,
    pub(crate) capture: Option<ItemProjectionCapture>,
}

pub(crate) struct ObjectRowsProjectionParser<'a> {
    pub(crate) input: &'a [u8],
    pub(crate) spec: NormalizedObjectRowsSpec,
    pub(crate) state: ObjectRowsProjectionState,
    pub(crate) event_count: u32,
    pub(crate) element_stack: Vec<(usize, usize)>,
}

#[derive(Clone, Copy)]
pub(crate) struct ItemProjectionRow {
    pub(crate) id: i32,
    pub(crate) name_start: usize,
    pub(crate) name_end: usize,
    pub(crate) value_start: usize,
    pub(crate) value_end: usize,
}

pub(crate) struct CurrentItemProjection {
    pub(crate) depth: usize,
    pub(crate) id: i32,
    pub(crate) name: Option<(usize, usize)>,
    pub(crate) value: Option<(usize, usize)>,
}

#[derive(Clone, Copy)]
pub(crate) enum ItemProjectionField {
    Name,
    Value,
}

#[derive(Clone, Copy)]
pub(crate) struct ItemProjectionCapture {
    pub(crate) depth: usize,
    pub(crate) field: ItemProjectionField,
}

pub(crate) struct SpanTableUtf16Parser<'a> {
    pub(crate) input: &'a [u16],
    pub(crate) table: SpanTableBuilder,
    pub(crate) element_stack: Vec<(usize, usize)>,
}

pub(crate) struct SpanEventRecord {
    pub(crate) event_type: u32,
    pub(crate) name_start: i32,
    pub(crate) name_end: i32,
    pub(crate) text_start: i32,
    pub(crate) text_end: i32,
    pub(crate) attr_start: u32,
    pub(crate) attr_count: u32,
}

pub(crate) struct SpanAttrRecord {
    pub(crate) name_start: i32,
    pub(crate) name_end: i32,
    pub(crate) value_start: i32,
    pub(crate) value_end: i32,
}

pub(crate) struct ParsedSpanTable<'a> {
    pub(crate) events: &'a [u8],
    pub(crate) attrs: &'a [u8],
    pub(crate) event_count: u32,
    pub(crate) attr_count: u32,
    pub(crate) input_units: u32,
    pub(crate) flags: u32,
}

#[derive(Clone, Copy)]
pub(crate) struct TableEventRecord {
    pub(crate) event_type: u32,
    pub(crate) name_start: i32,
    pub(crate) name_end: i32,
    pub(crate) text_start: i32,
    pub(crate) text_end: i32,
    pub(crate) attr_start: u32,
    pub(crate) attr_count: u32,
}

#[derive(Clone, Copy)]
pub(crate) struct TableAttrRecord {
    pub(crate) name_start: i32,
    pub(crate) name_end: i32,
    pub(crate) value_start: i32,
    pub(crate) value_end: i32,
}

pub(crate) struct TableProjectionState {
    pub(crate) depth: usize,
    pub(crate) max_depth: usize,
    pub(crate) current_item: Option<CurrentItemProjection>,
    pub(crate) capture: Option<ItemProjectionCapture>,
    pub(crate) rows: Vec<ItemProjectionRow>,
}

pub(crate) struct TableProjectionOutcome {
    pub(crate) event_count: u32,
    pub(crate) max_depth: usize,
    pub(crate) rows: Vec<ItemProjectionRow>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ObjectRowsSourceKind {
    Attribute,
    Element,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ObjectRowsTextMode {
    Direct,
    Subtree,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ObjectRowsValueKind {
    String,
    Number,
}

pub(crate) struct NormalizedObjectRowsField {
    pub(crate) value_kind: ObjectRowsValueKind,
    pub(crate) source_kind: ObjectRowsSourceKind,
    pub(crate) source_name: Vec<u8>,
    pub(crate) text_mode: ObjectRowsTextMode,
}

pub(crate) struct NormalizedObjectRowsSpec {
    pub(crate) item_name: Vec<u8>,
    pub(crate) fields: Vec<NormalizedObjectRowsField>,
}

pub(crate) struct ObjectRowsProjectionState {
    pub(crate) depth: usize,
    pub(crate) max_depth: usize,
    pub(crate) current_row: Option<CurrentObjectRowsProjection>,
    pub(crate) capture: Option<ObjectRowsProjectionCapture>,
    pub(crate) row_count: usize,
    pub(crate) columns: Vec<ObjectRowsProjectionColumn>,
}

pub(crate) struct CurrentObjectRowsProjection {
    pub(crate) depth: usize,
    pub(crate) completed: Vec<bool>,
    pub(crate) present: Vec<bool>,
    pub(crate) values: Vec<String>,
    pub(crate) number_values: Vec<f64>,
    pub(crate) number_buffers: Vec<Vec<u8>>,
}

pub(crate) struct ObjectRowsProjectionCapture {
    pub(crate) depth: usize,
    pub(crate) field_indices: Vec<usize>,
    pub(crate) text_mode: ObjectRowsTextMode,
}

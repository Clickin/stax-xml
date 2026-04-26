use super::*;

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

pub(crate) fn parse_tier(value: &str) -> Result<Tier> {
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

pub(crate) fn parse_simd_policy(value: &str) -> Result<SimdPolicy> {
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

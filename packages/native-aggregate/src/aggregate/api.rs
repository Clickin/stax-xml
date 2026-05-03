use super::*;

#[cfg(feature = "napi-bindings")]
use napi::bindgen_prelude::{Buffer, Uint8Array};
#[cfg(feature = "napi-bindings")]
use std::fs;

#[cfg(feature = "napi-bindings")]
fn to_napi_result<T>(result: Result<T>) -> napi::Result<T> {
    result.map_err(napi::Error::from)
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_aggregate_buffer(input: Buffer, tier: String) -> napi::Result<AggregateResult> {
    let tier = parse_tier(&tier).map_err(napi::Error::from)?;
    to_napi_result(parse_aggregate(input.as_ref(), tier))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_aggregate_buffer_with_simd(
    input: Buffer,
    tier: String,
    simd: String,
) -> napi::Result<AggregateResult> {
    let tier = parse_tier(&tier).map_err(napi::Error::from)?;
    let simd = parse_simd_policy(&simd).map_err(napi::Error::from)?;
    to_napi_result(parse_aggregate_with_simd_policy(input.as_ref(), tier, simd))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_aggregate_uint8array(
    input: Uint8Array,
    tier: String,
) -> napi::Result<AggregateResult> {
    let tier = parse_tier(&tier).map_err(napi::Error::from)?;
    to_napi_result(parse_aggregate(input.as_ref(), tier))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_aggregate_uint8array_with_simd(
    input: Uint8Array,
    tier: String,
    simd: String,
) -> napi::Result<AggregateResult> {
    let tier = parse_tier(&tier).map_err(napi::Error::from)?;
    let simd = parse_simd_policy(&simd).map_err(napi::Error::from)?;
    to_napi_result(parse_aggregate_with_simd_policy(input.as_ref(), tier, simd))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_aggregate_file(path: String, tier: String) -> napi::Result<AggregateResult> {
    let tier = parse_tier(&tier).map_err(napi::Error::from)?;
    let bytes = fs::read(path).map_err(|error| napi::Error::from_reason(error.to_string()))?;
    to_napi_result(parse_aggregate(&bytes, tier))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn collect_full_string_values_file(path: String) -> napi::Result<FullStringValuesResult> {
    let bytes = fs::read(path).map_err(|error| napi::Error::from_reason(error.to_string()))?;
    to_napi_result(collect_full_string_values(&bytes))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi(object))]
pub struct FullStringArenaResult {
    pub input_bytes: f64,
    pub event_count: u32,
    pub checksum: i32,
    pub attr_count_total: u32,
    pub object_count: u32,
    pub string_count: u32,
    pub string_units: f64,
    pub arena: String,
    pub offsets: Buffer,
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn collect_full_string_arena_file(path: String) -> napi::Result<FullStringArenaResult> {
    let bytes = fs::read(path).map_err(|error| napi::Error::from_reason(error.to_string()))?;
    let result = to_napi_result(collect_full_string_arena(&bytes))?;
    Ok(FullStringArenaResult {
        input_bytes: result.input_bytes,
        event_count: result.event_count,
        checksum: result.checksum,
        attr_count_total: result.attr_count_total,
        object_count: result.object_count,
        string_count: result.string_count,
        string_units: result.string_units,
        arena: result.arena,
        offsets: Buffer::from(result.offsets),
    })
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_aggregate_file_with_simd(
    path: String,
    tier: String,
    simd: String,
) -> napi::Result<AggregateResult> {
    let tier = parse_tier(&tier).map_err(napi::Error::from)?;
    let simd = parse_simd_policy(&simd).map_err(napi::Error::from)?;
    let bytes = fs::read(path).map_err(|error| napi::Error::from_reason(error.to_string()))?;
    to_napi_result(parse_aggregate_with_simd_policy(&bytes, tier, simd))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_aggregate_string_utf8(input: String, tier: String) -> napi::Result<AggregateResult> {
    let tier = parse_tier(&tier).map_err(napi::Error::from)?;
    to_napi_result(parse_aggregate(input.as_bytes(), tier))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_aggregate_string_utf8_with_simd(
    input: String,
    tier: String,
    simd: String,
) -> napi::Result<AggregateResult> {
    let tier = parse_tier(&tier).map_err(napi::Error::from)?;
    let simd = parse_simd_policy(&simd).map_err(napi::Error::from)?;
    to_napi_result(parse_aggregate_with_simd_policy(
        input.as_bytes(),
        tier,
        simd,
    ))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_span_table_uint8array(input: Uint8Array) -> napi::Result<Buffer> {
    to_napi_result(parse_span_table(input.as_ref())).map(Buffer::from)
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_structural_index_uint8array(input: Uint8Array) -> napi::Result<Buffer> {
    to_napi_result(parse_span_table(input.as_ref())).map(Buffer::from)
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_item_projection_uint8array(input: Uint8Array) -> napi::Result<ItemProjectionResult> {
    to_napi_result(parse_item_projection(input.as_ref()))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_item_projection_via_table_uint8array(
    input: Uint8Array,
) -> napi::Result<ItemProjectionResult> {
    to_napi_result(parse_item_projection_via_table(input.as_ref()))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_item_rows_via_table_uint8array(
    input: Uint8Array,
) -> napi::Result<ItemProjectionRowsResult> {
    to_napi_result(parse_item_rows_via_table(input.as_ref()))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_object_rows_via_table_uint8array(
    input: Uint8Array,
    spec: ObjectRowsProjectionSpec,
) -> napi::Result<ObjectRowsProjectionResult> {
    to_napi_result(parse_object_rows_via_table(input.as_ref(), &spec))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_object_rows_uint8array(
    input: Uint8Array,
    spec: ObjectRowsProjectionSpec,
) -> napi::Result<ObjectRowsProjectionResult> {
    to_napi_result(parse_object_rows(input.as_ref(), &spec))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_object_records_uint8array(
    input: Uint8Array,
    spec: ObjectRowsProjectionSpec,
) -> napi::Result<ObjectRecordsProjectionResult> {
    let output_names = object_rows_projection_output_names(&spec);
    let spec = to_napi_result(normalize_object_rows_spec(&spec))?;
    let result = to_napi_result(parse_object_rows_normalized(input.as_ref(), &spec))?;
    to_napi_result(object_rows_projection_to_records_json(
        input.as_ref(),
        &output_names,
        &spec.fields,
        result,
    ))
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn parse_document_nodes_uint8array(
    input: Uint8Array,
    options: Option<DocumentNodesProjectionOptions>,
) -> napi::Result<DocumentNodesProjectionResult> {
    to_napi_result(parse_document_nodes(
        input.as_ref(),
        options.as_ref().unwrap_or(&DocumentNodesProjectionOptions::default()),
    ))
}


#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub struct StaxXmlObjectProjectionPlan {
    spec: NormalizedObjectRowsSpec,
    output_names: Vec<String>,
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
pub fn create_object_projection_plan(
    spec: ObjectRowsProjectionSpec,
) -> napi::Result<StaxXmlObjectProjectionPlan> {
    Ok(StaxXmlObjectProjectionPlan {
        output_names: object_rows_projection_output_names(&spec),
        spec: to_napi_result(normalize_object_rows_spec(&spec))?,
    })
}

#[cfg(feature = "napi-bindings")]
#[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
impl StaxXmlObjectProjectionPlan {
    #[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
    pub fn project_rows(&self, input: Uint8Array) -> napi::Result<ObjectRowsProjectionResult> {
        to_napi_result(parse_object_rows_normalized(input.as_ref(), &self.spec))
    }

    #[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
    pub fn project_records(
        &self,
        input: Uint8Array,
    ) -> napi::Result<ObjectRecordsProjectionResult> {
        let result = to_napi_result(parse_object_rows_normalized(input.as_ref(), &self.spec))?;
        to_napi_result(object_rows_projection_to_records_json(
            input.as_ref(),
            &self.output_names,
            &self.spec.fields,
            result,
        ))
    }

    #[cfg_attr(all(feature = "napi-bindings", not(test)), napi)]
    pub fn project_schema_aware_records(
        &self,
        input: Uint8Array,
    ) -> napi::Result<ObjectRecordsProjectionResult> {
        to_napi_result(parse_object_records_normalized_direct(
            input.as_ref(),
            &self.output_names,
            &self.spec,
        ))
    }
}

fn object_rows_projection_to_records_json(
    input: &[u8],
    output_names: &[String],
    fields: &[NormalizedObjectRowsField],
    result: ObjectRowsProjectionResult,
) -> Result<ObjectRecordsProjectionResult> {
    let row_count = result.row_count as usize;
    if result.columns.len() != fields.len() || fields.len() != output_names.len() {
        return Err(Error::from_reason(
            "Object records projection column count mismatch",
        ));
    }

    let mut json = String::with_capacity(row_count.saturating_mul(fields.len()).saturating_mul(16));
    json.push('[');
    for row_index in 0..row_count {
        if row_index > 0 {
            json.push(',');
        }
        json.push('{');
        for (field_index, field) in fields.iter().enumerate() {
            if field_index > 0 {
                json.push(',');
            }
            push_json_string(&mut json, &output_names[field_index]);
            json.push(':');
            let Some(column) = result.columns.get(field_index) else {
                return Err(Error::from_reason(
                    "Object records projection column missing",
                ));
            };
            let is_present = column.present.get(row_index).copied().unwrap_or(false);
            if field.value_kind == ObjectRowsValueKind::Number {
                let value = if is_present {
                    column
                        .number_values
                        .get(row_index)
                        .copied()
                        .unwrap_or(f64::NAN)
                } else {
                    f64::NAN
                };
                if value.is_finite() {
                    use std::fmt::Write;
                    write!(&mut json, "{value}")
                        .map_err(|error| Error::from_reason(error.to_string()))?;
                } else {
                    json.push_str("null");
                }
            } else {
                let value = if is_present {
                    object_rows_projection_string_value(input, column, row_index)?
                } else {
                    ""
                };
                push_json_string(&mut json, value);
            }
        }
        json.push('}');
    }
    json.push(']');

    Ok(ObjectRecordsProjectionResult {
        input_bytes: result.input_bytes,
        event_count: result.event_count,
        max_depth: result.max_depth,
        field_count: result.field_count,
        row_count: result.row_count,
        json,
    })
}

fn object_rows_projection_string_value<'a>(
    input: &'a [u8],
    column: &'a ObjectRowsProjectionColumn,
    row_index: usize,
) -> Result<&'a str> {
    let start = column.span_starts.get(row_index).copied().unwrap_or(-1);
    let end = column.span_ends.get(row_index).copied().unwrap_or(-1);
    if start >= 0 && end >= start {
        let start = start as usize;
        let end = end as usize;
        let Some(bytes) = input.get(start..end) else {
            return Err(Error::from_reason(
                "Object records projection string span out of range",
            ));
        };
        return std::str::from_utf8(bytes).map_err(|error| Error::from_reason(error.to_string()));
    }
    Ok(column.values.get(row_index).map_or("", String::as_str))
}

fn push_json_string(out: &mut String, value: &str) {
    out.push('"');
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            ch if ch <= '\u{1f}' => {
                use std::fmt::Write;
                let _ = write!(out, "\\u{:04x}", ch as u32);
            }
            ch => out.push(ch),
        }
    }
    out.push('"');
}

fn object_rows_projection_output_names(spec: &ObjectRowsProjectionSpec) -> Vec<String> {
    spec.fields
        .iter()
        .map(|field| field.output_name.clone())
        .collect()
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

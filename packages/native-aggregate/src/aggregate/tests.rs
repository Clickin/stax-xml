use super::*;
#[cfg(feature = "napi-bindings")]
use napi::bindgen_prelude::{Buffer, Uint8Array, Utf16String};

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
fn event_object_full_keeps_every_materialized_object() {
    let mut xml = String::from("<root>");
    for index in 0..1100 {
        xml.push_str(&format!("<item id=\"{index}\">value</item>"));
    }
    xml.push_str("</root>");

    let mut parser = Parser {
        input: xml.as_bytes(),
        tier: Tier::EventObjectFull,
        state: AggregateState::default(),
        element_stack: Vec::new(),
    };

    parser.parse().unwrap();

    assert!(parser.state.object_count > 1024);
    assert_eq!(
        parser.state.object_sink.len(),
        parser.state.object_count as usize
    );
}

#[test]
fn doctype_ignores_gt_inside_entity_quotes_across_native_parsers() {
    let doctype_xml =
        br#"<!DOCTYPE root [<!ENTITY foo "bar>baz"><!ENTITY single 'x>y'>]><root><item/></root>"#;
    let body_xml = br#"<root><item/></root>"#;

    for tier in [
        Tier::EventCountSkipQuotes,
        Tier::EventCountUnchecked,
        Tier::CountOnly,
        Tier::FullStringDirect,
        Tier::EventObjectFull,
    ] {
        let expected = parse_aggregate(body_xml, tier).unwrap();
        let actual = parse_aggregate(doctype_xml, tier).unwrap();
        assert_eq!(actual.event_count, expected.event_count, "{tier:?}");
        assert_eq!(actual.checksum, expected.checksum, "{tier:?}");
        assert_eq!(
            actual.attr_count_total, expected.attr_count_total,
            "{tier:?}"
        );
    }

    let expected_fast =
        parse_aggregate_fast_event_count(body_xml, Tier::EventCountOnly, Tier::EventCountOnly)
            .unwrap();
    let actual_fast =
        parse_aggregate_fast_event_count(doctype_xml, Tier::EventCountOnly, Tier::EventCountOnly)
            .unwrap();
    assert_eq!(actual_fast.event_count, expected_fast.event_count);
    assert_eq!(actual_fast.checksum, expected_fast.checksum);

    let expected_two_stage =
        parse_aggregate_two_stage(body_xml, Tier::EventCountTwoStage, SimdPolicy::Off).unwrap();
    let actual_two_stage =
        parse_aggregate_two_stage(doctype_xml, Tier::EventCountTwoStage, SimdPolicy::Off).unwrap();
    assert_eq!(actual_two_stage.event_count, expected_two_stage.event_count);
    assert_eq!(actual_two_stage.checksum, expected_two_stage.checksum);

    let doctype_units = utf16(std::str::from_utf8(doctype_xml).unwrap());
    let body_units = utf16(std::str::from_utf8(body_xml).unwrap());
    let expected_utf16 = parse_aggregate_utf16(&body_units, Tier::CountOnly).unwrap();
    let actual_utf16 = parse_aggregate_utf16(&doctype_units, Tier::CountOnly).unwrap();
    assert_eq!(actual_utf16.event_count, expected_utf16.event_count);
    assert_eq!(actual_utf16.checksum, expected_utf16.checksum);

    let expected_table = parse_span_table(body_xml).unwrap();
    let actual_table = parse_span_table(doctype_xml).unwrap();
    assert_eq!(read_u32(&actual_table, 4), read_u32(&expected_table, 4));
    assert_eq!(read_u32(&actual_table, 8), read_u32(&expected_table, 8));

    let expected_table_utf16 = parse_span_table_utf16(&body_units).unwrap();
    let actual_table_utf16 = parse_span_table_utf16(&doctype_units).unwrap();
    assert_eq!(
        read_u32(&actual_table_utf16, 4),
        read_u32(&expected_table_utf16, 4)
    );
    assert_eq!(
        read_u32(&actual_table_utf16, 8),
        read_u32(&expected_table_utf16, 8)
    );
}

#[test]
fn two_stage_aggregate_ignores_quoted_structural_bytes() {
    let input =
        br#"<root><item expr="left > right" eq="a=b">text</item><![CDATA[<raw>ok</raw>]]></root>"#;

    let two_stage = parse_aggregate(input, Tier::EventCountTwoStage).unwrap();
    let scalar_two_stage =
        parse_aggregate_with_simd_policy(input, Tier::EventCountTwoStage, SimdPolicy::Off).unwrap();
    let unchecked = parse_aggregate(input, Tier::EventCountUnchecked).unwrap();
    let eq_count = parse_aggregate(input, Tier::CountEqTwoStage).unwrap();
    let scalar_eq_count =
        parse_aggregate_with_simd_policy(input, Tier::CountEqTwoStage, SimdPolicy::Off).unwrap();
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
    assert!(
        parse_aggregate_with_simd_policy(input, Tier::EventCountTwoStage, SimdPolicy::Neon)
            .is_err()
    );
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
        let sse42_two_stage =
            parse_aggregate_with_simd_policy(input, Tier::EventCountTwoStage, SimdPolicy::Sse42)
                .unwrap();
        assert_eq!(sse42_two_stage.event_count, two_stage.event_count);
        assert_eq!(sse42_two_stage.checksum, two_stage.checksum);
    }

    #[cfg(target_arch = "aarch64")]
    {
        let neon_two_stage =
            parse_aggregate_with_simd_policy(input, Tier::EventCountTwoStage, SimdPolicy::Neon)
                .unwrap();
        assert_eq!(neon_two_stage.event_count, two_stage.event_count);
        assert_eq!(neon_two_stage.checksum, two_stage.checksum);
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
    assert_eq!(fold_trimmed_span(31, b"   ", 0, 3).unwrap(), 31);
    assert_eq!(
        fold_trimmed_span(31, " A안 ".as_bytes(), 0, " A안 ".len()).unwrap(),
        fold_string(31, "A안")
    );
    assert!(fold_span(31, &[0xff], 0, 1).is_err());

    assert_eq!(parse_float_prefix_end(b"+"), None);
    assert_eq!(parse_float_prefix_end(b"Infinity ms"), Some(8));
    assert_eq!(parse_float_prefix_end(b"."), None);
    assert_eq!(parse_float_prefix_end(b".5"), Some(2));
    assert_eq!(parse_float_prefix_end(b"1e+ms"), Some(1));
    assert_eq!(parse_float_prefix_end(b"1e"), Some(1));
    assert_eq!(parse_float_prefix_end(b"1e+"), Some(1));
    assert_eq!(parse_float_prefix_end(b"1e-2ms"), Some(4));
    assert_eq!(
        parse_f64_js_prefix_bytes(b"  -Infinity ms").unwrap(),
        f64::NEG_INFINITY
    );
    assert!(parse_f64_js_prefix_bytes(&[0xff]).is_err());
    assert_eq!(trim_ascii_bytes(b"x", 0, 1), (0, 1));
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
    assert_eq!(read_u32(&table, 24) & 0xff, 1);

    let event_stride = read_u32(&table, 16) as usize;
    let item_event = SPAN_TABLE_HEADER_BYTES + event_stride * 2;
    let name_start = read_i32(&table, item_event + 4) as usize;
    let name_end = read_i32(&table, item_event + 8) as usize;
    assert_eq!(&sample.as_bytes()[name_start..name_end], b"item");
}

#[test]
fn span_table_utf8_value_sidecars_intern_short_values_and_skip_long_or_empty_values() {
    let long_value = "123456789012345678901234567890123";
    let sample = format!(
        "<root><item a=\"short\" b=\"\">short</item><item a=\"short\">short</item><item c=\"{long_value}\">{long_value}</item></root>"
    );

    let table_bytes = parse_span_table(sample.as_bytes()).unwrap();
    let table = parse_span_table_bytes(&table_bytes).unwrap();

    assert_ne!(table.flags & SPAN_TABLE_FLAG_VALUE_IDS, 0);
    assert_eq!(
        table.event_text_value_ids.unwrap().len(),
        table.event_count as usize * 4
    );
    assert_eq!(table.attr_value_ids.unwrap().len(), table.attr_count as usize * 4);

    let first_text = read_table_event(&table, 3).unwrap();
    let second_text = read_table_event(&table, 6).unwrap();
    let long_text = read_table_event(&table, 9).unwrap();
    assert!(first_text.text_value_id > 0);
    assert_eq!(first_text.text_value_id, second_text.text_value_id);
    assert_eq!(long_text.text_value_id, 0);

    let first_short_attr = read_table_attr(&table, 0).unwrap();
    let empty_attr = read_table_attr(&table, 1).unwrap();
    let repeated_short_attr = read_table_attr(&table, 2).unwrap();
    let long_attr = read_table_attr(&table, 3).unwrap();
    assert!(first_short_attr.value_id > 0);
    assert_eq!(first_short_attr.value_id, repeated_short_attr.value_id);
    assert_eq!(empty_attr.value_id, 0);
    assert_eq!(long_attr.value_id, 0);
}

#[test]
fn span_table_utf8_legacy_name_sidecars_remain_readable_without_value_sidecars() {
    let sample = "<root><item a=\"short\">short</item></root>";
    let mut table_bytes = parse_span_table(sample.as_bytes()).unwrap();
    let event_count = read_u32(&table_bytes, 4) as usize;
    let attr_count = read_u32(&table_bytes, 8) as usize;
    let legacy_tail_bytes = (event_count + attr_count) * 4;
    let flags = read_u32(&table_bytes, 24) & !SPAN_TABLE_FLAG_VALUE_IDS;
    table_bytes[24..28].copy_from_slice(&flags.to_le_bytes());
    table_bytes.truncate(table_bytes.len() - legacy_tail_bytes);

    let table = parse_span_table_bytes(&table_bytes).unwrap();
    assert!(table.event_text_value_ids.is_none());
    assert!(table.attr_value_ids.is_none());
    assert_eq!(read_table_event(&table, 3).unwrap().text_value_id, 0);
    assert_eq!(read_table_attr(&table, 0).unwrap().value_id, 0);
}

#[test]
fn streaming_span_table_reuses_short_value_ids_across_batches() {
    let mut parser = StaxXmlStreamingEventBatchParser::new();

    let first_batch = parser
        .push_chunk(
            Uint8Array::from(b"<root><item a=\"short\">short</item>".to_vec()),
            false,
        )
        .unwrap();
    let second_batch = parser
        .push_chunk(
            Uint8Array::from(b"<item a=\"short\">short</item></root>".to_vec()),
            true,
        )
        .unwrap();

    let first_table = parse_span_table_bytes(first_batch.table.as_ref()).unwrap();
    let second_table = parse_span_table_bytes(second_batch.table.as_ref()).unwrap();

    let first_attr = read_table_attr(&first_table, 0).unwrap();
    let second_attr = read_table_attr(&second_table, 0).unwrap();
    assert!(first_attr.value_id > 0);
    assert_eq!(first_attr.value_id, second_attr.value_id);

    let first_text = read_table_event(&first_table, 3).unwrap();
    let second_text = read_table_event(&second_table, 1).unwrap();
    assert!(first_text.text_value_id > 0);
    assert_eq!(first_text.text_value_id, second_text.text_value_id);
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
    assert!(result.columns[0].values.is_empty());
    assert_eq!(
        utf8_spans(sample.as_bytes(), &result.columns[0]),
        vec!["a", "b", "c"]
    );
    assert_eq!(result.columns[1].present, vec![true, true, true]);
    assert!(result.columns[1].values.is_empty());
    assert_eq!(
        utf8_spans(sample.as_bytes(), &result.columns[1]),
        vec!["Alice", "Bob", "Cy"]
    );
    assert!(table_result.columns[0].values.is_empty());
    assert_eq!(
        utf8_spans(sample.as_bytes(), &table_result.columns[0]),
        vec!["a", "b", "c"]
    );
    assert!(table_result.columns[1].values.is_empty());
    assert_eq!(
        utf8_spans(sample.as_bytes(), &table_result.columns[1]),
        vec!["Alice", "Bob", "Cy"]
    );
    assert_eq!(result.columns[2].present, vec![true, true, false]);
    assert!(result.columns[2].values.is_empty());
    assert_eq!(result.columns[2].number_values[0], 7.0);
    assert!(result.columns[2].number_values[1].is_nan());
    assert_eq!(result.columns[2].number_values[2], 0.0);
}

#[test]
fn document_nodes_projection_returns_txml_style_json_with_custom_entities() {
    let sample = r#"<root mark="&copy;">&copy;<item a="&amp;">ok</item></root>"#;
    let options = DocumentNodesProjectionOptions {
        auto_decode_entities: Some(true),
        add_entities: Some(vec![DocumentEntityDefinition {
            entity: "&copy;".to_owned(),
            value: "©".to_owned(),
        }]),
    };

    let result = parse_document_nodes(sample.as_bytes(), &options).unwrap();

    assert_eq!(result.node_count, 4);
    assert_eq!(
        result.json,
        r#"[{"tagName":"root","attributes":{"mark":"©"},"children":["©",{"tagName":"item","attributes":{"a":"&"},"children":["ok"]}]}]"#,
    );
}

#[test]
fn object_rows_projection_preserves_multibyte_span_strings() {
    let sample = concat!(
        "<root>",
        "<entry code=\"한글\"><label>안녕🙂</label><score>1</score></entry>",
        "<entry code=\"emoji🙂\"><label>카페</label><score>2</score></entry>",
        "</root>"
    );
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

    let direct = parse_object_rows(sample.as_bytes(), &spec).unwrap();
    let table = parse_object_rows_via_table(sample.as_bytes(), &spec).unwrap();

    for result in [&direct, &table] {
        assert_eq!(result.row_count, 2);
        assert!(result.columns[0].values.is_empty());
        assert_eq!(
            utf8_spans(sample.as_bytes(), &result.columns[0]),
            vec!["한글", "emoji🙂"]
        );
        assert!(result.columns[1].values.is_empty());
        assert_eq!(
            utf8_spans(sample.as_bytes(), &result.columns[1]),
            vec!["안녕🙂", "카페"]
        );
        assert_eq!(result.columns[2].number_values, vec![1.0, 2.0]);
    }
}

#[test]
fn item_projection_direct_covers_markup_boundaries_and_errors() {
    assert_eq!(parse_item_projection(b"text only").unwrap().item_count, 0);

    let sample = concat!(
        "<?xml version=\"1.0\"?><!DOCTYPE root><root>lead",
        "<!--comment--><?pi ok?><!ENTITY example \"value\">",
        "<item id=\"bad\" ><name>Alice</name><value><![CDATA[안녕]]></value></ item >",
        "<item id=\"2\"><name><b>Nested</b></name><value>ignored</value></item>",
        "<item id=\"3\"><name>Missing value</name></item>",
        "<empty /></root>tail"
    );
    let direct = parse_item_projection(sample.as_bytes()).unwrap();
    let table = parse_item_projection_via_table(sample.as_bytes()).unwrap();

    assert_eq!(direct.item_count, 1);
    assert_eq!(table.item_count, direct.item_count);
    assert_eq!(table.checksum, direct.checksum);

    for input in [
        &b"<"[..],
        &b"<root"[..],
        &b"<root>"[..],
        &b"</root"[..],
        &b"</root>"[..],
        &b"<a></b>"[..],
        &b"<![CDATA[open"[..],
        &b"<!--open"[..],
        &b"<!DOCTYPE"[..],
        &b"<!BROKEN"[..],
        &b"<?xml version=\"1.0\""[..],
        &b"<?pi"[..],
    ] {
        assert!(
            parse_item_projection(input).is_err(),
            "expected item projection to reject {}",
            String::from_utf8_lossy(input)
        );
    }
}

#[test]
fn object_rows_projection_covers_direct_table_modes_and_edge_values() {
    let sample = concat!(
        "<?xml version=\"1.0\"?><!DOCTYPE root><root><!--comment--><?pi ok?>",
        "<!ENTITY example \"value\">",
        "<entry code=\"a\" rank=\"10\"><label> Alice <b>ignored</b></label>",
        "<desc>Hello <b>World</b><![CDATA[!]]></desc><score> 4.5ms </score></entry>",
        "<entry code=\"b\" rank=\"bad\"><label/><desc></desc><score></score></entry>",
        "<entry code=\"c\"><label>C</label><extra><score>9</score></extra></entry>",
        "<entry code=\"d\" /></root>tail"
    );
    let spec = detailed_object_rows_spec();

    let direct = parse_object_rows(sample.as_bytes(), &spec).unwrap();
    let table = parse_object_rows_via_table(sample.as_bytes(), &spec).unwrap();

    assert_eq!(direct.row_count, 4);
    assert_eq!(table.row_count, direct.row_count);
    assert_eq!(table.field_count, direct.field_count);
    assert_eq!(table.max_depth, direct.max_depth);

    for result in [&direct, &table] {
        assert_eq!(result.columns[0].present, vec![true, true, true, true]);
        assert!(result.columns[0].values.is_empty());
        assert_eq!(
            utf8_spans(sample.as_bytes(), &result.columns[0]),
            vec!["a", "b", "c", "d"]
        );

        assert_eq!(result.columns[1].present, vec![true, true, false, false]);
        assert_eq!(result.columns[1].number_values[0], 10.0);
        assert!(result.columns[1].number_values[1].is_nan());
        assert_eq!(result.columns[1].number_values[2], 0.0);
        assert_eq!(result.columns[1].number_values[3], 0.0);

        assert_eq!(result.columns[2].present, vec![true, true, true, false]);
        assert_eq!(
            object_rows_string_values(sample.as_bytes(), &result.columns[2]),
            vec!["Alice", "", "C", ""]
        );

        assert_eq!(result.columns[3].present, vec![true, true, false, false]);
        assert_eq!(
            object_rows_string_values(sample.as_bytes(), &result.columns[3]),
            vec!["Hello World!", "", "", ""]
        );

        assert_eq!(result.columns[4].present, vec![true, true, false, false]);
        assert_eq!(result.columns[4].number_values[0], 4.5);
        assert!(result.columns[4].number_values[1].is_nan());
        assert_eq!(result.columns[4].number_values[2], 0.0);
        assert_eq!(result.columns[4].number_values[3], 0.0);
    }
}

#[test]
fn object_rows_projection_rejects_invalid_specs_and_tables() {
    let sample = "<root><entry code=\"a\"><label>A</label><score>1</score></entry></root>";
    let spec = detailed_object_rows_spec();

    for invalid in [
        ObjectRowsProjectionSpec {
            item_name: String::new(),
            fields: detailed_object_rows_spec().fields,
        },
        ObjectRowsProjectionSpec {
            item_name: "entry".to_owned(),
            fields: Vec::new(),
        },
        ObjectRowsProjectionSpec {
            item_name: "entry".to_owned(),
            fields: vec![ObjectRowsProjectionFieldSpec {
                output_name: String::new(),
                value_kind: "string".to_owned(),
                source_kind: "attribute".to_owned(),
                source_name: "code".to_owned(),
                text_mode: "direct".to_owned(),
            }],
        },
        ObjectRowsProjectionSpec {
            item_name: "entry".to_owned(),
            fields: vec![ObjectRowsProjectionFieldSpec {
                output_name: "code".to_owned(),
                value_kind: "string".to_owned(),
                source_kind: "attribute".to_owned(),
                source_name: String::new(),
                text_mode: "direct".to_owned(),
            }],
        },
        ObjectRowsProjectionSpec {
            item_name: "entry".to_owned(),
            fields: vec![ObjectRowsProjectionFieldSpec {
                output_name: "code".to_owned(),
                value_kind: "boolean".to_owned(),
                source_kind: "attribute".to_owned(),
                source_name: "code".to_owned(),
                text_mode: "direct".to_owned(),
            }],
        },
        ObjectRowsProjectionSpec {
            item_name: "entry".to_owned(),
            fields: vec![ObjectRowsProjectionFieldSpec {
                output_name: "code".to_owned(),
                value_kind: "string".to_owned(),
                source_kind: "text".to_owned(),
                source_name: "code".to_owned(),
                text_mode: "direct".to_owned(),
            }],
        },
        ObjectRowsProjectionSpec {
            item_name: "entry".to_owned(),
            fields: vec![ObjectRowsProjectionFieldSpec {
                output_name: "label".to_owned(),
                value_kind: "string".to_owned(),
                source_kind: "element".to_owned(),
                source_name: "label".to_owned(),
                text_mode: String::new(),
            }],
        },
        ObjectRowsProjectionSpec {
            item_name: "entry".to_owned(),
            fields: vec![ObjectRowsProjectionFieldSpec {
                output_name: "label".to_owned(),
                value_kind: "string".to_owned(),
                source_kind: "element".to_owned(),
                source_name: "label".to_owned(),
                text_mode: "invalid".to_owned(),
            }],
        },
    ] {
        assert!(parse_object_rows(sample.as_bytes(), &invalid).is_err());
    }

    let attribute_empty_mode = ObjectRowsProjectionSpec {
        item_name: "entry".to_owned(),
        fields: vec![ObjectRowsProjectionFieldSpec {
            output_name: "code".to_owned(),
            value_kind: "string".to_owned(),
            source_kind: "attribute".to_owned(),
            source_name: "code".to_owned(),
            text_mode: String::new(),
        }],
    };
    assert_eq!(
        object_rows_string_values(
            sample.as_bytes(),
            &parse_object_rows(sample.as_bytes(), &attribute_empty_mode)
                .unwrap()
                .columns[0],
        ),
        vec!["a"]
    );

    let mut table = parse_span_table(sample.as_bytes()).unwrap();
    table[24..28].copy_from_slice(&0u32.to_le_bytes());
    assert!(project_items_from_span_table(sample.as_bytes(), &table).is_err());
    assert!(project_object_rows_from_span_table(sample.as_bytes(), &table, &spec).is_err());

    let mut table = parse_span_table(sample.as_bytes()).unwrap();
    table[12..16].copy_from_slice(&(sample.len() as u32 + 1).to_le_bytes());
    assert!(project_object_rows_from_span_table(sample.as_bytes(), &table, &spec).is_err());
}

#[test]
fn object_rows_projection_direct_rejects_malformed_xml() {
    let spec = detailed_object_rows_spec();
    for input in [
        &b"<"[..],
        &b"<root"[..],
        &b"<root>"[..],
        &b"</root"[..],
        &b"</root>"[..],
        &b"<a></b>"[..],
        &b"<![CDATA[open"[..],
        &b"<!--open"[..],
        &b"<!DOCTYPE"[..],
        &b"<!BROKEN"[..],
        &b"<?xml version=\"1.0\""[..],
        &b"<?pi"[..],
        &b"<root><entry code=\"\xff\" /></root>"[..],
        &b"<root><entry><label>\xff</label></entry></root>"[..],
    ] {
        assert!(
            parse_object_rows(input, &spec).is_err(),
            "expected object rows projection to reject {}",
            String::from_utf8_lossy(input)
        );
    }

    let whitespace = b"<root><entry code=\"x\" ><label> X </label></ entry ></root>";
    assert_eq!(
        object_rows_string_values(
            whitespace,
            &parse_object_rows(whitespace, &spec).unwrap().columns[0]
        ),
        vec!["x"]
    );
}

#[test]
fn projection_table_helpers_cover_defensive_paths() {
    let input = b"<root><item id=\"7\"><name>A</name><value>B</value></item></root>";
    let table_bytes = parse_span_table(input).unwrap();
    let table = parse_span_table_bytes(&table_bytes).unwrap();
    let mut item_state = TableProjectionState {
        depth: 1,
        max_depth: 1,
        current_item: None,
        capture: None,
        rows: Vec::new(),
    };

    let nameless_start = TableEventRecord {
        event_type: START_ELEMENT as u32,
        name_start: NO_SPAN,
        name_end: NO_SPAN,
        text_start: NO_SPAN,
        text_end: NO_SPAN,
        attr_start: 0,
        attr_count: 0,
        name_id: 0,
        text_value_id: 0,
    };
    assert!(
        start_table_projection_element(input, &table, nameless_start, 1, &mut item_state).is_err()
    );

    let nameless_end = TableEventRecord {
        event_type: END_ELEMENT as u32,
        ..nameless_start
    };
    end_table_projection_element(input, nameless_end, 1, &mut item_state).unwrap();

    let whitespace_text = TableEventRecord {
        event_type: CHARACTERS as u32,
        name_start: NO_SPAN,
        name_end: NO_SPAN,
        text_start: 0,
        text_end: 0,
        attr_start: 0,
        attr_count: 0,
        name_id: 0,
        text_value_id: 0,
    };
    capture_table_projection_text(input, whitespace_text, &mut item_state).unwrap();

    let no_text = TableEventRecord {
        text_start: NO_SPAN,
        text_end: NO_SPAN,
        ..whitespace_text
    };
    capture_table_projection_text(input, no_text, &mut item_state).unwrap();

    item_state.capture = Some(ItemProjectionCapture {
        depth: 1,
        field: ItemProjectionField::Name,
    });
    item_state.current_item = Some(CurrentItemProjection {
        depth: 1,
        id: 0,
        name: None,
        value: None,
    });
    capture_table_projection_text(
        b" ",
        TableEventRecord {
            text_start: 0,
            text_end: 1,
            ..whitespace_text
        },
        &mut item_state,
    )
    .unwrap();

    let text_start = input.iter().position(|byte| *byte == b'A').unwrap();
    let nonmatching_text = TableEventRecord {
        text_start: text_start as i32,
        text_end: text_start as i32 + 1,
        ..whitespace_text
    };
    capture_table_projection_text(input, nonmatching_text, &mut item_state).unwrap();

    item_state.capture = Some(ItemProjectionCapture {
        depth: 2,
        field: ItemProjectionField::Name,
    });
    capture_table_projection_text(input, nonmatching_text, &mut item_state).unwrap();

    item_state.capture = Some(ItemProjectionCapture {
        depth: 1,
        field: ItemProjectionField::Name,
    });
    capture_table_projection_text(input, nonmatching_text, &mut item_state).unwrap();

    item_state.current_item = None;
    capture_table_projection_text(input, nonmatching_text, &mut item_state).unwrap();

    let mut id_table_bytes = minimal_utf8_table(input.len(), 0, 1);
    push_attr_record(&mut id_table_bytes, None, Some((15, 16)));
    let id_table = parse_span_table_bytes(&id_table_bytes).unwrap();
    let id_event = TableEventRecord {
        event_type: START_ELEMENT as u32,
        name_start: 6,
        name_end: 10,
        text_start: NO_SPAN,
        text_end: NO_SPAN,
        attr_start: 0,
        attr_count: 1,
        name_id: 0,
        text_value_id: 0,
    };
    assert_eq!(
        read_table_projection_id(input, &id_table, id_event).unwrap(),
        0
    );

    let mut id_table_bytes = minimal_utf8_table(input.len(), 0, 1);
    push_attr_record(&mut id_table_bytes, Some((18, 22)), Some((15, 16)));
    let id_table = parse_span_table_bytes(&id_table_bytes).unwrap();
    assert_eq!(
        read_table_projection_id(input, &id_table, id_event).unwrap(),
        0
    );

    let id_name_start = input.windows(2).position(|value| value == b"id").unwrap();
    let mut id_table_bytes = minimal_utf8_table(input.len(), 0, 1);
    push_attr_record(
        &mut id_table_bytes,
        Some((id_name_start, id_name_start + 2)),
        None,
    );
    let id_table = parse_span_table_bytes(&id_table_bytes).unwrap();
    assert_eq!(
        read_table_projection_id(input, &id_table, id_event).unwrap(),
        0
    );

    let mut missing_end = minimal_utf8_table(input.len(), 2, 0);
    push_event_record(&mut missing_end, START_DOCUMENT, None, None, 0, 0);
    push_event_record(&mut missing_end, START_ELEMENT, Some((6, 10)), None, 0, 0);
    assert!(project_item_rows_from_span_table_bytes(input, &missing_end).is_err());

    let mut object_missing_end = minimal_utf8_table(input.len(), 2, 0);
    push_event_record(&mut object_missing_end, START_DOCUMENT, None, None, 0, 0);
    push_event_record(
        &mut object_missing_end,
        START_ELEMENT,
        Some((6, 10)),
        None,
        0,
        0,
    );
    assert!(project_object_rows_from_span_table(
        input,
        &object_missing_end,
        &detailed_object_rows_spec()
    )
    .is_err());

    let mut item_underflow = minimal_utf8_table(input.len(), 1, 0);
    push_event_record(&mut item_underflow, END_ELEMENT, Some((1, 5)), None, 0, 0);
    assert!(project_item_rows_from_span_table_bytes(input, &item_underflow).is_err());

    let mut object_underflow = minimal_utf8_table(input.len(), 1, 0);
    push_event_record(&mut object_underflow, END_ELEMENT, Some((1, 5)), None, 0, 0);
    assert!(project_object_rows_from_span_table(
        input,
        &object_underflow,
        &detailed_object_rows_spec()
    )
    .is_err());

    let spec = detailed_object_rows_spec();
    let normalized = normalize_object_rows_spec(&spec).unwrap();
    let mut object_state = create_object_rows_projection_state(normalized.fields.len());
    assert!(start_object_rows_projection_element(
        input,
        &table,
        nameless_start,
        &normalized,
        &mut object_state,
    )
    .is_err());

    let object_input = b"<root><entry code=\"7\"></entry></root>";
    let entry_start = object_input
        .windows(5)
        .position(|value| value == b"entry")
        .unwrap();
    let code_start = object_input
        .windows(4)
        .position(|value| value == b"code")
        .unwrap();
    let mut malformed_attr_table = minimal_utf8_table(object_input.len(), 0, 2);
    push_attr_record(&mut malformed_attr_table, None, Some((15, 16)));
    push_attr_record(
        &mut malformed_attr_table,
        Some((code_start, code_start + 4)),
        None,
    );
    let malformed_attr_table = parse_span_table_bytes(&malformed_attr_table).unwrap();
    object_state.depth = 1;
    start_object_rows_projection_element(
        object_input,
        &malformed_attr_table,
        TableEventRecord {
            event_type: START_ELEMENT as u32,
            name_start: entry_start as i32,
            name_end: entry_start as i32 + 5,
            text_start: NO_SPAN,
            text_end: NO_SPAN,
            attr_start: 0,
            attr_count: 2,
            name_id: 0,
            text_value_id: 0,
        },
        &normalized,
        &mut object_state,
    )
    .unwrap();
    assert!(object_state.current_row.is_some());

    let mut object_state = create_object_rows_projection_state(normalized.fields.len());
    capture_object_rows_projection_text(
        input,
        TableEventRecord {
            event_type: CHARACTERS as u32,
            name_start: NO_SPAN,
            name_end: NO_SPAN,
            text_start: NO_SPAN,
            text_end: NO_SPAN,
            attr_start: 0,
            attr_count: 0,
            name_id: 0,
            text_value_id: 0,
        },
        &normalized,
        &mut object_state,
    )
    .unwrap();
    capture_object_rows_projection_text_span(
        input,
        text_start,
        text_start + 1,
        &normalized,
        &mut object_state,
    )
    .unwrap();
    object_state.capture = Some(ObjectRowsProjectionCapture {
        depth: 2,
        field_indices: vec![2],
        text_mode: ObjectRowsTextMode::Direct,
    });
    object_state.depth = 1;
    capture_object_rows_projection_text_span(
        input,
        text_start,
        text_start + 1,
        &normalized,
        &mut object_state,
    )
    .unwrap();
    object_state.capture = Some(ObjectRowsProjectionCapture {
        depth: 2,
        field_indices: vec![2],
        text_mode: ObjectRowsTextMode::Subtree,
    });
    object_state.depth = 1;
    capture_object_rows_projection_text_span(
        input,
        text_start,
        text_start + 1,
        &normalized,
        &mut object_state,
    )
    .unwrap();
    object_state.capture = Some(ObjectRowsProjectionCapture {
        depth: 1,
        field_indices: vec![2],
        text_mode: ObjectRowsTextMode::Direct,
    });
    object_state.depth = 1;
    capture_object_rows_projection_text_span(
        input,
        text_start,
        text_start + 1,
        &normalized,
        &mut object_state,
    )
    .unwrap();

    let mut table_end_state = create_object_rows_projection_state(normalized.fields.len());
    table_end_state.depth = 1;
    table_end_state.capture = Some(ObjectRowsProjectionCapture {
        depth: 1,
        field_indices: vec![2, 3, 4],
        text_mode: ObjectRowsTextMode::Subtree,
    });
    table_end_state.current_row = Some(CurrentObjectRowsProjection {
        depth: 1,
        completed: vec![false; normalized.fields.len()],
        present: vec![false, false, true, false, true],
        values: vec![
            String::new(),
            String::new(),
            "  Trimmed  ".to_owned(),
            String::new(),
            String::new(),
        ],
        string_materialized: vec![false, false, true, false, false],
        span_starts: vec![-1; normalized.fields.len()],
        span_ends: vec![-1; normalized.fields.len()],
        number_values: vec![0.0; normalized.fields.len()],
        number_buffers: vec![
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            b"42.5".to_vec(),
        ],
    });
    end_object_rows_projection_element(
        input,
        TableEventRecord {
            event_type: END_ELEMENT as u32,
            name_start: NO_SPAN,
            name_end: NO_SPAN,
            text_start: NO_SPAN,
            text_end: NO_SPAN,
            attr_start: 0,
            attr_count: 0,
            name_id: 0,
            text_value_id: 0,
        },
        &normalized,
        &mut table_end_state,
    )
    .unwrap();
    let row = table_end_state.current_row.as_ref().unwrap();
    assert_eq!(row.values[2], "Trimmed");
    assert_eq!(row.number_values[4], 42.5);

    table_end_state.depth = 1;
    table_end_state.capture = Some(ObjectRowsProjectionCapture {
        depth: 1,
        field_indices: vec![2],
        text_mode: ObjectRowsTextMode::Direct,
    });
    table_end_state.current_row = None;
    end_object_rows_projection_element(
        input,
        TableEventRecord {
            event_type: END_ELEMENT as u32,
            name_start: NO_SPAN,
            name_end: NO_SPAN,
            text_start: NO_SPAN,
            text_end: NO_SPAN,
            attr_start: 0,
            attr_count: 0,
            name_id: 0,
            text_value_id: 0,
        },
        &normalized,
        &mut table_end_state,
    )
    .unwrap();

    let mut direct_end_state = create_object_rows_projection_state(normalized.fields.len());
    direct_end_state.depth = 1;
    direct_end_state.capture = Some(ObjectRowsProjectionCapture {
        depth: 1,
        field_indices: vec![2, 3, 4],
        text_mode: ObjectRowsTextMode::Subtree,
    });
    direct_end_state.current_row = Some(CurrentObjectRowsProjection {
        depth: 99,
        completed: vec![false; normalized.fields.len()],
        present: vec![false, false, true, false, true],
        values: vec![
            String::new(),
            String::new(),
            "  Direct  ".to_owned(),
            String::new(),
            String::new(),
        ],
        string_materialized: vec![false, false, true, false, false],
        span_starts: vec![-1; normalized.fields.len()],
        span_ends: vec![-1; normalized.fields.len()],
        number_values: vec![0.0; normalized.fields.len()],
        number_buffers: vec![
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            b"17.25".to_vec(),
        ],
    });
    end_object_rows_projection_element_direct(input, 1, 5, &normalized, &mut direct_end_state)
        .unwrap();
    let row = direct_end_state.current_row.as_ref().unwrap();
    assert_eq!(row.values[2], "Direct");
    assert_eq!(row.number_values[4], 17.25);

    direct_end_state.depth = 1;
    direct_end_state.capture = Some(ObjectRowsProjectionCapture {
        depth: 1,
        field_indices: vec![2],
        text_mode: ObjectRowsTextMode::Direct,
    });
    direct_end_state.current_row = None;
    end_object_rows_projection_element_direct(input, 1, 5, &normalized, &mut direct_end_state)
        .unwrap();
}

#[test]
fn projection_branch_coverage_covers_short_circuit_edges() {
    for input in [
        &b"<>"[..],
        &b"< />"[..],
        &b"</>"[..],
        &b"<a/b></a>"[..],
        &b"<item id=\"1\"><other>X</other></item>"[..],
        &b"<item id=\"1\"><item id=\"2\"><name>A</name><value>B</value></item></item>"[..],
        &b"<item id=\"1\"><name> </name><value>B</value></item>"[..],
    ] {
        let _ = parse_item_projection(input);
    }

    let object_spec = ObjectRowsProjectionSpec {
        item_name: "entry".to_owned(),
        fields: vec![
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
    let object_input = concat!(
        "<root>\n",
        "  < />\n",
        "  <a/b></a>\n",
        "  <entry>\n",
        "    <label>A</label><label>B</label>\n",
        "    <score>1</score><score>2</score>\n",
        "  </entry>\n",
        "</root>"
    );
    let direct = parse_object_rows(object_input.as_bytes(), &object_spec).unwrap();
    let table = parse_object_rows_via_table(object_input.as_bytes(), &object_spec).unwrap();
    assert!(parse_object_rows(b"<>", &object_spec).is_err());
    assert!(parse_object_rows(b"</>", &object_spec).is_err());

    assert_eq!(direct.row_count, 1);
    assert_eq!(table.row_count, 1);
    assert_eq!(
        object_rows_string_values(object_input.as_bytes(), &direct.columns[0]),
        vec!["A"]
    );
    assert_eq!(
        object_rows_string_values(object_input.as_bytes(), &table.columns[0]),
        vec!["A"]
    );

    let table_bytes = parse_span_table(
        b"<root><item id=\"1\"><other>X</other><value>B</value><other>Y</other></item></root>",
    )
    .unwrap();
    assert_eq!(
        project_items_from_span_table(
            b"<root><item id=\"1\"><other>X</other><value>B</value><other>Y</other></item></root>",
            &table_bytes,
        )
        .unwrap()
        .item_count,
        0
    );

    let nested_item = b"<root><item id=\"1\"><item id=\"2\"><name>A</name><value>B</value></item><name> </name><value>B</value></item></root>";
    let table_bytes = parse_span_table(nested_item).unwrap();
    assert_eq!(
        project_items_from_span_table(nested_item, &table_bytes)
            .unwrap()
            .item_count,
        0
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

    let status =
        unsafe { stax_xml_parse_aggregate_utf16_units(units.as_ptr(), units.len(), 1, &mut out) };

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
#[cfg(feature = "napi-bindings")]
fn napi_wrappers_cover_native_entrypoints() {
    let sample = concat!(
        "<root><item id=\"1\"><name>A</name><value>B</value></item>",
        "<entry code=\"x\"><label>X</label><score>1</score></entry></root>"
    );
    let bytes = sample.as_bytes().to_vec();

    assert!(
        parse_aggregate_buffer(Buffer::from(bytes.clone()), "count-only".to_owned())
            .unwrap()
            .event_count
            > 0
    );
    assert!(
        parse_aggregate_buffer_with_simd(
            Buffer::from(bytes.clone()),
            "event-count-two-stage".to_owned(),
            "off".to_owned(),
        )
        .unwrap()
        .event_count
            > 0
    );
    assert!(
        parse_aggregate_uint8array(Uint8Array::from(bytes.clone()), "count-only".to_owned())
            .unwrap()
            .event_count
            > 0
    );
    assert!(
        parse_aggregate_uint8array_with_simd(
            Uint8Array::from(bytes.clone()),
            "event-count-two-stage".to_owned(),
            "off".to_owned(),
        )
        .unwrap()
        .event_count
            > 0
    );
    assert!(
        parse_aggregate_string_utf8(sample.to_owned(), "count-only".to_owned())
            .unwrap()
            .event_count
            > 0
    );
    assert!(
        parse_aggregate_string_utf8_with_simd(
            sample.to_owned(),
            "event-count-two-stage".to_owned(),
            "off".to_owned(),
        )
        .unwrap()
        .event_count
            > 0
    );
    assert!(
        parse_aggregate_string_utf16(
            Utf16String::from(sample.to_owned()),
            "count-only".to_owned(),
        )
        .unwrap()
        .event_count
            > 0
    );

    assert!(
        !parse_span_table_string_utf16(Utf16String::from(sample.to_owned()))
            .unwrap()
            .is_empty()
    );
    assert!(
        !parse_span_table_uint8array(Uint8Array::from(bytes.clone()))
            .unwrap()
            .is_empty()
    );
    assert!(
        !parse_structural_index_string_utf16(Utf16String::from(sample.to_owned()))
            .unwrap()
            .is_empty()
    );
    assert!(
        !parse_structural_index_uint8array(Uint8Array::from(bytes.clone()))
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        parse_item_projection_uint8array(Uint8Array::from(bytes.clone()))
            .unwrap()
            .item_count,
        1
    );
    assert_eq!(
        parse_item_projection_via_table_uint8array(Uint8Array::from(bytes.clone()))
            .unwrap()
            .item_count,
        1
    );
    assert_eq!(
        parse_item_rows_via_table_uint8array(Uint8Array::from(bytes.clone()))
            .unwrap()
            .rows
            .len(),
        1
    );

    let spec = ObjectRowsProjectionSpec {
        item_name: "entry".to_owned(),
        fields: vec![ObjectRowsProjectionFieldSpec {
            output_name: "code".to_owned(),
            value_kind: "string".to_owned(),
            source_kind: "attribute".to_owned(),
            source_name: "code".to_owned(),
            text_mode: "direct".to_owned(),
        }],
    };
    assert_eq!(
        parse_object_rows_uint8array(Uint8Array::from(bytes.clone()), spec)
            .unwrap()
            .row_count,
        1
    );
    let spec = ObjectRowsProjectionSpec {
        item_name: "entry".to_owned(),
        fields: vec![ObjectRowsProjectionFieldSpec {
            output_name: "code".to_owned(),
            value_kind: "string".to_owned(),
            source_kind: "attribute".to_owned(),
            source_name: "code".to_owned(),
            text_mode: "direct".to_owned(),
        }],
    };
    assert_eq!(
        parse_object_rows_via_table_uint8array(Uint8Array::from(bytes.clone()), spec)
            .unwrap()
            .row_count,
        1
    );

    let file_path = std::env::temp_dir().join(format!(
        "stax-xml-native-api-{}-{}.xml",
        std::process::id(),
        "coverage"
    ));
    std::fs::write(&file_path, sample).unwrap();
    assert!(
        parse_aggregate_file(
            file_path.to_string_lossy().to_string(),
            "count-only".to_owned(),
        )
        .unwrap()
        .event_count
            > 0
    );
    assert!(
        parse_aggregate_file_with_simd(
            file_path.to_string_lossy().to_string(),
            "event-count-two-stage".to_owned(),
            "off".to_owned(),
        )
        .unwrap()
        .event_count
            > 0
    );
    std::fs::remove_file(file_path).unwrap();

    assert!(parse_aggregate_string_utf8("<root>".to_owned(), "missing".to_owned()).is_err());
    assert!(parse_aggregate_string_utf8_with_simd(
        sample.to_owned(),
        "count-only".to_owned(),
        "bad".to_owned(),
    )
    .is_err());
    assert!(parse_aggregate_file(
        "not-a-real-file-for-stax-xml.xml".to_owned(),
        "count-only".to_owned(),
    )
    .is_err());
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
        &b"<root>   </root>"[..],
        &b"<root><![CDATA[]]></root>"[..],
        &b"<root><![CDATA[   ]]></root>"[..],
        &b"< />"[..],
        &b"<root ></root>"[..],
        &b"<a/b></a>"[..],
        &b"<root></ root >"[..],
        &b"<root><!--ok--><!DOCTYPE note><!ENTITY x y><?pi ok?><child><![CDATA[data]]></child><empty /></root>"[..],
    ] {
        parse_aggregate(input, Tier::CountOnly).unwrap();
    }
    parse_aggregate(b"<root><a></a></root>", Tier::EventCountUnsafeGt).unwrap();
    parse_aggregate(b"<root>text</root>", Tier::EventCountNoText).unwrap();

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
        "<root>   </root>",
        "<root><![CDATA[]]></root>",
        "<root><![CDATA[   ]]></root>",
        "< />",
        "<root ></root>",
        "<a/b></a>",
        "<root></ root >",
        "<root><!--ok--><!DOCTYPE note><!ENTITY x y><?pi ok?><child><![CDATA[data]]></child><empty /></root>",
    ] {
        parse_aggregate_utf16(&utf16(input), Tier::CountOnly).unwrap();
    }
    parse_aggregate_utf16(&utf16("<root>text</root>"), Tier::EventCountNoText).unwrap();

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
        "<root>   </root>",
        "<root><![CDATA[]]></root>",
        "<root><![CDATA[   ]]></root>",
        "< />",
        "<root ></root>",
        "<a/b></a>",
        "<root></ root >",
        "<root><!--ok--><!DOCTYPE note><!ENTITY x y><?pi ok?><child><![CDATA[data]]></child><empty /></root>",
    ] {
        parse_span_table(input.as_bytes()).unwrap();
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
            parse_span_table(input.as_bytes()).is_err(),
            "expected utf8 span table parser to reject {input}"
        );
        assert!(
            parse_span_table_utf16(&utf16(input)).is_err(),
            "expected span table parser to reject {input}"
        );
    }
}

#[test]
fn span_table_reader_rejects_invalid_tables_and_ranges() {
    assert!(parse_span_table_bytes(&[]).is_err());

    let mut invalid_magic = minimal_utf8_table(0, 0, 0);
    invalid_magic[0..4].copy_from_slice(&0u32.to_le_bytes());
    assert!(parse_span_table_bytes(&invalid_magic).is_err());

    let mut invalid_event_stride = minimal_utf8_table(0, 0, 0);
    invalid_event_stride[16..20].copy_from_slice(&0u32.to_le_bytes());
    assert!(parse_span_table_bytes(&invalid_event_stride).is_err());

    let mut invalid_attr_stride = minimal_utf8_table(0, 0, 0);
    invalid_attr_stride[20..24].copy_from_slice(&0u32.to_le_bytes());
    assert!(parse_span_table_bytes(&invalid_attr_stride).is_err());

    let mut length_mismatch = minimal_utf8_table(0, 1, 0);
    length_mismatch.truncate(SPAN_TABLE_HEADER_BYTES);
    assert!(parse_span_table_bytes(&length_mismatch).is_err());

    let table_bytes = parse_span_table(b"<root a=\"1\" />").unwrap();
    let table = parse_span_table_bytes(&table_bytes).unwrap();
    assert!(read_table_event(&table, table.event_count as usize).is_err());
    assert!(read_table_attr(&table, table.attr_count as usize).is_err());

    assert_eq!(decode_table_range(-1, 0).unwrap(), None);
    assert_eq!(decode_table_range(0, -1).unwrap(), None);
    assert!(decode_table_range(2, 1).is_err());
}

#[test]
fn aggregate_fast_count_and_two_stage_cover_branch_edges() {
    let fast = Tier::EventCountOnly;
    parse_aggregate_fast_event_count(b"text", fast, fast).unwrap();
    parse_aggregate_fast_event_count(b"   ", fast, fast).unwrap();
    parse_aggregate_fast_event_count(b"text", Tier::EventCountNoText, fast).unwrap();
    parse_aggregate_fast_event_count(b"lead<root/>tail", fast, fast).unwrap();
    parse_aggregate_fast_event_count(b"   <root/>", fast, fast).unwrap();
    parse_aggregate_fast_event_count(
        b"<root><![CDATA[]]><![CDATA[   ]]><![CDATA[x]]><!--c--><!DOCTYPE r><!ENTITY x y><?pi ok?></root>",
        fast,
        fast,
    )
    .unwrap();
    parse_aggregate_fast_event_count(b"<root><![CDATA[x]]></root>", Tier::EventCountNoText, fast)
        .unwrap();

    for input in [
        &b"<"[..],
        &b"</root"[..],
        &b"<root"[..],
        &b"<?xml version=\"1.0\""[..],
        &b"<?pi"[..],
        &b"<![CDATA[open"[..],
        &b"<!--open"[..],
        &b"<!DOCTYPE"[..],
        &b"<!BROKEN"[..],
    ] {
        assert!(
            parse_aggregate_fast_event_count(input, fast, fast).is_err(),
            "expected fast count to reject {}",
            String::from_utf8_lossy(input)
        );
    }

    let quote_heavy = br#"<root a0="0" a1="1" a2="2" a3="3" a4="4" a5="5"></root>"#;
    assert!(should_use_two_stage(quote_heavy));
    assert!(
        parse_aggregate_with_simd_policy(quote_heavy, Tier::EventCountAutoStage, SimdPolicy::Off)
            .unwrap()
            .event_count
            > 0
    );
    assert!(
        parse_aggregate_with_simd_policy(quote_heavy, Tier::CountAutoStage, SimdPolicy::Off)
            .unwrap()
            .attr_count_total
            > 0
    );

    let two_stage = Tier::EventCountTwoStage;
    for input in [
        &b"text"[..],
        &b"   <root/>"[..],
        &b"><root/>"[..],
        &b"<root/>tail"[..],
        &b"<root/>   "[..],
        &b"<!DOCTYPE root>"[..],
        &b"<!DOCTYPE root [<!ELEMENT root ANY>]><root/>"[..],
        &b"<root><![CDATA[]]><![CDATA[   ]]><![CDATA[x]]><!--c--><!DOCTYPE r><!ENTITY x y><?pi ok?></root>"[..],
    ] {
        parse_aggregate_two_stage(input, two_stage, SimdPolicy::Off).unwrap();
    }
    parse_aggregate_two_stage(
        br#"<root a="1" b="2" bare></root>"#,
        Tier::CountEqTwoStage,
        SimdPolicy::Off,
    )
    .unwrap();

    for input in [
        &b"<"[..],
        &b"</root"[..],
        &b"<root"[..],
        &b"<?xml version=\"1.0\""[..],
        &b"<?pi"[..],
        &b"<![CDATA[open"[..],
        &b"<!--open"[..],
        &b"<!DOCTYPE"[..],
        &b"<!BROKEN"[..],
    ] {
        assert!(
            parse_aggregate_two_stage(input, two_stage, SimdPolicy::Off).is_err(),
            "expected two-stage count to reject {}",
            String::from_utf8_lossy(input)
        );
    }

    assert_eq!(trim_start_tag_end(b"<>", 0, 1), (1, false));
    assert_eq!(trim_start_tag_end(b"<x>", 0, 2), (2, false));
    assert_eq!(trim_start_tag_end(b"<x/>", 0, 3), (2, true));
    assert_eq!(trim_start_tag_end(b"< />", 0, 3), (1, true));
    assert_eq!(trim_start_tag_end(b"<x />", 0, 4), (2, true));
    assert_eq!(trim_start_tag_end(b"<x/   >", 0, 6), (2, true));
    assert_eq!(scan_name_end(b"a/b", 0, 3), 1);
}

#[test]
fn aggregate_u32_counters_wrap_modulo_2_32_by_contract() {
    let mut fast_state = AggregateState {
        event_count: u32::MAX,
        ..AggregateState::default()
    };
    emit_fast_event_count_event(&mut fast_state, START_ELEMENT, true);
    assert_eq!(fast_state.event_count, 0);

    let mut staged_state = AggregateState {
        event_count: u32::MAX,
        attr_count_total: u32::MAX,
        ..AggregateState::default()
    };
    emit_two_stage_event(&mut staged_state, START_ELEMENT, 1, true);
    assert_eq!(staged_state.event_count, 0);
    assert_eq!(staged_state.attr_count_total, 0);
}

#[test]
fn simd_classifier_covers_quote_masks_and_range_edges() {
    assert_eq!(mask_up_to(63), u64::MAX);
    assert_eq!(mask_from(64), 0);

    assert_eq!(count_mask_bits_in_range(&[0b111], 1, 1), 0);
    assert_eq!(count_mask_bits_in_range(&[], 0, 1), 0);
    assert_eq!(count_mask_bits_in_range(&[0b111], 128, 130), 0);
    assert_eq!(
        count_mask_bits_in_range(&[u64::MAX, 1, u64::MAX], 1, 130),
        63 + 1 + 2
    );

    let mut in_dquote = false;
    let mut in_squote = false;
    assert_eq!(quote_mask(0, 0, &mut in_dquote, &mut in_squote), 0);
    in_dquote = true;
    assert_eq!(quote_mask(0, 0, &mut in_dquote, &mut in_squote), u64::MAX);
    in_dquote = false;
    in_squote = true;
    assert_eq!(quote_mask(0, 0, &mut in_dquote, &mut in_squote), u64::MAX);
    quote_mask(1 << 1, 0, &mut in_dquote, &mut in_squote);
    in_dquote = true;
    in_squote = false;
    quote_mask(0, 1 << 1, &mut in_dquote, &mut in_squote);

    in_dquote = false;
    in_squote = false;
    let quoted = quote_mask((1 << 1) | (1 << 3), 0, &mut in_dquote, &mut in_squote);
    assert_eq!(quoted & ((1 << 1) | (1 << 2) | (1 << 3)), 0b0110);
    assert!(!in_dquote);
    in_dquote = true;
    let quoted = quote_mask(1 << 2, 0, &mut in_dquote, &mut in_squote);
    assert_eq!(quoted & 0b111, 0b011);
    assert!(!in_dquote);

    in_dquote = false;
    in_squote = false;
    let quoted = quote_mask(0, (1 << 1) | (1 << 3), &mut in_dquote, &mut in_squote);
    assert_eq!(quoted & 0b1110, 0b0110);
    assert!(!in_squote);
    in_squote = true;
    let quoted = quote_mask(0, 1 << 2, &mut in_dquote, &mut in_squote);
    assert_eq!(quoted & 0b111, 0b011);
    assert!(!in_squote);

    in_dquote = true;
    in_squote = false;
    assert_eq!(
        quote_mask_slow(1 << 2, 1 << 1, &mut in_dquote, &mut in_squote) & 0b111,
        0b111
    );
    assert!(!in_dquote);
    in_dquote = true;
    assert_eq!(
        quote_mask_slow(0, 1 << 1, &mut in_dquote, &mut in_squote),
        u64::MAX
    );
    assert!(in_dquote);
    in_dquote = false;
    in_squote = true;
    assert_eq!(
        quote_mask_slow(1 << 1, 1 << 2, &mut in_dquote, &mut in_squote) & 0b111,
        0b111
    );
    assert!(!in_squote);
    in_squote = true;
    assert_eq!(
        quote_mask_slow(1 << 1, 0, &mut in_dquote, &mut in_squote),
        u64::MAX
    );
    assert!(in_squote);

    in_dquote = false;
    in_squote = false;
    quote_mask_slow(1 << 63, 0, &mut in_dquote, &mut in_squote);
    assert!(in_dquote);
    in_dquote = false;
    quote_mask_slow(0, 1 << 5, &mut in_dquote, &mut in_squote);
    assert!(in_squote);

    let exact = classifier_fixture(64, b'"');
    assert_classifier_matches_scalar(&exact, true, SimdPolicy::Off);
    let double_tail = classifier_fixture(70, b'"');
    let single_tail = classifier_fixture(70, b'\'');
    for include_eq in [false, true] {
        assert_classifier_matches_scalar(&double_tail, include_eq, SimdPolicy::Off);
        assert_classifier_matches_scalar(&single_tail, include_eq, SimdPolicy::Off);
    }
    let mixed_quotes = br#"<root a="single ' > < = stays quoted" b='double " > < = stays quoted'><child attr="ok"/></root>"#;
    for include_eq in [false, true] {
        assert_classifier_matches_scalar(mixed_quotes, include_eq, SimdPolicy::Auto);
        assert_classifier_matches_scalar(mixed_quotes, include_eq, SimdPolicy::Off);
    }

    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("sse4.2") {
            assert_classifier_matches_scalar(&exact, true, SimdPolicy::Sse42);
            assert_classifier_matches_scalar(&double_tail, false, SimdPolicy::Sse42);
            assert_classifier_matches_scalar(&double_tail, true, SimdPolicy::Sse42);
            assert_classifier_matches_scalar(&single_tail, true, SimdPolicy::Sse42);
            assert_classifier_matches_scalar(mixed_quotes, true, SimdPolicy::Sse42);
        }
        if std::arch::is_x86_feature_detected!("avx2") {
            assert_classifier_matches_scalar(&exact, true, SimdPolicy::Avx2);
            assert_classifier_matches_scalar(&double_tail, false, SimdPolicy::Avx2);
            assert_classifier_matches_scalar(&double_tail, true, SimdPolicy::Avx2);
            assert_classifier_matches_scalar(&single_tail, true, SimdPolicy::Avx2);
            assert_classifier_matches_scalar(mixed_quotes, true, SimdPolicy::Avx2);
        }
    }

    #[cfg(target_arch = "aarch64")]
    {
        assert_classifier_matches_scalar(&exact, true, SimdPolicy::Auto);
        assert_classifier_matches_scalar(&exact, true, SimdPolicy::Neon);
        assert_classifier_matches_scalar(&double_tail, false, SimdPolicy::Neon);
        assert_classifier_matches_scalar(&double_tail, true, SimdPolicy::Neon);
        assert_classifier_matches_scalar(&single_tail, true, SimdPolicy::Neon);
        assert_classifier_matches_scalar(mixed_quotes, true, SimdPolicy::Neon);
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
    assert_eq!(count_attributes(b"   ", 0, 3), 0);
    assert_eq!(count_attributes(b"name=", 0, 5), 0);
    assert_eq!(count_attributes(b"name='v'", 0, 8), 1);
    assert_eq!(count_attributes(b"name=x", 0, 6), 0);
    assert_eq!(count_attributes(b"name other", 0, 10), 2);
    assert_eq!(count_attributes(b"name=\"unterminated", 0, 18), 0);
    assert_eq!(read_projection_id(b"kind=\"x\"", 0, 8), 0);
    assert_eq!(parse_i32_ascii(b"", 0, 0), None);
    assert_eq!(parse_i32_ascii(b"-", 0, 1), None);
    assert_eq!(parse_i32_ascii(b"x", 0, 1), None);
    assert_eq!(parse_i32_ascii(b"2147483648", 0, 10), None);
    assert!(!span_eq(b"abc", 2, 1, b""));

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
    assert_eq!(count_attributes_utf16(&utf16("   "), 0, 3), 0);
    assert_eq!(count_attributes_utf16(&utf16("name="), 0, 5), 0);
    assert_eq!(count_attributes_utf16(&utf16("name= 'v'"), 0, 9), 1);
    assert_eq!(count_attributes_utf16(&utf16("name='v'"), 0, 8), 1);
    assert_eq!(count_attributes_utf16(&utf16("name=x"), 0, 6), 0);
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
    assert_eq!(js_to_int32(f64::NAN), 0);
    assert_eq!(js_to_int32(0.0), 0);
    assert_eq!(js_to_int32(1.9), 1);
    assert_eq!(js_to_int32(-1.9), -1);
    assert_eq!(js_to_int32(2_147_483_648.0), i32::MIN);
    assert_eq!(js_to_int32(4_294_967_297.0), 1);

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
    assert_eq!(load_u64_ne(b"short", 0), 0);

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
    let mixed_quotes = br#"<item text="' > '">"#;
    assert_eq!(
        find_tag_end_byte_loop(mixed_quotes, 1),
        Some(mixed_quotes.len() - 1)
    );
    assert_eq!(find_tag_end_byte_loop(br#"<item text="open"#, 1), None);

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

fn classifier_fixture(len: usize, quote: u8) -> Vec<u8> {
    let mut input = vec![b'a'; len];
    if len > 0 {
        input[0] = b'<';
    }
    if len > 10 {
        input[10] = b'>';
    }
    if len > 20 {
        input[20] = b'=';
    }
    if len > 63 {
        input[63] = quote;
    }
    if len > 64 {
        input[64] = b'>';
    }
    if len > 65 {
        input[65] = quote;
    }
    if len > 66 {
        input[66] = b'<';
    }
    if len > 67 {
        input[67] = b'=';
    }
    input
}

fn assert_classifier_matches_scalar(input: &[u8], include_eq: bool, simd: SimdPolicy) {
    let expected = classify_structural_masks_scalar(input, include_eq);
    let actual = classify_structural_masks(input, include_eq, simd).unwrap();
    assert_eq!(actual.lt_bits, expected.lt_bits);
    assert_eq!(actual.gt_bits, expected.gt_bits);
    assert_eq!(actual.eq_bits, expected.eq_bits);
    assert_eq!(
        BitPositionIter::new(&actual.lt_bits).collect::<Vec<_>>(),
        BitPositionIter::new(&expected.lt_bits).collect::<Vec<_>>()
    );
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

fn utf8_spans(input: &[u8], column: &ObjectRowsProjectionColumn) -> Vec<String> {
    column
        .span_starts
        .iter()
        .zip(column.span_ends.iter())
        .map(|(start, end)| {
            std::str::from_utf8(&input[*start as usize..*end as usize])
                .unwrap()
                .to_owned()
        })
        .collect()
}

fn object_rows_string_values(input: &[u8], column: &ObjectRowsProjectionColumn) -> Vec<String> {
    column
        .present
        .iter()
        .enumerate()
        .map(|(index, _)| {
            let start = column.span_starts.get(index).copied().unwrap_or(-1);
            let end = column.span_ends.get(index).copied().unwrap_or(-1);
            if start >= 0 && end >= start {
                return std::str::from_utf8(&input[start as usize..end as usize])
                    .unwrap()
                    .to_owned();
            }
            column.values.get(index).cloned().unwrap_or_default()
        })
        .collect()
}

fn detailed_object_rows_spec() -> ObjectRowsProjectionSpec {
    ObjectRowsProjectionSpec {
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
                output_name: "rank".to_owned(),
                value_kind: "number".to_owned(),
                source_kind: "attribute".to_owned(),
                source_name: "rank".to_owned(),
                text_mode: "direct".to_owned(),
            },
            ObjectRowsProjectionFieldSpec {
                output_name: "label".to_owned(),
                value_kind: "string".to_owned(),
                source_kind: "element".to_owned(),
                source_name: "label".to_owned(),
                text_mode: "direct".to_owned(),
            },
            ObjectRowsProjectionFieldSpec {
                output_name: "desc".to_owned(),
                value_kind: "string".to_owned(),
                source_kind: "element".to_owned(),
                source_name: "desc".to_owned(),
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
    }
}

fn minimal_utf8_table(input_len: usize, event_count: u32, attr_count: u32) -> Vec<u8> {
    let mut table = Vec::new();
    push_u32(&mut table, SPAN_TABLE_MAGIC);
    push_u32(&mut table, event_count);
    push_u32(&mut table, attr_count);
    push_u32(&mut table, input_len as u32);
    push_u32(&mut table, SPAN_TABLE_EVENT_BYTES as u32);
    push_u32(&mut table, SPAN_TABLE_ATTR_BYTES as u32);
    push_u32(&mut table, 1);
    table
}

fn push_event_record(
    table: &mut Vec<u8>,
    event_type: u8,
    name: Option<(usize, usize)>,
    text: Option<(usize, usize)>,
    attr_start: u32,
    attr_count: u32,
) {
    let (name_start, name_end) = name.map_or((NO_SPAN, NO_SPAN), |(start, end)| {
        (start as i32, end as i32)
    });
    let (text_start, text_end) = text.map_or((NO_SPAN, NO_SPAN), |(start, end)| {
        (start as i32, end as i32)
    });
    push_u32(table, event_type as u32);
    push_i32(table, name_start);
    push_i32(table, name_end);
    push_i32(table, text_start);
    push_i32(table, text_end);
    push_u32(table, attr_start);
    push_u32(table, attr_count);
}

fn push_attr_record(
    table: &mut Vec<u8>,
    name: Option<(usize, usize)>,
    value: Option<(usize, usize)>,
) {
    let (name_start, name_end) = name.map_or((NO_SPAN, NO_SPAN), |(start, end)| {
        (start as i32, end as i32)
    });
    let (value_start, value_end) = value.map_or((NO_SPAN, NO_SPAN), |(start, end)| {
        (start as i32, end as i32)
    });
    push_i32(table, name_start);
    push_i32(table, name_end);
    push_i32(table, value_start);
    push_i32(table, value_end);
}

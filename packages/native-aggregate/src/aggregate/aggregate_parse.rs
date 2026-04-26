use super::*;

pub(crate) fn parse_aggregate(input: &[u8], tier: Tier) -> Result<AggregateResult> {
    parse_aggregate_with_simd_policy(input, tier, SimdPolicy::Auto)
}

pub(crate) fn parse_aggregate_with_simd_policy(
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

pub(crate) fn parse_aggregate_with_parser(
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

pub(crate) fn parse_aggregate_auto_stage(
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

pub(crate) fn should_use_two_stage(input: &[u8]) -> bool {
    let sample = &input[..input.len().min(4096)];
    let lt_count = memchr::memchr_iter(b'<', sample).count().max(1);
    let quote_count =
        memchr::memchr_iter(b'"', sample).count() + memchr::memchr_iter(b'\'', sample).count();
    quote_count > lt_count * 5
}

pub(crate) fn parse_aggregate_fast_event_count(
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

pub(crate) fn parse_fast_event_count_bang(
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

pub(crate) fn emit_fast_event_count_event(
    state: &mut AggregateState,
    event_type: u8,
    fold_checksum: bool,
) {
    state.event_count = state.event_count.wrapping_add(1);
    if fold_checksum {
        state.checksum = mix_checksum(state.checksum, event_type as i32);
    }
}

pub(crate) fn parse_aggregate_utf16(input: &[u16], tier: Tier) -> Result<AggregateResult> {
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

pub(crate) fn parse_aggregate_two_stage(
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

pub(crate) fn emit_two_stage_event(
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

pub(crate) fn trim_start_tag_end(input: &[u8], lt: usize, gt: usize) -> (usize, bool) {
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

pub(crate) fn scan_name_end(input: &[u8], mut index: usize, end: usize) -> usize {
    while index < end {
        let byte = input[index];
        if is_whitespace(byte) || byte == b'/' {
            break;
        }
        index += 1;
    }
    index
}

use super::*;

pub(crate) fn parse_item_projection(input: &[u8]) -> Result<ItemProjectionResult> {
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

pub(crate) fn parse_item_projection_via_table(input: &[u8]) -> Result<ItemProjectionResult> {
    let table = parse_span_table(input)?;
    project_items_from_span_table(input, &table)
}

pub(crate) fn parse_item_rows_via_table(input: &[u8]) -> Result<ItemProjectionRowsResult> {
    let table = parse_span_table(input)?;
    project_item_rows_from_span_table(input, &table)
}

pub(crate) fn parse_object_rows(
    input: &[u8],
    spec: &ObjectRowsProjectionSpec,
) -> Result<ObjectRowsProjectionResult> {
    let spec = normalize_object_rows_spec(spec)?;
    parse_object_rows_normalized(input, &spec)
}

pub(crate) fn parse_object_rows_normalized(
    input: &[u8],
    spec: &NormalizedObjectRowsSpec,
) -> Result<ObjectRowsProjectionResult> {
    let mut parser = ObjectRowsProjectionParser {
        input,
        state: create_object_rows_projection_state(spec.fields.len()),
        spec: spec.clone(),
        event_count: 0,
        element_stack: Vec::new(),
    };
    parser.parse()?;
    let field_count = parser.spec.fields.len() as u32;

    Ok(ObjectRowsProjectionResult {
        input_bytes: input.len() as f64,
        event_count: parser.event_count,
        max_depth: to_u32_count(parser.state.max_depth, "object rows projection max depth")?,
        field_count,
        row_count: to_u32_count(parser.state.row_count, "object rows projection row count")?,
        columns: parser.state.columns,
    })
}

pub(crate) fn parse_object_records_normalized_direct(
    input: &[u8],
    output_names: &[String],
    spec: &NormalizedObjectRowsSpec,
) -> Result<ObjectRecordsProjectionResult> {
    let mut parser = ObjectRowsProjectionParser {
        input,
        state: create_object_records_projection_state(spec.fields.len(), output_names, input.len()),
        spec: spec.clone(),
        event_count: 0,
        element_stack: Vec::new(),
    };
    parser.parse()?;
    let json = finalize_object_records_projection_json(&mut parser.state)?;

    Ok(ObjectRecordsProjectionResult {
        input_bytes: input.len() as f64,
        event_count: parser.event_count,
        max_depth: to_u32_count(parser.state.max_depth, "object records projection max depth")?,
        field_count: to_u32_count(spec.fields.len(), "object records projection field count")?,
        row_count: to_u32_count(parser.state.row_count, "object records projection row count")?,
        json,
    })
}

pub(crate) fn parse_object_rows_via_table(
    input: &[u8],
    spec: &ObjectRowsProjectionSpec,
) -> Result<ObjectRowsProjectionResult> {
    let table = parse_span_table(input)?;
    project_object_rows_from_span_table(input, &table, spec)
}

pub(crate) fn parse_document_nodes(
    input: &[u8],
    options: &DocumentNodesProjectionOptions,
) -> Result<DocumentNodesProjectionResult> {
    let mut parser = DocumentNodesParser {
        input,
        entity_decoder: DocumentEntityDecoder::new(options),
        roots: Vec::new(),
        stack: Vec::new(),
        node_count: 0,
    };
    parser.parse()?;

    let mut json = String::with_capacity(input.len().min(1024 * 1024));
    push_document_nodes_json(&mut json, &parser.roots);

    Ok(DocumentNodesProjectionResult {
        input_bytes: input.len() as f64,
        node_count: to_u32_count(parser.node_count, "document node projection node count")?,
        json,
    })
}


enum DocumentNode {
    Text(String),
    Element(DocumentElementNode),
}

struct DocumentElementNode {
    tag_name: String,
    attributes: Vec<(String, String)>,
    children: Vec<DocumentNode>,
}

struct DocumentNodesParser<'a> {
    input: &'a [u8],
    entity_decoder: DocumentEntityDecoder,
    roots: Vec<DocumentNode>,
    stack: Vec<DocumentElementNode>,
    node_count: usize,
}


struct DocumentEntityDecoder {
    decode: bool,
    entities: Vec<(String, String)>,
}

impl DocumentEntityDecoder {
    fn new(options: &DocumentNodesProjectionOptions) -> Self {
        let mut entities = Vec::from([
            ("&quot;".to_owned(), "\"".to_owned()),
            ("&apos;".to_owned(), "'".to_owned()),
            ("&lt;".to_owned(), "<".to_owned()),
            ("&gt;".to_owned(), ">".to_owned()),
        ]);
        if let Some(custom_entities) = &options.add_entities {
            for entity in custom_entities {
                if !entity.entity.is_empty() {
                    entities.push((normalize_document_entity_name(&entity.entity), entity.value.clone()));
                }
            }
        }
        entities.push(("&amp;".to_owned(), "&".to_owned()));
        entities.sort_by(|left, right| right.0.len().cmp(&left.0.len()));

        Self {
            decode: options.auto_decode_entities.unwrap_or(true),
            entities,
        }
    }

    fn decode(&self, value: String) -> String {
        if !self.decode || !value.contains('&') {
            return value;
        }

        let mut out = String::with_capacity(value.len());
        let mut rest = value.as_str();
        while let Some(offset) = rest.find('&') {
            out.push_str(&rest[..offset]);
            let entity = &rest[offset..];
            if let Some((pattern, replacement)) = self
                .entities
                .iter()
                .find(|(pattern, _replacement)| entity.starts_with(pattern))
            {
                out.push_str(replacement);
                rest = &entity[pattern.len()..];
            } else {
                out.push('&');
                rest = &entity[1..];
            }
        }
        out.push_str(rest);
        out
    }
}

fn normalize_document_entity_name(entity: &str) -> String {
    if entity.starts_with('&') && entity.ends_with(';') {
        entity.to_owned()
    } else {
        format!("&{entity};")
    }
}

impl<'a> DocumentNodesParser<'a> {
    fn parse(&mut self) -> Result<()> {
        let mut position = 0;
        while position < self.input.len() {
            let Some(lt_offset) = memchr(b'<', &self.input[position..]) else {
                self.capture_text(position, self.input.len())?;
                break;
            };
            let lt = position + lt_offset;
            self.capture_text(position, lt)?;
            position = self.parse_markup(lt)?;
        }

        if !self.stack.is_empty() {
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
            self.capture_text(position + 9, end)?;
            return Ok(end + 3);
        }

        if starts_with(self.input, position, b"<!--") {
            let Some(end) = find_bytes(self.input, b"-->", position + 4) else {
                return Err(Error::from_reason("Unclosed comment"));
            };
            return Ok(end + 3);
        }

        if starts_with(self.input, position, b"<!DOCTYPE") {
            let Some(end) = find_doctype_end(self.input, position + 2) else {
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
        if name_end == name_start {
            return Err(Error::from_reason("Start tag name is empty"));
        }

        let tag_name = materialize_span(self.input, name_start, name_end)?;
        let mut attributes = Vec::new();
        for attr in parse_attributes(self.input, name_end, actual_end).iter() {
            attributes.push((
                materialize_span(self.input, attr.name_start, attr.name_end)?,
                self.materialize_decoded_span(attr.value_start, attr.value_end)?,
            ));
        }

        let element = DocumentElementNode {
            tag_name,
            attributes,
            children: Vec::new(),
        };

        if self_closing {
            self.append_node(DocumentNode::Element(element));
        } else {
            self.stack.push(element);
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

        let tag_name = materialize_span(self.input, name_start, name_end)?;
        let Some(element) = self.stack.pop() else {
            return Err(Error::from_reason("Unexpected closing tag"));
        };
        if element.tag_name != tag_name {
            return Err(Error::from_reason("Mismatched closing tag"));
        }
        self.append_node(DocumentNode::Element(element));
        Ok(end + 1)
    }

    fn capture_text(&mut self, start: usize, end: usize) -> Result<()> {
        if start >= end {
            return Ok(());
        }
        let value = self.materialize_decoded_span(start, end)?;
        if !value.is_empty() {
            self.append_node(DocumentNode::Text(value));
        }
        Ok(())
    }

    fn materialize_decoded_span(&self, start: usize, end: usize) -> Result<String> {
        Ok(self.entity_decoder.decode(materialize_span(self.input, start, end)?))
    }

    fn append_node(&mut self, node: DocumentNode) {
        self.node_count += 1;
        if let Some(parent) = self.stack.last_mut() {
            parent.children.push(node);
        } else {
            self.roots.push(node);
        }
    }
}


fn push_document_nodes_json(out: &mut String, nodes: &[DocumentNode]) {
    out.push('[');
    for (index, node) in nodes.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        push_document_node_json(out, node);
    }
    out.push(']');
}

fn push_document_node_json(out: &mut String, node: &DocumentNode) {
    match node {
        DocumentNode::Text(value) => push_json_string(out, value),
        DocumentNode::Element(element) => {
            out.push_str("{\"tagName\":");
            push_json_string(out, &element.tag_name);
            out.push_str(",\"attributes\":{");
            for (index, (name, value)) in element.attributes.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                push_json_string(out, name);
                out.push(':');
                push_json_string(out, value);
            }
            out.push_str("},\"children\":");
            push_document_nodes_json(out, &element.children);
            out.push('}');
        }
    }
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
            let Some(end) = find_doctype_end(self.input, position + 2) else {
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

        if let Some(item) = self.current_item.take_if(|item| {
            item.depth == depth && span_eq(self.input, name_start, name_end, b"item")
        }) {
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
        for item in self.current_item.iter_mut() {
            match capture.field {
                ItemProjectionField::Name => item.name = Some((start, end)),
                ItemProjectionField::Value => item.value = Some((start, end)),
            }
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
            let Some(end) = find_doctype_end(self.input, position + 2) else {
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
        record_object_rows_position(&mut self.state);
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
            pop_object_rows_position_scope(&mut self.state);
            self.state.depth -= 1;
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
        pop_object_rows_position_scope(&mut self.state);
        self.state.depth -= 1;
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

pub(crate) fn project_items_from_span_table(
    input: &[u8],
    table: &[u8],
) -> Result<ItemProjectionResult> {
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

pub(crate) fn project_item_rows_from_span_table(
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

pub(crate) fn project_item_rows_from_span_table_bytes(
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

pub(crate) fn start_table_projection_element(
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

pub(crate) fn end_table_projection_element(
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
    if let Some(item) = state
        .current_item
        .take_if(|item| item.depth == depth && span_eq(input, name_start, name_end, b"item"))
    {
        if let (Some((name_start, name_end)), Some((value_start, value_end))) =
            (item.name, item.value)
        {
            state.rows.push(ItemProjectionRow {
                id: item.id,
                name_start,
                name_end,
                value_start,
                value_end,
            });
        }
    }
    Ok(())
}

pub(crate) fn capture_table_projection_text(
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

pub(crate) fn read_table_projection_id(
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

pub(crate) fn project_object_rows_from_span_table(
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
                record_object_rows_position(&mut state);
                state.max_depth = state.max_depth.max(state.depth);
                start_object_rows_projection_element(input, &table, event, &spec, &mut state)?;
            }
            value if value == END_ELEMENT as u32 => {
                end_object_rows_projection_element(input, event, &spec, &mut state)?;
                pop_object_rows_position_scope(&mut state);
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

pub(crate) fn create_object_rows_projection_state(field_count: usize) -> ObjectRowsProjectionState {
    ObjectRowsProjectionState {
        depth: 0,
        max_depth: 0,
        position_stack: Vec::new(),
        element_names: Vec::new(),
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
        output_names: None,
        records_json: None,
    }
}

pub(crate) fn create_object_records_projection_state(
    _field_count: usize,
    output_names: &[String],
    input_len: usize,
) -> ObjectRowsProjectionState {
    ObjectRowsProjectionState {
        depth: 0,
        max_depth: 0,
        position_stack: Vec::new(),
        element_names: Vec::new(),
        current_row: None,
        capture: None,
        row_count: 0,
        columns: Vec::new(),
        output_names: Some(output_names.to_vec()),
        records_json: Some(String::with_capacity(input_len.min(1024 * 1024))),
    }
}

pub(crate) fn normalize_object_rows_spec(
    spec: &ObjectRowsProjectionSpec,
) -> Result<NormalizedObjectRowsSpec> {
    if spec.item_name.is_empty() {
        return Err(Error::from_reason(
            "Object rows projection requires an item element name",
        ));
    }
    let item_position = match spec.item_position {
        Some(0) => {
            return Err(Error::from_reason(
                "Object rows projection item position must be positive when provided",
            ));
        }
        Some(value) => Some(value as usize),
        None => None,
    };
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
        let source_path = match (&field.source_path, source_kind) {
            (Some(_), ObjectRowsSourceKind::Attribute) => {
                return Err(Error::from_reason(
                    "Object rows projection attribute fields do not support sourcePath",
                ));
            }
            (_, ObjectRowsSourceKind::Attribute) => vec![field.source_name.as_bytes().to_vec()],
            (Some(path), ObjectRowsSourceKind::Element) => {
                if path.is_empty() {
                    return Err(Error::from_reason(
                        "Object rows projection element sourcePath cannot be empty",
                    ));
                }
                let mut normalized = Vec::with_capacity(path.len());
                for segment in path {
                    if segment.is_empty() {
                        return Err(Error::from_reason(
                            "Object rows projection element sourcePath segments cannot be empty",
                        ));
                    }
                    normalized.push(segment.as_bytes().to_vec());
                }
                if normalized.last().is_none_or(|segment| segment.as_slice() != field.source_name.as_bytes()) {
                    return Err(Error::from_reason(
                        "Object rows projection sourcePath must end with sourceName",
                    ));
                }
                normalized
            }
            (None, ObjectRowsSourceKind::Element) => vec![field.source_name.as_bytes().to_vec()],
        };
        let source_positions = match (&field.source_positions, source_kind) {
            (Some(_), ObjectRowsSourceKind::Attribute) => {
                return Err(Error::from_reason(
                    "Object rows projection attribute fields do not support sourcePositions",
                ));
            }
            (Some(positions), ObjectRowsSourceKind::Element) => {
                if positions.len() != source_path.len() {
                    return Err(Error::from_reason(
                        "Object rows projection sourcePositions must match sourcePath length",
                    ));
                }
                positions.iter().map(|position| *position as usize).collect()
            }
            (None, ObjectRowsSourceKind::Attribute) => Vec::new(),
            (None, ObjectRowsSourceKind::Element) => vec![0; source_path.len()],
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
            source_path,
            source_positions,
            text_mode,
        });
    }

    Ok(NormalizedObjectRowsSpec {
        item_name: spec.item_name.as_bytes().to_vec(),
        item_position,
        fields,
    })
}

fn matches_object_rows_item_position(
    spec: &NormalizedObjectRowsSpec,
    state: &ObjectRowsProjectionState,
) -> bool {
    match spec.item_position {
        Some(expected) => state.position_stack.get(state.depth - 1).copied() == Some(expected),
        None => true,
    }
}

fn object_rows_field_matches_element(
    field: &NormalizedObjectRowsField,
    row: &CurrentObjectRowsProjection,
    state: &ObjectRowsProjectionState,
) -> bool {
    if field.source_path.is_empty() || state.depth != row.depth + field.source_path.len() {
        return false;
    }

    for (index, segment) in field.source_path.iter().enumerate() {
        let absolute_index = row.depth + index;
        if state
            .element_names
            .get(absolute_index)
            .is_none_or(|name| name.as_slice() != segment.as_slice())
        {
            return false;
        }
        let expected_position = field.source_positions.get(index).copied().unwrap_or(0);
        if expected_position != 0
            && state.position_stack.get(absolute_index).copied() != Some(expected_position)
        {
            return false;
        }
    }
    true
}

fn record_object_rows_position(state: &mut ObjectRowsProjectionState) {
    if state.position_stack.len() < state.depth {
        state.position_stack.push(1);
        return;
    }
    if let Some(position) = state.position_stack.get_mut(state.depth - 1) {
        *position += 1;
    }
}

fn pop_object_rows_position_scope(state: &mut ObjectRowsProjectionState) {
    if state.position_stack.len() > state.depth {
        state.position_stack.pop();
    }
}

pub(crate) fn start_object_rows_projection_element(
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
    state.element_names.push(name.to_vec());

    if state.current_row.is_none()
        && name == spec.item_name.as_slice()
        && matches_object_rows_item_position(spec, state)
    {
        let mut row = CurrentObjectRowsProjection {
            depth: state.depth,
            completed: vec![false; spec.fields.len()],
            present: vec![false; spec.fields.len()],
            values: vec![String::new(); spec.fields.len()],
            string_materialized: vec![false; spec.fields.len()],
            span_starts: vec![-1; spec.fields.len()],
            span_ends: vec![-1; spec.fields.len()],
            number_values: vec![0.0; spec.fields.len()],
            number_buffers: (0..spec.fields.len()).map(|_| Vec::new()).collect(),
        };
        read_object_rows_projection_attributes(input, table, event, spec, &mut row)?;
        state.current_row = Some(row);
        return Ok(());
    }

    let Some(row) = state.current_row.as_ref() else {
        return Ok(());
    };

    let mut field_indices = Vec::new();
    let mut text_mode = ObjectRowsTextMode::Subtree;
    for (index, field) in spec.fields.iter().enumerate() {
        if field.source_kind == ObjectRowsSourceKind::Element
            && !row.completed[index]
            && object_rows_field_matches_element(field, row, state)
        {
            field_indices.push(index);
            text_mode = field.text_mode;
        }
    }
    if !field_indices.is_empty() {
        let row = state.current_row.as_mut().expect("current_row present while capture is active");
        for index in &field_indices {
            row.present[*index] = true;
        }
        state.capture = Some(ObjectRowsProjectionCapture {
            depth: state.depth,
            field_indices,
            text_mode,
        });
    }
    Ok(())
}

pub(crate) fn read_object_rows_projection_attributes(
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
                        set_object_rows_projection_string_span(
                            input,
                            row,
                            index,
                            value_start,
                            value_end,
                        )?;
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

pub(crate) fn start_object_rows_projection_element_direct(
    input: &[u8],
    name_start: usize,
    name_end: usize,
    attr_start: usize,
    attr_end: usize,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    let name = &input[name_start..name_end];
    state.element_names.push(name.to_vec());

    if state.current_row.is_none()
        && name == spec.item_name.as_slice()
        && matches_object_rows_item_position(spec, state)
    {
        let mut row = CurrentObjectRowsProjection {
            depth: state.depth,
            completed: vec![false; spec.fields.len()],
            present: vec![false; spec.fields.len()],
            values: vec![String::new(); spec.fields.len()],
            string_materialized: vec![false; spec.fields.len()],
            span_starts: vec![-1; spec.fields.len()],
            span_ends: vec![-1; spec.fields.len()],
            number_values: vec![0.0; spec.fields.len()],
            number_buffers: (0..spec.fields.len()).map(|_| Vec::new()).collect(),
        };
        read_object_rows_projection_attributes_direct(input, attr_start, attr_end, spec, &mut row)?;
        state.current_row = Some(row);
        return Ok(());
    }

    let Some(row) = state.current_row.as_ref() else {
        return Ok(());
    };

    let mut field_indices = Vec::new();
    let mut text_mode = ObjectRowsTextMode::Subtree;
    for (index, field) in spec.fields.iter().enumerate() {
        if field.source_kind == ObjectRowsSourceKind::Element
            && !row.completed[index]
            && object_rows_field_matches_element(field, row, state)
        {
            field_indices.push(index);
            text_mode = field.text_mode;
        }
    }
    if !field_indices.is_empty() {
        let row = state.current_row.as_mut().expect("current_row present while capture is active");
        for index in &field_indices {
            row.present[*index] = true;
        }
        state.capture = Some(ObjectRowsProjectionCapture {
            depth: state.depth,
            field_indices,
            text_mode,
        });
    }
    Ok(())
}

pub(crate) fn read_object_rows_projection_attributes_direct(
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
                        set_object_rows_projection_string_span(
                            input,
                            row,
                            index,
                            attr.value_start,
                            attr.value_end,
                        )?;
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

pub(crate) fn end_object_rows_projection_element(
    input: &[u8],
    event: TableEventRecord,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    if let Some(capture) = state
        .capture
        .take_if(|capture| capture.depth == state.depth)
    {
        if let Some(row) = &mut state.current_row {
            for index in &capture.field_indices {
                if row.present[*index] {
                    match spec.fields[*index].value_kind {
                        ObjectRowsValueKind::String => {
                            trim_object_rows_projection_string(input, row, *index)?;
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

    let Some((name_start, name_end)) = event.name_range()? else {
        if state.element_names.len() >= state.depth {
            state.element_names.pop();
        }
        return Ok(());
    };
    if let Some(mut row) = state.current_row.take_if(|row| {
        row.depth == state.depth && &input[name_start..name_end] == spec.item_name.as_slice()
    }) {
        for index in 0..spec.fields.len() {
            state.columns[index].present.push(row.present[index]);
            match spec.fields[index].value_kind {
                ObjectRowsValueKind::String => {
                    push_object_rows_projection_string_column(
                        &mut state.columns[index],
                        state.row_count,
                        &mut row,
                        index,
                    );
                }
                ObjectRowsValueKind::Number => {
                    state.columns[index]
                        .number_values
                        .push(row.number_values[index]);
                }
            }
        }
        state.row_count += 1;
    }
    if state.element_names.len() >= state.depth {
        state.element_names.pop();
    }
    Ok(())
}

pub(crate) fn end_object_rows_projection_element_direct(
    input: &[u8],
    name_start: usize,
    name_end: usize,
    spec: &NormalizedObjectRowsSpec,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    if let Some(capture) = state
        .capture
        .take_if(|capture| capture.depth == state.depth)
    {
        if let Some(row) = &mut state.current_row {
            for index in &capture.field_indices {
                if row.present[*index] {
                    match spec.fields[*index].value_kind {
                        ObjectRowsValueKind::String => {
                            trim_object_rows_projection_string(input, row, *index)?;
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

    if let Some(mut row) = state.current_row.take_if(|row| {
        row.depth == state.depth && &input[name_start..name_end] == spec.item_name.as_slice()
    }) {
        if state.records_json.is_some() {
            append_object_records_projection_row_json(input, spec, &mut row, state)?;
        } else {
            for index in 0..spec.fields.len() {
                state.columns[index].present.push(row.present[index]);
                match spec.fields[index].value_kind {
                    ObjectRowsValueKind::String => {
                        push_object_rows_projection_string_column(
                            &mut state.columns[index],
                            state.row_count,
                            &mut row,
                            index,
                        );
                    }
                    ObjectRowsValueKind::Number => {
                        state.columns[index]
                            .number_values
                            .push(row.number_values[index]);
                    }
                }
            }
        }
        state.row_count += 1;
    }
    if state.element_names.len() >= state.depth {
        state.element_names.pop();
    }
    Ok(())
}

pub(crate) fn capture_object_rows_projection_text(
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

pub(crate) fn capture_object_rows_projection_text_span(
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

pub(crate) fn append_object_rows_projection_string(
    input: &[u8],
    start: usize,
    end: usize,
    row: &mut CurrentObjectRowsProjection,
    index: usize,
) -> Result<()> {
    if row.span_starts[index] < 0 && !row.string_materialized[index] {
        set_object_rows_projection_string_span(input, row, index, start, end)?;
        return Ok(());
    }

    materialize_object_rows_projection_string_span(input, row, index)?;
    row.values[index].push_str(&materialize_span(input, start, end)?);
    row.string_materialized[index] = true;
    Ok(())
}

fn set_object_rows_projection_string_span(
    input: &[u8],
    row: &mut CurrentObjectRowsProjection,
    index: usize,
    start: usize,
    end: usize,
) -> Result<()> {
    std::str::from_utf8(&input[start..end])
        .map_err(|error| Error::from_reason(error.to_string()))?;
    let start = to_i32_span(start)?;
    let end = to_i32_span(end)?;
    row.span_starts[index] = start;
    row.span_ends[index] = end;
    row.string_materialized[index] = false;
    row.values[index].clear();
    Ok(())
}

fn materialize_object_rows_projection_string_span(
    input: &[u8],
    row: &mut CurrentObjectRowsProjection,
    index: usize,
) -> Result<()> {
    if row.span_starts[index] < 0 {
        return Ok(());
    }
    let start = row.span_starts[index] as usize;
    let end = row.span_ends[index] as usize;
    row.values[index] = materialize_span(input, start, end)?;
    row.string_materialized[index] = true;
    row.span_starts[index] = -1;
    row.span_ends[index] = -1;
    Ok(())
}

fn trim_object_rows_projection_string(
    input: &[u8],
    row: &mut CurrentObjectRowsProjection,
    index: usize,
) -> Result<()> {
    if row.span_starts[index] >= 0 && !row.string_materialized[index] {
        let start = row.span_starts[index] as usize;
        let end = row.span_ends[index] as usize;
        let text = std::str::from_utf8(&input[start..end])
            .map_err(|error| Error::from_reason(error.to_string()))?;
        let trimmed = text.trim();
        let trim_start = trimmed.as_ptr() as usize - text.as_ptr() as usize;
        row.span_starts[index] = to_i32_span(start + trim_start)?;
        row.span_ends[index] = to_i32_span(start + trim_start + trimmed.len())?;
        return Ok(());
    }

    if row.string_materialized[index] {
        row.values[index] = row.values[index].trim().to_owned();
    }
    Ok(())
}

fn push_object_rows_projection_string_column(
    column: &mut ObjectRowsProjectionColumn,
    row_count: usize,
    row: &mut CurrentObjectRowsProjection,
    index: usize,
) {
    column.span_starts.push(row.span_starts[index]);
    column.span_ends.push(row.span_ends[index]);

    if !column.values.is_empty()
        || row.string_materialized[index]
        || (row.present[index] && row.span_starts[index] < 0)
    {
        while column.values.len() < row_count {
            column.values.push(String::new());
        }
        column.values.push(std::mem::take(&mut row.values[index]));
    }
}

fn append_object_records_projection_row_json(
    input: &[u8],
    spec: &NormalizedObjectRowsSpec,
    row: &mut CurrentObjectRowsProjection,
    state: &mut ObjectRowsProjectionState,
) -> Result<()> {
    let output_names = state.output_names.as_ref().ok_or_else(|| {
        Error::from_reason("Object records projection state missing output names")
    })?;
    let json = state.records_json.as_mut().ok_or_else(|| {
        Error::from_reason("Object records projection state missing json sink")
    })?;
    if output_names.len() != spec.fields.len() {
        return Err(Error::from_reason(
            "Object records projection output name count mismatch",
        ));
    }

    if state.row_count == 0 {
        json.push('[');
    } else {
        json.push(',');
    }
    json.push('{');
    for (index, field) in spec.fields.iter().enumerate() {
        if index > 0 {
            json.push(',');
        }
        push_json_string(json, &output_names[index]);
        json.push(':');
        match field.value_kind {
            ObjectRowsValueKind::String => {
                push_object_records_projection_string_value(json, input, row, index)?;
            }
            ObjectRowsValueKind::Number => {
                push_object_records_projection_number_value(json, row, index)?;
            }
        }
    }
    json.push('}');
    Ok(())
}

fn push_object_records_projection_string_value(
    out: &mut String,
    input: &[u8],
    row: &CurrentObjectRowsProjection,
    index: usize,
) -> Result<()> {
    if !row.present[index] {
        push_json_string(out, "");
        return Ok(());
    }
    if row.span_starts[index] >= 0 && !row.string_materialized[index] {
        let start = row.span_starts[index] as usize;
        let end = row.span_ends[index] as usize;
        let value = std::str::from_utf8(
            input
                .get(start..end)
                .ok_or_else(|| Error::from_reason("Object records projection string span out of range"))?,
        )
        .map_err(|error| Error::from_reason(error.to_string()))?;
        push_json_string(out, value);
        return Ok(());
    }
    push_json_string(out, &row.values[index]);
    Ok(())
}

fn push_object_records_projection_number_value(
    out: &mut String,
    row: &CurrentObjectRowsProjection,
    index: usize,
) -> Result<()> {
    let value = if row.present[index] {
        row.number_values[index]
    } else {
        f64::NAN
    };
    if value.is_finite() {
        use std::fmt::Write;
        write!(out, "{value}").map_err(|error| Error::from_reason(error.to_string()))?;
    } else {
        out.push_str("null");
    }
    Ok(())
}

fn finalize_object_records_projection_json(
    state: &mut ObjectRowsProjectionState,
) -> Result<String> {
    let mut json = state.records_json.take().ok_or_else(|| {
        Error::from_reason("Object records projection state missing json sink")
    })?;
    if state.row_count == 0 {
        json.push('[');
    }
    json.push(']');
    Ok(json)
}

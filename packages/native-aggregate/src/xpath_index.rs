#![allow(dead_code)]

// simdxml notice:
// This module intentionally mirrors simdxml's flat XPath index shape so the
// XPath 1.0 parser/evaluator can be adapted with minimal semantic drift.
// The data model, CSR child layout, close-map, post-order, and name posting
// strategy are informed by simdxml (https://github.com/simdxml/simdxml),
// which is licensed MIT OR Apache-2.0. stax-xml uses those ideas under
// simdxml's MIT license option while retaining stax-xml's JS input plus
// native index ownership boundary.

use memchr::memchr;
use napi::{Error, Result};

pub(crate) const NO_INDEX: u32 = u32::MAX;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub(crate) enum TagType {
    Open = 0,
    Close = 1,
    SelfClose = 2,
    Comment = 3,
    CData = 4,
    Pi = 5,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct TextRange {
    pub start: u64,
    pub end: u64,
    pub parent_tag: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Span {
    pub start: u64,
    pub end: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct AttrSpan {
    pub name: Span,
    pub value: Span,
}

#[derive(Debug)]
pub(crate) struct XmlIndex<'a> {
    input: &'a [u8],
    pub tag_starts: Vec<u64>,
    pub tag_ends: Vec<u64>,
    pub tag_types: Vec<TagType>,
    pub tag_names: Vec<Span>,
    pub depths: Vec<u16>,
    pub parents: Vec<u32>,
    pub attr_starts: Vec<u32>,
    pub attr_counts: Vec<u32>,
    pub attrs: Vec<AttrSpan>,
    pub text_ranges: Vec<TextRange>,
    pub child_offsets: Vec<u32>,
    pub child_data: Vec<u32>,
    pub text_child_offsets: Vec<u32>,
    pub text_child_data: Vec<u32>,
    pub close_map: Vec<u32>,
    pub post_order: Vec<u32>,
    pub name_ids: Vec<u16>,
    pub name_table: Vec<Span>,
    pub name_posting: Vec<Vec<u32>>,
}

pub(crate) fn parse(input: &[u8]) -> Result<XmlIndex<'_>> {
    let mut parser = Parser {
        input,
        index: XmlIndex::new(input),
        parent_stack: Vec::new(),
        last_tag_end: None,
    };
    parser.parse()?;
    Ok(parser.index)
}

impl<'a> XmlIndex<'a> {
    fn new(input: &'a [u8]) -> Self {
        let est_tags = input.len().saturating_div(128).max(8);
        Self {
            input,
            tag_starts: Vec::with_capacity(est_tags),
            tag_ends: Vec::with_capacity(est_tags),
            tag_types: Vec::with_capacity(est_tags),
            tag_names: Vec::with_capacity(est_tags),
            depths: Vec::with_capacity(est_tags),
            parents: Vec::with_capacity(est_tags),
            attr_starts: Vec::with_capacity(est_tags),
            attr_counts: Vec::with_capacity(est_tags),
            attrs: Vec::new(),
            text_ranges: Vec::new(),
            child_offsets: Vec::new(),
            child_data: Vec::new(),
            text_child_offsets: Vec::new(),
            text_child_data: Vec::new(),
            close_map: Vec::new(),
            post_order: Vec::new(),
            name_ids: Vec::new(),
            name_table: Vec::new(),
            name_posting: Vec::new(),
        }
    }

    pub(crate) fn tag_count(&self) -> usize {
        self.tag_starts.len()
    }

    pub(crate) fn ensure_indices(&mut self) {
        if self.has_indices() || self.tag_count() == 0 {
            return;
        }
        let tag_count = self.tag_count();
        let (child_offsets, child_data) =
            build_csr_children(&self.tag_types, &self.parents, tag_count);
        let (text_child_offsets, text_child_data) =
            build_csr_text_children(&self.text_ranges, tag_count);
        let (close_map, post_order) = build_close_map_and_post_order(&self.tag_types, tag_count);
        self.child_offsets = child_offsets;
        self.child_data = child_data;
        self.text_child_offsets = text_child_offsets;
        self.text_child_data = text_child_data;
        self.close_map = close_map;
        self.post_order = post_order;
    }

    pub(crate) fn has_indices(&self) -> bool {
        !self.child_offsets.is_empty()
    }

    pub(crate) fn build_name_index(&mut self) {
        if !self.name_posting.is_empty() {
            return;
        }
        let mut interner = NameInterner::new(self.input);
        self.name_ids = Vec::with_capacity(self.tag_count());

        for (idx, name) in self.tag_names.iter().enumerate() {
            if name.start == name.end || !is_element_tag(self.tag_types[idx]) {
                self.name_ids.push(u16::MAX);
                continue;
            }
            let bytes = &self.input[name.start as usize..name.end as usize];
            self.name_ids.push(interner.intern(bytes, *name));
        }

        self.name_table = interner.into_table();
        self.name_posting = vec![Vec::new(); self.name_table.len()];
        for (idx, &name_id) in self.name_ids.iter().enumerate() {
            if name_id != u16::MAX {
                self.name_posting[name_id as usize].push(idx as u32);
            }
        }
    }

    pub(crate) fn child_tag_slice(&self, parent_idx: usize) -> &[u32] {
        if parent_idx + 1 >= self.child_offsets.len() {
            return &[];
        }
        let start = self.child_offsets[parent_idx] as usize;
        let end = self.child_offsets[parent_idx + 1] as usize;
        &self.child_data[start..end]
    }

    pub(crate) fn child_text_slice(&self, parent_idx: usize) -> &[u32] {
        if parent_idx + 1 >= self.text_child_offsets.len() {
            return &[];
        }
        let start = self.text_child_offsets[parent_idx] as usize;
        let end = self.text_child_offsets[parent_idx + 1] as usize;
        &self.text_child_data[start..end]
    }

    pub(crate) fn is_ancestor(&self, ancestor_idx: usize, descendant_idx: usize) -> bool {
        ancestor_idx < descendant_idx
            && ancestor_idx < self.post_order.len()
            && descendant_idx < self.post_order.len()
            && self.post_order[ancestor_idx] > self.post_order[descendant_idx]
    }

    pub(crate) fn parent(&self, tag_idx: usize) -> Option<usize> {
        let parent = *self.parents.get(tag_idx)?;
        (parent != NO_INDEX).then_some(parent as usize)
    }

    pub(crate) fn tag_name(&self, tag_idx: usize) -> &'a str {
        let Some(span) = self.tag_names.get(tag_idx).copied() else {
            return "";
        };
        self.str_span(span)
    }

    pub(crate) fn tag_name_eq(&self, tag_idx: usize, name: &str) -> bool {
        let Some(span) = self.tag_names.get(tag_idx).copied() else {
            return false;
        };
        self.input[span.start as usize..span.end as usize] == *name.as_bytes()
    }

    pub(crate) fn text_content(&self, range: &TextRange) -> &'a str {
        self.str_span(Span {
            start: range.start,
            end: range.end,
        })
    }

    pub(crate) fn get_attribute(&self, tag_idx: usize, name: &str) -> Option<&'a str> {
        let attr_range = self.attr_range(tag_idx)?;
        attr_range
            .iter()
            .find(|attr| {
                self.input[attr.name.start as usize..attr.name.end as usize] == *name.as_bytes()
            })
            .map(|attr| self.str_span(attr.value))
    }

    pub(crate) fn get_all_attribute_names(&self, tag_idx: usize) -> Vec<&'a str> {
        self.attr_range(tag_idx)
            .map(|attrs| attrs.iter().map(|attr| self.str_span(attr.name)).collect())
            .unwrap_or_default()
    }

    pub(crate) fn get_namespace_decls(&self, tag_idx: usize) -> Vec<(&'a str, &'a str)> {
        self.attr_range(tag_idx)
            .map(|attrs| {
                attrs
                    .iter()
                    .filter_map(|attr| {
                        let name = self.str_span(attr.name);
                        if name == "xmlns" {
                            Some(("", self.str_span(attr.value)))
                        } else {
                            name.strip_prefix("xmlns:")
                                .map(|prefix| (prefix, self.str_span(attr.value)))
                        }
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn attr_range(&self, tag_idx: usize) -> Option<&[AttrSpan]> {
        let start = *self.attr_starts.get(tag_idx)? as usize;
        let count = *self.attr_counts.get(tag_idx)? as usize;
        Some(&self.attrs[start..start + count])
    }

    fn str_span(&self, span: Span) -> &'a str {
        let bytes = &self.input[span.start as usize..span.end as usize];
        std::str::from_utf8(bytes).unwrap_or("")
    }
}

struct Parser<'a> {
    input: &'a [u8],
    index: XmlIndex<'a>,
    parent_stack: Vec<u32>,
    last_tag_end: Option<usize>,
}

struct PushTagArgs {
    start: usize,
    end: usize,
    tag_type: TagType,
    name_start: usize,
    name_end: usize,
    depth: u16,
    parent: u32,
    attr_start: usize,
    attr_count: usize,
}

impl Parser<'_> {
    fn parse(&mut self) -> Result<()> {
        let mut position = 0;
        while let Some(relative_lt) = memchr(b'<', &self.input[position..]) {
            let lt = position + relative_lt;
            self.capture_text_before(lt);

            let next = self.parse_tag(lt)?;
            position = next;
        }
        self.capture_text_before(self.input.len());

        if !self.parent_stack.is_empty() {
            return Err(error("Unclosed start tag in XPath structural index"));
        }
        self.index.ensure_indices();
        self.index.build_name_index();
        Ok(())
    }

    fn capture_text_before(&mut self, lt: usize) {
        let start = self.last_tag_end.map_or(0, |end| end + 1);
        if start < lt {
            self.index.text_ranges.push(TextRange {
                start: start as u64,
                end: lt as u64,
                parent_tag: self.parent_stack.last().copied().unwrap_or(NO_INDEX),
            });
        }
    }

    fn parse_tag(&mut self, lt: usize) -> Result<usize> {
        if lt + 1 >= self.input.len() {
            return Err(error("Unclosed tag in XPath structural index"));
        }

        match self.input[lt + 1] {
            b'/' => self.parse_close_tag(lt),
            b'!' if self.input.get(lt + 2..lt + 4) == Some(b"--") => self.parse_comment(lt),
            b'!' if self.input.get(lt + 2..lt + 9) == Some(b"[CDATA[") => self.parse_cdata(lt),
            b'!' => self.parse_doctype_or_decl(lt),
            b'?' => self.parse_pi(lt),
            _ => self.parse_start_tag(lt),
        }
    }

    fn parse_close_tag(&mut self, lt: usize) -> Result<usize> {
        let end = find_byte(self.input, b'>', lt + 2)
            .ok_or_else(|| error("Unclosed end tag in XPath structural index"))?;
        let mut name_start = skip_ws(self.input, lt + 2, end);
        let mut name_end = end;
        while name_end > name_start && is_ws(self.input[name_end - 1]) {
            name_end -= 1;
        }
        name_start = name_start.min(name_end);

        let Some(open_idx) = self.parent_stack.pop() else {
            return Err(error("Unexpected end tag in XPath structural index"));
        };
        let open_name = self.index.tag_names[open_idx as usize];
        if self.input[open_name.start as usize..open_name.end as usize]
            != self.input[name_start..name_end]
        {
            return Err(error("Mismatched end tag in XPath structural index"));
        }

        let parent = self.parent_stack.last().copied().unwrap_or(NO_INDEX);
        let depth = self.parent_stack.len() as u16;
        self.push_tag(PushTagArgs {
            start: lt,
            end,
            tag_type: TagType::Close,
            name_start,
            name_end,
            depth,
            parent,
            attr_start: 0,
            attr_count: 0,
        })?;
        self.last_tag_end = Some(end);
        Ok(end + 1)
    }

    fn parse_start_tag(&mut self, lt: usize) -> Result<usize> {
        let tag_end = find_tag_end(self.input, lt + 1)
            .ok_or_else(|| error("Unclosed start tag in XPath structural index"))?;
        let mut actual_end = tag_end;
        while actual_end > lt + 1 && is_ws(self.input[actual_end - 1]) {
            actual_end -= 1;
        }
        let self_closing = actual_end > lt + 1 && self.input[actual_end - 1] == b'/';
        if self_closing {
            actual_end -= 1;
            while actual_end > lt + 1 && is_ws(self.input[actual_end - 1]) {
                actual_end -= 1;
            }
        }

        let name_start = lt + 1;
        let mut name_end = name_start;
        while name_end < actual_end && !is_ws(self.input[name_end]) && self.input[name_end] != b'/'
        {
            name_end += 1;
        }
        if name_end == name_start {
            return Err(error("Missing start tag name in XPath structural index"));
        }

        let parent = self.parent_stack.last().copied().unwrap_or(NO_INDEX);
        let depth = self.parent_stack.len() as u16;
        let attr_start = self.index.attrs.len();
        parse_attr_spans(self.input, name_end, actual_end, &mut self.index.attrs)?;
        let attr_count = self.index.attrs.len() - attr_start;
        let tag_type = if self_closing {
            TagType::SelfClose
        } else {
            TagType::Open
        };
        let tag_idx = self.push_tag(PushTagArgs {
            start: lt,
            end: tag_end,
            tag_type,
            name_start,
            name_end,
            depth,
            parent,
            attr_start,
            attr_count,
        })?;
        if tag_type == TagType::Open {
            self.parent_stack.push(tag_idx);
        }
        self.last_tag_end = Some(tag_end);
        Ok(tag_end + 1)
    }

    fn parse_comment(&mut self, lt: usize) -> Result<usize> {
        let end = find_sequence(self.input, b"-->", lt + 4)
            .map(|start| start + 2)
            .ok_or_else(|| error("Unclosed comment in XPath structural index"))?;
        self.push_tag_without_attrs(lt, end, TagType::Comment, 0, 0)?;
        self.last_tag_end = Some(end);
        Ok(end + 1)
    }

    fn parse_cdata(&mut self, lt: usize) -> Result<usize> {
        let content_start = lt + 9;
        let close_start = find_sequence(self.input, b"]]>", content_start)
            .ok_or_else(|| error("Unclosed CDATA in XPath structural index"))?;
        if content_start < close_start {
            self.index.text_ranges.push(TextRange {
                start: content_start as u64,
                end: close_start as u64,
                parent_tag: self.parent_stack.last().copied().unwrap_or(NO_INDEX),
            });
        }
        let end = close_start + 2;
        self.push_tag_without_attrs(lt, end, TagType::CData, 0, 0)?;
        self.last_tag_end = Some(end);
        Ok(end + 1)
    }

    fn parse_pi(&mut self, lt: usize) -> Result<usize> {
        let name_start = lt + 2;
        let mut name_end = name_start;
        while name_end < self.input.len()
            && self.input[name_end] != b'?'
            && self.input[name_end] != b'>'
            && !is_ws(self.input[name_end])
        {
            name_end += 1;
        }
        let close_start = find_sequence(self.input, b"?>", name_end)
            .ok_or_else(|| error("Unclosed processing instruction in XPath structural index"))?;
        let end = close_start + 1;
        self.push_tag_without_attrs(lt, end, TagType::Pi, name_start, name_end)?;
        self.last_tag_end = Some(end);
        Ok(end + 1)
    }

    fn parse_doctype_or_decl(&mut self, lt: usize) -> Result<usize> {
        let end = find_tag_end(self.input, lt + 1)
            .ok_or_else(|| error("Unclosed declaration in XPath structural index"))?;
        self.last_tag_end = Some(end);
        Ok(end + 1)
    }

    fn push_tag_without_attrs(
        &mut self,
        start: usize,
        end: usize,
        tag_type: TagType,
        name_start: usize,
        name_end: usize,
    ) -> Result<u32> {
        let parent = self.parent_stack.last().copied().unwrap_or(NO_INDEX);
        let depth = self.parent_stack.len() as u16;
        self.push_tag(PushTagArgs {
            start,
            end,
            tag_type,
            name_start,
            name_end,
            depth,
            parent,
            attr_start: 0,
            attr_count: 0,
        })
    }

    fn push_tag(&mut self, tag: PushTagArgs) -> Result<u32> {
        let idx = to_u32(self.index.tag_starts.len(), "XPath structural tag count")?;
        self.index.tag_starts.push(tag.start as u64);
        self.index.tag_ends.push(tag.end as u64);
        self.index.tag_types.push(tag.tag_type);
        self.index.tag_names.push(Span {
            start: tag.name_start as u64,
            end: tag.name_end as u64,
        });
        self.index.depths.push(tag.depth);
        self.index.parents.push(tag.parent);
        self.index
            .attr_starts
            .push(to_u32(tag.attr_start, "XPath structural attr start")?);
        self.index
            .attr_counts
            .push(to_u32(tag.attr_count, "XPath structural attr count")?);
        Ok(idx)
    }
}

struct NameInterner<'a> {
    input: &'a [u8],
    table: Vec<Span>,
}

impl<'a> NameInterner<'a> {
    fn new(input: &'a [u8]) -> Self {
        Self {
            input,
            table: Vec::new(),
        }
    }

    fn intern(&mut self, bytes: &[u8], span: Span) -> u16 {
        for (idx, existing) in self.table.iter().enumerate() {
            if self.input[existing.start as usize..existing.end as usize] == *bytes {
                return idx as u16;
            }
        }
        let idx = self.table.len().min(u16::MAX as usize) as u16;
        self.table.push(span);
        idx
    }

    fn into_table(self) -> Vec<Span> {
        self.table
    }
}

fn build_csr_children(
    tag_types: &[TagType],
    parents: &[u32],
    tag_count: usize,
) -> (Vec<u32>, Vec<u32>) {
    let mut child_counts = vec![0u32; tag_count + 1];
    for idx in 0..tag_count {
        if matches!(tag_types[idx], TagType::Close | TagType::CData) {
            continue;
        }
        let parent = parents[idx];
        if parent != NO_INDEX && (parent as usize) < tag_count {
            child_counts[parent as usize] += 1;
        }
    }

    let mut child_offsets = vec![0u32; tag_count + 1];
    for idx in 0..tag_count {
        child_offsets[idx + 1] = child_offsets[idx] + child_counts[idx];
    }
    let mut child_data = vec![0u32; child_offsets[tag_count] as usize];
    let mut write_pos = child_offsets.clone();
    for idx in 0..tag_count {
        if matches!(tag_types[idx], TagType::Close | TagType::CData) {
            continue;
        }
        let parent = parents[idx];
        if parent != NO_INDEX && (parent as usize) < tag_count {
            let parent_idx = parent as usize;
            child_data[write_pos[parent_idx] as usize] = idx as u32;
            write_pos[parent_idx] += 1;
        }
    }

    (child_offsets, child_data)
}

fn build_csr_text_children(text_ranges: &[TextRange], tag_count: usize) -> (Vec<u32>, Vec<u32>) {
    let mut text_counts = vec![0u32; tag_count + 1];
    for range in text_ranges {
        if range.parent_tag != NO_INDEX && (range.parent_tag as usize) < tag_count {
            text_counts[range.parent_tag as usize] += 1;
        }
    }

    let mut text_offsets = vec![0u32; tag_count + 1];
    for idx in 0..tag_count {
        text_offsets[idx + 1] = text_offsets[idx] + text_counts[idx];
    }
    let mut text_data = vec![0u32; text_offsets[tag_count] as usize];
    let mut write_pos = text_offsets.clone();
    for (idx, range) in text_ranges.iter().enumerate() {
        if range.parent_tag != NO_INDEX && (range.parent_tag as usize) < tag_count {
            let parent_idx = range.parent_tag as usize;
            text_data[write_pos[parent_idx] as usize] = idx as u32;
            write_pos[parent_idx] += 1;
        }
    }

    (text_offsets, text_data)
}

fn build_close_map_and_post_order(tag_types: &[TagType], tag_count: usize) -> (Vec<u32>, Vec<u32>) {
    let mut close_map = vec![NO_INDEX; tag_count];
    let mut post_order = vec![0u32; tag_count];
    let mut stack = Vec::new();
    let mut post_counter = 0u32;

    for idx in 0..tag_count {
        match tag_types[idx] {
            TagType::Open => stack.push(idx),
            TagType::Close => {
                if let Some(open_idx) = stack.pop() {
                    close_map[open_idx] = idx as u32;
                    post_order[open_idx] = post_counter;
                }
                post_order[idx] = post_counter;
                post_counter += 1;
            }
            TagType::SelfClose | TagType::Comment | TagType::CData | TagType::Pi => {
                if tag_types[idx] == TagType::SelfClose {
                    close_map[idx] = idx as u32;
                }
                post_order[idx] = post_counter;
                post_counter += 1;
            }
        }
    }

    (close_map, post_order)
}

fn parse_attr_spans(
    input: &[u8],
    mut cursor: usize,
    end: usize,
    out: &mut Vec<AttrSpan>,
) -> Result<()> {
    while cursor < end {
        cursor = skip_ws(input, cursor, end);
        if cursor >= end {
            break;
        }

        let name_start = cursor;
        while cursor < end
            && !is_ws(input[cursor])
            && input[cursor] != b'='
            && input[cursor] != b'/'
        {
            cursor += 1;
        }
        let name_end = cursor;
        cursor = skip_ws(input, cursor, end);
        if cursor >= end || input[cursor] != b'=' {
            return Err(error("Malformed attribute in XPath structural index"));
        }
        cursor += 1;
        cursor = skip_ws(input, cursor, end);
        if cursor >= end || (input[cursor] != b'"' && input[cursor] != b'\'') {
            return Err(error(
                "Malformed quoted attribute in XPath structural index",
            ));
        }

        let quote = input[cursor];
        cursor += 1;
        let value_start = cursor;
        while cursor < end && input[cursor] != quote {
            cursor += 1;
        }
        if cursor >= end {
            return Err(error("Unclosed quoted attribute in XPath structural index"));
        }
        let value_end = cursor;
        cursor += 1;

        out.push(AttrSpan {
            name: Span {
                start: name_start as u64,
                end: name_end as u64,
            },
            value: Span {
                start: value_start as u64,
                end: value_end as u64,
            },
        });
    }
    Ok(())
}

fn is_element_tag(tag_type: TagType) -> bool {
    matches!(tag_type, TagType::Open | TagType::SelfClose)
}

fn find_tag_end(input: &[u8], mut cursor: usize) -> Option<usize> {
    let mut quote = None;
    while cursor < input.len() {
        let byte = input[cursor];
        if let Some(active) = quote {
            if byte == active {
                quote = None;
            }
        } else if byte == b'\'' || byte == b'"' {
            quote = Some(byte);
        } else if byte == b'>' {
            return Some(cursor);
        }
        cursor += 1;
    }
    None
}

fn find_byte(input: &[u8], byte: u8, start: usize) -> Option<usize> {
    memchr(byte, &input[start..]).map(|offset| start + offset)
}

fn find_sequence(input: &[u8], needle: &[u8], start: usize) -> Option<usize> {
    input[start..]
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|offset| start + offset)
}

fn skip_ws(input: &[u8], mut cursor: usize, end: usize) -> usize {
    while cursor < end && is_ws(input[cursor]) {
        cursor += 1;
    }
    cursor
}

fn is_ws(byte: u8) -> bool {
    matches!(byte, b' ' | b'\n' | b'\r' | b'\t')
}

fn to_u32(value: usize, label: &str) -> Result<u32> {
    u32::try_from(value).map_err(|_| error(format!("{label} overflow")))
}

fn error(message: impl Into<String>) -> Error {
    Error::from_reason(message.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_simdxml_aligned_tree_arrays() {
        let mut index = parse(br#"<root><a id="1">x</a><b/><a id="2">y</a></root>"#).unwrap();

        assert_eq!(index.tag_count(), 7);
        assert_eq!(index.tag_name(0), "root");
        assert_eq!(index.tag_name(1), "a");
        assert_eq!(index.parents[1], 0);
        assert_eq!(index.parents[3], 0);
        assert_eq!(index.parents[4], 0);
        assert_eq!(index.close_map[0], 6);
        assert_eq!(index.close_map[1], 2);
        assert_eq!(index.close_map[3], 3);
        assert_eq!(index.close_map[4], 5);
        assert!(index.is_ancestor(0, 4));
        assert_eq!(index.get_attribute(1, "id"), Some("1"));
        assert_eq!(index.get_attribute(4, "id"), Some("2"));
        assert_eq!(index.child_tag_slice(0), &[1, 3, 4]);
        assert_eq!(index.child_text_slice(1), &[0]);
        assert_eq!(index.text_content(&index.text_ranges[0]), "x");

        index.build_name_index();
        let a_id = index.name_ids[1] as usize;
        assert_eq!(index.name_posting[a_id], vec![1, 4]);
    }

    #[test]
    fn preserves_whitespace_text_for_xpath_data_model() {
        let index = parse(b"<root> <a/> tail</root>").unwrap();

        assert_eq!(index.text_ranges.len(), 2);
        assert_eq!(index.text_content(&index.text_ranges[0]), " ");
        assert_eq!(index.text_content(&index.text_ranges[1]), " tail");
        assert_eq!(index.text_ranges[0].parent_tag, 0);
        assert_eq!(index.text_ranges[1].parent_tag, 0);
    }

    #[test]
    fn masks_quoted_gt_when_parsing_start_tag() {
        let index =
            parse(br#"<root><item expr="left > right" single='a > b'>ok</item></root>"#).unwrap();

        assert_eq!(index.tag_name(1), "item");
        assert_eq!(index.get_attribute(1, "expr"), Some("left > right"));
        assert_eq!(index.get_attribute(1, "single"), Some("a > b"));
        assert_eq!(index.text_content(&index.text_ranges[0]), "ok");
    }

    #[test]
    fn exposes_namespace_decls_as_zero_copy_attr_spans() {
        let index = parse(br#"<root xmlns="urn:d" xmlns:p="urn:p" p:id="1"/>"#).unwrap();

        assert_eq!(
            index.get_namespace_decls(0),
            vec![("", "urn:d"), ("p", "urn:p")]
        );
        assert_eq!(
            index.get_all_attribute_names(0),
            vec!["xmlns", "xmlns:p", "p:id"]
        );
        assert_eq!(index.get_attribute(0, "p:id"), Some("1"));
    }

    #[test]
    fn rejects_mismatched_tags_before_xpath_eval() {
        let error = parse(b"<root><a></root>").unwrap_err();

        assert!(error.reason.contains("Mismatched end tag"));
    }
}

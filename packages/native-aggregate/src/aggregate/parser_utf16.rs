use super::*;

impl<'a> Utf16Parser<'a> {
    pub(crate) fn parse(&mut self) -> Result<()> {
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

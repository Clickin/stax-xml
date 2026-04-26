use super::*;

pub(crate) struct StructuralMasks {
    pub(crate) lt_bits: Vec<u64>,
    pub(crate) gt_bits: Vec<u64>,
    pub(crate) eq_bits: Vec<u64>,
}

pub(crate) struct BitPositionIter<'a> {
    pub(crate) bits: &'a [u64],
    pub(crate) chunk: usize,
    pub(crate) current: u64,
}

impl<'a> BitPositionIter<'a> {
    pub(crate) fn new(bits: &'a [u64]) -> Self {
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

pub(crate) fn classify_structural_masks(
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

pub(crate) fn classify_structural_masks_auto(input: &[u8], include_eq: bool) -> StructuralMasks {
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

pub(crate) fn classify_structural_masks_avx2_explicit(
    input: &[u8],
    include_eq: bool,
) -> Result<StructuralMasks> {
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("avx2") {
            return Ok(unsafe { classify_structural_masks_avx2(input, include_eq) });
        }
        Err(Error::from_reason(
            "Native SIMD policy avx2 was requested, but AVX2 is not available on this CPU.",
        ))
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

pub(crate) fn classify_structural_masks_sse42_explicit(
    input: &[u8],
    include_eq: bool,
) -> Result<StructuralMasks> {
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("sse4.2") {
            return Ok(unsafe { classify_structural_masks_sse42(input, include_eq) });
        }
        Err(Error::from_reason(
            "Native SIMD policy sse42 was requested, but SSE4.2 is not available on this CPU.",
        ))
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

pub(crate) fn classify_structural_masks_neon_explicit(
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

pub(crate) fn classify_structural_masks_scalar(input: &[u8], include_eq: bool) -> StructuralMasks {
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
pub(crate) fn classify_structural_masks_neon(input: &[u8], include_eq: bool) -> StructuralMasks {
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

        for (offset, byte) in input[remaining_start..len].iter().copied().enumerate() {
            let bit = offset as u32;

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

        for (offset, byte) in input[remaining_start..len].iter().copied().enumerate() {
            let bit = offset as u32;

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

        for (offset, byte) in input[remaining_start..len].iter().copied().enumerate() {
            let bit = offset as u32;

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

pub(crate) fn prefix_xor(mask: u64) -> u64 {
    let mut value = mask;
    value ^= value << 1;
    value ^= value << 2;
    value ^= value << 4;
    value ^= value << 8;
    value ^= value << 16;
    value ^= value << 32;
    value
}

pub(crate) fn mask_up_to(pos: u32) -> u64 {
    if pos >= 63 {
        u64::MAX
    } else {
        (1u64 << (pos + 1)) - 1
    }
}

pub(crate) fn mask_from(pos: u32) -> u64 {
    if pos >= 64 {
        0
    } else {
        !((1u64 << pos) - 1)
    }
}

pub(crate) fn quote_mask(
    dq_mask: u64,
    sq_mask: u64,
    in_dquote: &mut bool,
    in_squote: &mut bool,
) -> u64 {
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
        *in_dquote ^= dq_mask.count_ones() & 1 == 1;
        return quoted;
    }

    if dq_mask == 0 && !*in_dquote {
        let quoted = prefix_xor(sq_mask);
        let quoted = if *in_squote { !quoted } else { quoted };
        *in_squote ^= sq_mask.count_ones() & 1 == 1;
        return quoted;
    }

    quote_mask_slow(dq_mask, sq_mask, in_dquote, in_squote)
}

pub(crate) fn quote_mask_slow(
    dq_mask: u64,
    sq_mask: u64,
    in_dquote: &mut bool,
    in_squote: &mut bool,
) -> u64 {
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

pub(crate) fn count_mask_bits_in_range(bits: &[u64], start: usize, end: usize) -> usize {
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

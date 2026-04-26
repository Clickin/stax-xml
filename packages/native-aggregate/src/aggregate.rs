use memchr::memchr;
#[cfg(not(test))]
use napi_derive::napi;
#[cfg(target_arch = "aarch64")]
use std::arch::aarch64::*;
#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;
use std::mem::MaybeUninit;

use crate::error::{Error, Result};

mod model;
pub(crate) use model::*;

mod api;
pub use api::*;

mod aggregate_parse;
pub(crate) use aggregate_parse::*;

mod span_table;
pub(crate) use span_table::*;

mod projection;
pub(crate) use projection::*;

mod tier_names;
pub(crate) use tier_names::*;

mod parser_utf16;
mod parser_utf8;

mod attributes;
pub(crate) use attributes::*;

mod materialize;
pub(crate) use materialize::*;

mod common;
pub(crate) use common::*;

mod simd_classifier;
pub(crate) use simd_classifier::*;

mod byte_utils;
pub(crate) use byte_utils::*;

#[cfg(test)]
mod tests;

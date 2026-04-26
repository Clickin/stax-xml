#![cfg_attr(not(feature = "napi-bindings"), allow(dead_code, unused_imports))]

mod error;

mod aggregate;
mod xpath_index;

pub use aggregate::*;

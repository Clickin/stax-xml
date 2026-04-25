# @stax-xml/native-wasm32-wasi

WASI WebAssembly acceleration package for `stax-xml`.

This package is installed as an optional dependency by `stax-xml`; import
`stax-xml/runtime` to resolve it after native packages and before JavaScript
fallback.

The package contains the NAPI-RS `wasm32-wasip1-threads` artifact plus the
Node and browser loader stubs generated during the release workflow. Browser
usage requires SharedArrayBuffer support, which means the page must be served
with cross-origin isolation headers.

# Lemons Search Rust Core

## WASM Benchmarks

Benchmarks live in `benches/search_bench.rs` and are implemented with
`wasm-bindgen-test` + `#[wasm_bindgen_bench]`.

They include two benchmark scenarios:

- `search/file-path`: fuzzy search over generated file paths
- `search/file-name`: fuzzy search over generated file names

Run from the workspace root:

```sh
bun run wasm:bench:setup-runner
bun run wasm:bench
```

Or directly from this crate:

```sh
CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUNNER=wasm-bindgen-test-runner cargo bench --target wasm32-unknown-unknown
```

If you see `no tests to run!` or schema mismatch errors, your
`wasm-bindgen-test-runner`/`wasm-bindgen-cli` version does not match the
crate's `wasm-bindgen` version. Install the matching CLI version first:

```sh
cargo install --locked wasm-bindgen-cli --version 0.2.118
```

Benchmarks are configured to run in the default `wasm-bindgen-test` runtime
(typically Node.js). If you intentionally switch to browser mode with
`wasm_bindgen_test_configure!(run_in_browser)`, you will also need a
WebDriver (`chromedriver`, `geckodriver`, etc.).

### Configurable workload

Workload generation is controlled with compile-time environment variables.
Set them before running `cargo bench`:

- `LEMONS_BENCH_CASES` (default: `10000`): number of indexed entries
- `LEMONS_BENCH_QUERIES` (default: `200`): number of generated queries
- `LEMONS_BENCH_PATH_DEPTH` (default: `4`): folder depth for path dataset
- `LEMONS_BENCH_SEGMENT_LEN` (default: `8`): generated token length

Example:

```sh
LEMONS_BENCH_CASES=50000 \
LEMONS_BENCH_QUERIES=500 \
LEMONS_BENCH_PATH_DEPTH=6 \
LEMONS_BENCH_SEGMENT_LEN=10 \
CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUNNER=wasm-bindgen-test-runner \
cargo bench --target wasm32-unknown-unknown
```

## Build output isolation

Benchmark code is isolated in the crate's `benches/` directory and only pulled
in for `cargo bench`. It is not part of the library build used by
`wasm-pack build`, so none of the benchmark data generation code is shipped in
the plugin WASM artifact.
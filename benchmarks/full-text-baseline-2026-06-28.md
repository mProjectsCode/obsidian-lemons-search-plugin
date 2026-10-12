# Full-text search baseline — 2026-06-28

This is the first retained release-mode baseline for the deterministic
full-text workload. It measures the current implementation before the Milestone
3 query-path changes.

## Environment

- Plugin commit: `c133b56` plus the uncommitted full-text plan implementation
- Search-core commit: `04ee0a6` plus the uncommitted full-text plan implementation
- OS: Linux 6.6.87.2 under WSL2, x86-64
- CPU: AMD Ryzen 9 9950X3D, 16 cores / 32 threads
- Rust: `rustc 1.98.0-nightly (cb46fbb8c 2026-06-08)`
- wasm-pack: 0.15.0
- Node.js: 25.8.0
- Target/profile: `wasm32-unknown-unknown`, release
- Command: `make baseline`
- Overrides: none

## Workload and build

| Metric                               |                        Value |
| ------------------------------------ | ---------------------------: |
| Dataset seed                         |                            0 |
| Records                              |                       20,000 |
| Samples per query/update scenario    |                          200 |
| Tokens                               |                      226,668 |
| Unique indexed terms                 |                       20,029 |
| Posting entries                      |                      197,500 |
| Build wall time                      |                    28.043 ms |
| Build throughput                     |            713,178 records/s |
| Token throughput                     |           8,082,733 tokens/s |
| Persistent requested live heap       |              7,597,515 bytes |
| Build peak requested live-heap delta |              7,597,515 bytes |
| Committed linear memory after build  | 12,713,984 bytes (194 pages) |
| Linear-memory growth during build    |  7,667,712 bytes (117 pages) |
| Requested live bytes / record        |                       379.88 |
| Requested live bytes / term          |                       379.33 |
| Requested live bytes / posting entry |                        38.47 |

The three density values normalize the same total index delta by different
denominators; they are comparison ratios, not isolated component sizes.
Requested live heap counts allocation payload sizes. It excludes allocator
metadata and unused space in committed WASM pages.

## Query latency and peak heap

| Scenario           | p50 ms | p95 ms | p99 ms | max ms | Peak live delta bytes |
| ------------------ | -----: | -----: | -----: | -----: | --------------------: |
| exact common       |  1.225 |  1.405 |  1.481 |  1.486 |             1,228,928 |
| exact rare         |  0.201 |  0.227 |  0.266 |  0.278 |               133,274 |
| fuzzy              |  1.581 |  1.692 |  1.788 |  1.806 |             1,229,024 |
| short              |  1.515 |  1.668 |  1.772 |  1.781 |             1,294,432 |
| long               |  3.590 |  3.835 |  3.947 |  4.031 |             1,562,112 |
| multi-atom         |  1.664 |  1.793 |  1.946 |  1.995 |             1,230,080 |
| negative common    |  2.066 |  2.224 |  2.316 |  2.360 |             1,229,104 |
| no match           |  0.203 |  0.227 |  0.248 |  0.266 |               133,192 |
| incremental typing |  1.563 |  1.713 |  1.860 |  1.861 |             1,294,432 |

## Update latency and peak heap

| Scenario | Tokens | p50 ms | p95 ms | p99 ms | max ms | Peak live delta bytes |
| -------- | -----: | -----: | -----: | -----: | -----: | --------------------: |
| small    |     32 |  0.007 |  0.007 |  0.018 |  0.146 |                   898 |
| medium   |    256 |  0.021 |  0.022 |  0.051 |  0.055 |                 5,852 |
| large    |  2,048 |  0.130 |  0.144 |  0.157 |  0.158 |                46,620 |

After all scenarios the process reported 10,641,152 requested live bytes and
14,614,528 committed linear-memory bytes (223 pages). The final live value is
not an index-size measurement because the benchmark intentionally retains its
dataset, engine, sessions, timing buffers, and replacement content.

## Initial targets

On this named environment and workload, correctness-preserving changes must
stay within these regression budgets:

- bulk build: at most 34 ms, 8,000,000 persistent requested bytes, and
  13,631,488 committed bytes (208 pages) after build;
- query p95: 1.7 ms exact-common, 0.28 ms exact-rare, 2.1 ms fuzzy, 2.1 ms
  short, 4.7 ms long, 2.2 ms multi-atom, 2.7 ms negative-common, 0.28 ms
  no-match, and 2.1 ms incremental-typing;
- update p95: 0.02 ms small, 0.04 ms medium, and 0.18 ms large;
- query peak requested live-heap delta: at most 1,600,000 bytes for every
  matching scenario and 170,000 bytes for exact-rare/no-match.

The latency limits are roughly 20–25% above this single baseline to absorb
normal run-to-run noise. They are regression guardrails, not claims that the
current hot path is fast enough. Milestone 3 should lower fuzzy,
incremental-typing, long-query, and common-negation latency or peak memory while
remaining inside all other budgets.

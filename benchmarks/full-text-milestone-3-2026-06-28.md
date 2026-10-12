# Full-text search Milestone 3 — 2026-06-28

This retained release-mode run measures the completed query-hot-path milestone
against [the initial baseline](full-text-baseline-2026-06-28.md). The environment,
dataset, target, and default workload sizes are unchanged. Command: `make baseline`.

## Workload and build

| Metric                               |         Baseline |      Milestone 3 |
| ------------------------------------ | ---------------: | ---------------: |
| Records                              |           20,000 |           20,000 |
| Tokens                               |          226,668 |          226,668 |
| Unique indexed terms                 |           20,029 |           20,029 |
| Posting entries                      |          197,500 |          197,500 |
| Build wall time                      |        28.043 ms |        32.178 ms |
| Persistent requested live heap       |  7,597,515 bytes |  7,859,707 bytes |
| Build peak requested live-heap delta |  7,597,515 bytes |  7,859,707 bytes |
| Committed linear memory after build  | 12,713,984 bytes | 13,107,200 bytes |
| Requested live bytes / record        |           379.88 |           392.99 |
| Requested live bytes / term          |           379.33 |           392.42 |
| Requested live bytes / posting entry |            38.47 |            39.80 |

The compact vocabulary masks add persistent term metadata, but build time and
both memory measures remain within the baseline regression budgets.

## Query latency and peak heap

| Scenario           | Baseline p95 ms | Milestone 3 p95 ms | Baseline peak bytes | Milestone 3 peak bytes |
| ------------------ | --------------: | -----------------: | ------------------: | ---------------------: |
| exact common       |           1.405 |              1.098 |           1,228,928 |                266,296 |
| exact rare         |           0.227 |              0.031 |             133,274 |                133,320 |
| fuzzy              |           1.692 |              1.409 |           1,229,024 |                266,368 |
| short              |           1.668 |              1.593 |           1,294,432 |                251,222 |
| long               |           3.835 |              2.871 |           1,562,112 |                295,516 |
| multi-atom         |           1.793 |              1.479 |           1,230,080 |                295,424 |
| negative common    |           2.224 |              1.429 |           1,229,104 |                331,960 |
| no match           |           0.227 |              0.129 |             133,192 |                133,228 |
| incremental typing |           1.713 |              1.613 |           1,294,432 |                252,361 |

All query p95 and peak-heap measurements remain within their initial budgets.
The largest peak-heap reductions come from replacing candidate hash tables and
the exclusion hash set with sorted merged vectors.

## Update latency

| Scenario | Baseline p95 ms | Milestone 3 p95 ms |
| -------- | --------------: | -----------------: |
| small    |           0.007 |              0.007 |
| medium   |           0.022 |              0.022 |
| large    |           0.144 |              0.144 |

All update measurements remain within the initial regression budgets.

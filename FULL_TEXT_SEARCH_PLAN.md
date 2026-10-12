# Full-Text Search Improvement Plan

## Goal

Improve full-text search without trading correctness or recall for unmeasured speedups. The priorities, in order, are:

1. Correct and explicitly documented behavior.
2. Deterministic results.
3. Low interactive query latency.
4. Fast rebuilds and incremental updates.
5. Bounded persistent and peak memory use in the worker and WASM heap.

The current implementation is a compact baseline: it uses block-level records, an inverted index with `u32` term and record identifiers, one frequency-bearing posting per document-term pair, BM25/fuzzy scoring, and a bounded result heap. Full note content is hydrated on demand rather than retained as result metadata.

## Scope and code map

The current system design, behavioral contract, invariants, and code map live in [ARCHITECTURE.md](ARCHITECTURE.md). This file tracks proposed changes and their delivery status.

## P0: Correctness and behavioral contract

### Preserve full-text configuration

#### Problem

`FullTextDatastore::clear` resets `fuzzy_search` to `true`, and `begin_bulk_load` calls `clear`. A rebuild therefore silently re-enables fuzzy search.

Initialization also does not send the persisted `fullTextFuzzySearch` setting. Even if it did, `SearchEngine::set_full_text_fuzzy_search` currently updates only existing stores, while built-in stores are created after worker initialization.

#### Change

- Add a `full_text_fuzzy_search` default to `SearchEngine`.
- Update that default and all existing full-text stores in `set_full_text_fuzzy_search`.
- Apply the default when a new full-text datastore is created.
- Make `FullTextDatastore::clear` clear indexed data while preserving configuration.
- Send `fullTextFuzzySearch` alongside `maxResults` during `SearchService.initialize`.
- Test engine configuration before and after store creation, datastore clear, and bulk rebuild.

#### Acceptance criteria

- A persisted `false` value is effective on the first full-text query after startup.
- `clear` and bulk rebuild do not change the setting.
- Stores created after a setting change inherit the current value.

### Define query and ranking semantics

#### Problem

The fuzzy path uses Nucleo's atom parser and matcher. That provides fuzzy subsequence matching; it does not promise general edit-distance handling for substitutions or transpositions. The exact path has its own parsing and case-normalization logic. The current 70% score floor and 50-positive-term cap also make recall intentionally approximate, but that approximation is not part of a documented contract.

Optimization work cannot claim equivalent behavior until the expected behavior is defined.

#### Change

Create a table-driven behavior and relevance corpus covering:

- token boundaries and multi-atom AND semantics;
- negation;
- exact, prefix, substring, and fuzzy syntax in both modes;
- omitted characters, substitutions, and transpositions;
- empty and one-character queries;
- Unicode case conversion, smart-case behavior, normalization, and diacritics;
- the expansion score floor and positive/negative work limits;
- exact-term retention when approximate expansion is bounded;
- BM25/fuzzy ranking and tie-breaking.

Treat any bounded expansion policy as an explicit recall policy. If edit-distance tolerance is required, evaluate it as a separate candidate-generation feature rather than assuming Nucleo already supplies it.

#### Acceptance criteria

- Supported syntax and matching behavior are documented for users and tests.
- The relevance corpus records expected matches and ordering, not only result counts.
- Every later optimization passes the same correctness corpus or has an approved contract change.

### Make top-K selection deterministic

#### Problem

Scores are quantized to `u32`, so ties are common. Candidate iteration comes from randomized hash maps. Heap admission replaces the current worst record only for a strictly greater score, while final sorting uses score followed by external record ID. Consequently, a tied subset can depend on hash iteration when matches exceed `max_results`.

#### Change

- Define one total order for both heap admission and final output: descending score, then ascending external record ID.
- Carry or cheaply clone the record table's `Rc<str>` only for heap entries; do not use `record_idx` as the public tie-break because it depends on insertion and slot-reuse history.
- Compare the complete order when deciding whether to replace the heap root.
- Add cases with more tied matches than `max_results`, varied insertion orders, deletion/slot reuse, and repeated store instances.

#### Acceptance criteria

- The same live record set and query return the same ordered IDs regardless of insertion order or hash seed.
- The selected subset remains stable when tied matches exceed `max_results`.

## P0: Establish representative baselines

### Workloads

The existing benchmark creates only a regular fuzzy datastore and measures search calls. Add independent full-text workloads for:

- cold bulk build;
- incremental replacement of small, medium, and large notes;
- exact, fuzzy, short, long, multi-atom, negative, and no-match queries;
- common-term and rare-term queries;
- incremental typing within one session;
- repeated edit/delete cycles.

Use deterministic generated data with realistic block-size, vocabulary, term-frequency, and note-size distributions. Supplement it with an anonymized distribution summary from a representative vault; do not check note contents into the repository. Keep data generation and index setup outside query timing.

### Measurements

Report:

- dataset seed, records, tokens, unique terms, and actual posting entries;
- build wall time and records/tokens per second;
- update latency;
- query p50, p95, p99, and maximum latency;
- persistent live heap after build;
- peak live heap during build, update, and query;
- WASM linear-memory high-water mark;
- bytes per live record, term, and posting entry.

`posting_occurrences` currently counts token occurrences, not the number of `Posting` structs. Add a separate posting-entry count before using that health value for bytes-per-posting calculations.

WASM `memory.buffer.byteLength` is only the number of committed linear-memory pages and generally does not shrink when allocations are freed. Use allocator instrumentation or another live-allocation counter for live/peak heap measurements, and report linear-memory pages separately.

### Acceptance criteria

- Build, update, and query benchmarks can run independently.
- Output contains enough workload metadata to compare runs.
- A checked-in baseline or retained CI artifact records results for a named environment.
- Timing reports distributions rather than only an average.
- Live heap and WASM linear-memory high-water marks are not conflated.

## P1: Query hot path

### Reduce fuzzy vocabulary expansion

#### Problem

For every atom, fuzzy resolution scans every catalog term with a non-empty posting list and invokes Nucleo. The complexity is `O(atoms × catalog terms)` for every keystroke. The 50-term cap is applied only after that scan, so it bounds posting/scoring work but not expansion latency. Its term-ID tie-break also makes capped recall depend on term insertion order.

#### Staged change

Measure after each stage and stop when the target is met:

1. Add full-text session state for the previous parsed query, pre-cap matches, and scores. Existing mutation hooks must reset it.
2. Reuse an atom's previous candidate set only when the new query is a strict append to that same atom and Nucleo's parsing, case, and normalization modes guarantee monotonic narrowing. Re-score retained candidates because scores can change.
3. Add allocation-free necessary-condition filters before Nucleo, such as normalized character count and a compact character mask. The filter must use the same normalization rules and may produce false positives, never false negatives.
4. Replace the fixed term-count cap with a deterministic budget that bounds downstream posting work. Rank equal candidates by normalized term text, not `term_id`.
5. Always retain an exact term match. Define and test separate policies for short positive and negative atoms.
6. Compact dead catalog terms when a measured threshold is reached; merely skipping empty posting lists still leaves an `O(catalog size)` scan.

Do not add an n-gram or Levenshtein index until the baseline demonstrates that session reuse and cheap filters are insufficient; auxiliary term indexes have a persistent memory cost.

#### Acceptance criteria

- Incremental typing reuses prior expansion work only in proven-safe cases.
- Cache invalidation occurs after every mutation, clear, and rebuild.
- Expansion is stable across equivalent indexes built in different orders.
- Exact matches cannot be displaced by an approximate-match budget.
- Positive and negative short-query costs have tested bounds.
- Dead vocabulary has a measured, bounded reclamation policy.

### Replace per-atom hash maps with sorted posting operations

#### Problem

`score_term_group` first allocates one candidate-score item per expanded posting, then builds a `HashMap` per positive atom. `search` retains every positive map during intersection. Negation creates another global `HashSet`. Peak query memory is therefore proportional to expanded postings plus matching records across all atoms.

Posting lists are already sorted by `record_idx`, so this representation does more allocation and hashing than the query requires.

#### Change

- K-way merge the posting lists for one expanded atom into a compact, sorted `(record_idx, best_atom_score)` vector.
- Preserve current normalization semantics. Because the current score is normalized by maxima observed across an atom's candidates, use a bounded two-pass calculation or retain the compact intermediate values needed for the second pass.
- Intersect positive vectors from the smallest estimated candidate set.
- Merge negative posting streams and check candidates during intersection instead of materializing a global exclusion set when that is cheaper.
- Retain only the intersected candidate vector and the bounded top-K heap after each stage.
- Add reusable session scratch buffers only if profiles show allocation remains significant.

#### Acceptance criteria

- The behavior/relevance corpus is unchanged.
- Query memory is bounded by compact merged/intersected vectors and top-K state, not one hash table per atom.
- Sorted-posting invariants and duplicate-record handling are tested.
- Common fuzzy terms and common negations show measured memory or latency improvement.

## P1: Incremental owner replacement

### Problem

The TypeScript layer already assigns each full-text owner a compact numeric ID, but Rust receives only record IDs and implements owner deletion as a full record-table scan plus cloned IDs. Each deleted record then removes itself independently from each posting vector with `Vec::remove`, repeatedly shifting common posting lists.

### Change

- Add an atomic owner-aware replacement RPC that passes the existing compact owner ID explicitly rather than teaching Rust to parse presentation-level record IDs.
- Store owner membership in Rust as owner-to-record-index associations.
- For one replacement, collect removed record indices and affected term IDs before mutating posting lists.
- Remove all affected records from each posting list in one `retain`/merge pass.
- Compare eager batch removal with lazy tombstones only if eager removal remains too slow. Lazy deletion requires generation-safe record references, a stale-posting counter, and threshold-based compaction; slot reuse must never make an old posting refer to a new record.

### Acceptance criteria

- Replacing one note does not scan or clone all record IDs in the index.
- Each affected posting list is compacted at most once per owner replacement.
- Replacement is atomic from the search engine's perspective.
- Deleted content cannot match after replacement.
- Repeated edits have bounded stale state, memory, and query latency.

## P2: Build and persistent-memory improvements

### Avoid unnecessary bulk-load sorting

After a clear, newly allocated record indices are normally monotonic, so appending postings already produces sorted lists. Repeated IDs or slot reuse can invalidate that property.

- Track whether each bulk posting list remains sorted, or mark a list dirty when an append is not monotonic.
- Sort only dirty lists in `finish_bulk_load`.
- Test duplicate IDs and replacement during bulk loading.
- Benchmark the current token-ID sort/run-length encoding against a reusable small frequency map using observed block sizes.

### Bound worker ingestion memory

`BuiltInSearchIndexer` concurrently reads 500 files, retains their text-derived records, and then sends the batch to the worker. Measure both the main-thread batch and worker/WASM peak.

- Replace the fixed file count with bounded concurrency plus a byte/block budget if measurements show excessive peaks.
- Yield between bounded commits so large vault rebuilds remain responsive.
- Record chosen limits and the representative worst-case note sizes used to set them.

### Reduce vocabulary and posting overhead

Each live term currently owns two UTF-8 strings (`term_to_id` and `FullTextTerm`), one matcher-ready UTF-32 representation, and a separate `Vec<Posting>` header. Each record also duplicates its unique term IDs to support deletion.

Evaluate in this order:

1. Share UTF-8 storage between the lookup map and catalog, for example with `Rc<str>`.
2. Compact/remap terms with empty posting lists at a measured threshold or rebuild boundary.
3. Re-evaluate per-record term vectors after owner-batch deletion exists.
4. Compare the current `Vec<Vec<Posting>>` with a hybrid immutable bulk-built representation plus bounded update deltas. A pure CSR layout is not suitable unless incremental replacement remains efficient.
5. Consider narrower or variable-width term frequencies only after measuring actual maxima and decode cost.
6. Keep eager UTF-32 storage unless measurements show that lazy conversion saves enough memory to offset repeated query cost.

### Acceptance criteria

- UTF-8 term bytes are stored once.
- Dead vocabulary is reclaimed at a documented threshold.
- Normal rebuilds do not sort posting lists already proven sorted.
- Build batching stays within a documented main-thread and worker memory bound.
- Any packed representation improves representative bytes per term/posting without violating update-latency targets.

## Delivery sequence

Status: Milestones 1 through 3 were implemented on 2026-06-28. The first retained
measurement is [benchmarks/full-text-baseline-2026-06-28.md](benchmarks/full-text-baseline-2026-06-28.md),
including regression budgets for the named environment. The retained Milestone
3 comparison is [benchmarks/full-text-milestone-3-2026-06-28.md](benchmarks/full-text-milestone-3-2026-06-28.md).

### Milestone 1: Contract and correctness

- [x] Preserve fuzzy configuration across initialization, clear, and rebuild.
- [x] Define matching, approximation, ranking, and tie semantics.
- [x] Make top-K admission deterministic.
- [x] Add configuration, behavior, relevance, and tie tests.

### Milestone 2: Measurement

- [x] Add independent full-text build, update, and query benchmarks.
- [x] Add posting-entry accounting.
- [x] Add live/peak allocation instrumentation.
- [x] Record the first reproducible baseline and set numeric targets from it.

### Milestone 3: Query hot path

- [x] Add safe incremental expansion state.
- [x] Add cheap vocabulary filters and deterministic work budgets.
- [x] Replace per-atom hash tables with sorted merge/intersection scoring.

### Milestone 4: Update and build hot paths

- Add atomic owner-aware replacement and batched posting removal.
- Skip bulk sorts for lists proven sorted.
- Tune file-read concurrency and batch budgets from peak-memory results.

### Milestone 5: Persistent memory

- Share term string storage and compact dead terms.
- Re-evaluate per-record term vectors and posting storage.
- Add a typo candidate index only if the behavioral contract requires it and measurements justify it.

## Exit criteria

Optimization work is complete when all of the following are true:

- the behavior and relevance corpus passes;
- results are deterministic under the documented total order;
- target workloads meet numeric latency, throughput, and memory budgets established from the baseline;
- repeated edits and rebuilds do not cause unbounded catalog, posting, or session growth;
- improvements are measured without an unreported regression in recall, build time, update time, or memory.

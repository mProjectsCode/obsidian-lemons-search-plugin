use lemons_search::Search;
use std::hint::black_box;
use wasm_bindgen_test::{wasm_bindgen_bench, Criterion};

const DEFAULT_CASES: usize = 20_000;
const DEFAULT_QUERIES: usize = 1_000;
const DEFAULT_PATH_DEPTH: usize = 5;
const DEFAULT_SEGMENT_LEN: usize = 10;

#[derive(Debug, Clone, Copy)]
struct BenchConfig {
    cases: usize,
    queries: usize,
    path_depth: usize,
    segment_len: usize,
}

impl BenchConfig {
    fn from_compile_env() -> Self {
        Self {
            cases: parse_env_usize(option_env!("LEMONS_BENCH_CASES"), DEFAULT_CASES),
            queries: parse_env_usize(option_env!("LEMONS_BENCH_QUERIES"), DEFAULT_QUERIES),
            path_depth: parse_env_usize(option_env!("LEMONS_BENCH_PATH_DEPTH"), DEFAULT_PATH_DEPTH)
                .max(1),
            segment_len: parse_env_usize(
                option_env!("LEMONS_BENCH_SEGMENT_LEN"),
                DEFAULT_SEGMENT_LEN,
            )
            .max(3),
        }
    }
}

fn parse_env_usize(value: Option<&'static str>, default: usize) -> usize {
    value
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(default)
}

#[derive(Clone, Copy)]
enum Mode {
    FilePath,
    FileName,
}

#[derive(Clone, Copy)]
enum QueryScenario {
    Mixed,
    IncrementalTyping,
}

const ROOT_SEGMENTS: &[&str] = &[
    "projects",
    "notes",
    "knowledge",
    "zettelkasten",
    "scratch",
    "archive",
];
const DOMAIN_SEGMENTS: &[&str] = &[
    "engineering",
    "research",
    "writing",
    "finance",
    "product",
    "design",
];
const TOPIC_SEGMENTS: &[&str] = &[
    "rust", "svelte", "obsidian", "wasm", "backend", "frontend", "api", "search",
];
const TITLE_HINTS: &[&str] = &[
    "meeting-notes",
    "design-doc",
    "retrospective",
    "experiment",
    "roadmap",
    "playbook",
];

fn build_dataset(config: BenchConfig, mode: Mode) -> Vec<String> {
    (0..config.cases)
        .map(|i| {
            let root = ROOT_SEGMENTS[i % ROOT_SEGMENTS.len()];
            let domain = DOMAIN_SEGMENTS[(i / 3) % DOMAIN_SEGMENTS.len()];
            let topic = TOPIC_SEGMENTS[(i * 5 + 7) % TOPIC_SEGMENTS.len()];
            let title_hint = TITLE_HINTS[(i * 11 + 13) % TITLE_HINTS.len()];
            let year = 2018 + (i % 9);

            let file_name = format!(
                "{}-{}-{}-{:05}.md",
                title_hint,
                make_token(i, config.segment_len),
                topic,
                i % 100_000
            );

            match mode {
                Mode::FileName => file_name,
                Mode::FilePath => {
                    let mut path =
                        String::with_capacity(config.path_depth * (config.segment_len + 8));
                    path.push_str(root);
                    path.push('/');
                    path.push_str(domain);

                    for depth in 0..config.path_depth {
                        path.push('/');
                        path.push_str(&format!(
                            "{}-{}-{:02}",
                            TOPIC_SEGMENTS[(i + depth) % TOPIC_SEGMENTS.len()],
                            make_token(
                                (i * 17 + depth * 13) % config.cases.max(1),
                                config.segment_len
                            ),
                            depth
                        ));
                    }

                    path.push('/');
                    path.push_str(&year.to_string());
                    path.push('/');
                    path.push_str(&file_name);
                    path
                }
            }
        })
        .collect()
}

fn build_mixed_queries(dataset: &[String], config: BenchConfig) -> Vec<String> {
    let query_count = config.queries.min(dataset.len()).max(1);
    let step = (dataset.len() / query_count).max(1);

    (0..query_count)
        .map(|i| {
            let sample = &dataset[(i * step) % dataset.len()];
            let stem = sample.strip_suffix(".md").unwrap_or(sample);
            let file_token_start = stem.rfind('/').map_or(0, |idx| idx + 1);
            let file_token = &stem[file_token_start..];
            let path_parts: Vec<&str> = stem.split('/').collect();

            match i % 3 {
                // Prefix query to mimic typing.
                0 => {
                    let cut = (file_token.len() / 2).max(3).min(file_token.len());
                    file_token[..cut].to_string()
                }
                // Composite query (path token + file token).
                1 => {
                    let path_token = path_parts
                        .get(path_parts.len().saturating_sub(2))
                        .copied()
                        .unwrap_or(file_token);
                    let token_cut = (file_token.len() / 3).max(3).min(file_token.len());
                    format!("{} {}", path_token, &file_token[..token_cut])
                }
                // Slightly noisy query (drop one middle char).
                _ => {
                    if file_token.len() <= 4 {
                        return file_token.to_string();
                    }

                    let mut chars: Vec<char> = file_token.chars().collect();
                    let remove_at = chars.len() / 2;
                    chars.remove(remove_at);
                    chars.into_iter().collect()
                }
            }
        })
        .collect()
}

fn build_incremental_typing_queries(dataset: &[String], config: BenchConfig) -> Vec<String> {
    let mut queries = Vec::with_capacity(config.queries.max(1));
    let seed_count = (dataset.len() / 300).max(1).min(64);
    let stride = (dataset.len() / seed_count).max(1);

    for i in 0..seed_count {
        if queries.len() >= config.queries {
            break;
        }

        let sample = &dataset[(i * stride) % dataset.len()];
        let stem = sample.strip_suffix(".md").unwrap_or(sample);
        let file_token_start = stem.rfind('/').map_or(0, |idx| idx + 1);
        let file_token = &stem[file_token_start..];
        let max_prefix = file_token.len().min(18);
        let mut prefix_len = 2usize;

        while prefix_len <= max_prefix && queries.len() < config.queries {
            queries.push(file_token[..prefix_len].to_string());
            prefix_len += 1;
        }
    }

    if queries.is_empty() {
        queries.push("a".to_string());
    }

    queries
}

fn build_queries(dataset: &[String], config: BenchConfig, scenario: QueryScenario) -> Vec<String> {
    match scenario {
        QueryScenario::Mixed => build_mixed_queries(dataset, config),
        QueryScenario::IncrementalTyping => build_incremental_typing_queries(dataset, config),
    }
}

fn make_token(index: usize, segment_len: usize) -> String {
    const ALPHABET: &[u8] = b"abcdefghijklmnopqrstuvwxyz";

    let mut token = String::with_capacity(segment_len);
    let mut state = index as u64 * 6364136223846793005u64 + 1442695040888963407u64;

    for _ in 0..segment_len {
        state = state.wrapping_mul(6364136223846793005u64).wrapping_add(1);
        let ch = ALPHABET[(state % ALPHABET.len() as u64) as usize] as char;
        token.push(ch);
    }

    token
}

fn run_search_bench(c: &mut Criterion, mode: Mode, scenario: QueryScenario, label: &str) {
    let config = BenchConfig::from_compile_env();
    let dataset = build_dataset(config, mode);
    let queries = build_queries(&dataset, config, scenario);

    c.bench_function(label, |b| {
        let mut search = Search::new();
        search.update_index(dataset.clone());
        let mut query_idx = 0usize;

        b.iter(|| {
            let query = &queries[query_idx % queries.len()];
            query_idx = query_idx.wrapping_add(1);
            black_box(search.search(query));
        });
    });
}

#[wasm_bindgen_bench]
fn search_file_path_bench(c: &mut Criterion) {
    run_search_bench(c, Mode::FilePath, QueryScenario::Mixed, "search/file-path");
}

#[wasm_bindgen_bench]
fn search_file_name_bench(c: &mut Criterion) {
    run_search_bench(c, Mode::FileName, QueryScenario::Mixed, "search/file-name");
}

#[wasm_bindgen_bench]
fn search_file_path_incremental_typing_bench(c: &mut Criterion) {
    run_search_bench(
        c,
        Mode::FilePath,
        QueryScenario::IncrementalTyping,
        "search/file-path-incremental-typing",
    );
}

#[wasm_bindgen_bench]
fn search_file_name_incremental_typing_bench(c: &mut Criterion) {
    run_search_bench(
        c,
        Mode::FileName,
        QueryScenario::IncrementalTyping,
        "search/file-name-incremental-typing",
    );
}

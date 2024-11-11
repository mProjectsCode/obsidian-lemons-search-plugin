<script lang="ts">
	import { onDestroy } from "svelte";
	import type LemonsSearchPlugin from "../main";
    import { SearchUI } from "../SearchUI";
	import type { SearchResult } from "../searchWorker/SearchWorkerRPCConfig";
	import { mod } from "../utils";

    interface Props {
        search: SearchUI;
        plugin: LemonsSearchPlugin;
        closeSearch: () => void;
    }

    enum PreviewType {
        MARKDOWN,
        TEXT,
        EMPTY_TEXT,
        IMAGE,
        FILE_NOT_FOUND,
        UNSUPPORTED,
        NONE,
    }

    type Preview = {
        type: PreviewType.MARKDOWN;
        content: string;
    } | {
        type: PreviewType.TEXT;
        content: string;
    } | {
        type: PreviewType.EMPTY_TEXT;
    } | {
        type: PreviewType.IMAGE;
        content: string;
    } | {
        type: PreviewType.FILE_NOT_FOUND;
    } | {
        type: PreviewType.UNSUPPORTED;
    } | {
        type: PreviewType.NONE;
    };

    let {
        search,
        plugin,
        closeSearch
    }: Props = $props();

    const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

    let searchString = $state('');
    let selection = $state(0);
    let results: SearchResult[] = $state([]);

    let boundedSelection = $derived(results.length !== 0 ? mod(selection, results.length) : undefined);
    let selectedElement = $derived(boundedSelection !== undefined ? results[boundedSelection] : undefined);
    let preview = $derived.by(async (): Promise<Preview> => {
        if (selectedElement === undefined) {
            return { type: PreviewType.NONE };
        }

        const path = selectedElement.path;

        if (path.endsWith(".md")) {
            const content = await plugin.readFile(path);
            if (content === undefined) {
                return { type: PreviewType.FILE_NOT_FOUND };
            }
            if (content === "") {
                return { type: PreviewType.EMPTY_TEXT };
            }
            return { type: PreviewType.MARKDOWN, content };
        } else if (path.endsWith(".txt")) {
            const content = await plugin.readFile(path);

            if (content === undefined) {
                return { type: PreviewType.FILE_NOT_FOUND };
            }
            if (content === "") {
                return { type: PreviewType.EMPTY_TEXT };
            }
            return { type: PreviewType.TEXT, content };
        } else if (IMAGE_EXTENSIONS.some(ext => path.endsWith(ext))) {
            const content = plugin.getResourcePath(path);

            if (content === undefined) {
                return { type: PreviewType.FILE_NOT_FOUND };
            }
            return { type: PreviewType.IMAGE, content };
        } else {
            return { type: PreviewType.UNSUPPORTED };
        }
    });

    $effect(() => {
        search.search(searchString);
        selection = 0;
    });

    let interval = window.setInterval(() => {
        if (search.hasResults()) {
            results = search.getResults();
        }
    }, 50);

    onDestroy(() => {
        window.clearInterval(interval);
    });

    const keybindMap: Record<string, () => void> = {
        "Enter": openSelected,
        "ArrowUp": () => {
            selection = mod(selection - 1, results.length);
        },
        "ArrowDown": () => {
            selection = mod(selection + 1, results.length);
        },
        "Home": () => {
            selection = 0;
        },
        "End": () => {
            selection = -1;
        },
        "Escape": closeSearch,
        "Tab": () => {
            searchString = selectedElement?.path ?? "";
        }
    }

    function onSearchKeyDown(event: KeyboardEvent) {
        const fn = keybindMap[event.key];
        if (fn !== undefined) {
            event.stopImmediatePropagation();
            event.preventDefault();
            fn();
        }
    }

    function openSelected() {
        if (selectedElement !== undefined) {
            plugin.openFile(selectedElement.path);
            closeSearch();
        }
    }

    function onClickSuggestion(index: number) {
        if (index === boundedSelection) {
            openSelected();
        } else {
            selection = index;
        }
    }

    function scrollToSelection(node: HTMLElement, index: number) {
        $effect(() => {
            if (boundedSelection === index) {
                // @ts-ignore
                node.scrollIntoViewIfNeeded(true);
            }
        })
    }
</script>

<div class="lemons-search-wrapper">
    <div class="lemons-search-search">
        <input 
            type="text" 
            placeholder="Search for files..." 
            onkeydown={e => onSearchKeyDown(e)}
            bind:value={searchString} 
        />
        <div class="prompt-results">
            {#each results as result, index}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <div 
                    class="suggestion-item mod-complex" 
                    class:is-selected={boundedSelection === index}
                    use:scrollToSelection={index}
                    onclick={() => onClickSuggestion(index)}
                    role="button"
                >
                    <div class="suggestion-content">
                        <div class="suggestion-title">
                            {#each result.highlights as h}
                                {#if h.highlight}
                                    <span class="suggestion-highlight">{h.text}</span>
                                {:else}
                                    <span>{h.text}</span>
                                {/if}
                            {/each}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
    <div class="lemons-search-preview">
        {#await preview}
            <div class="preview-loading preview-empty">Loading...</div>
        {:then p}
            {#if p.type === PreviewType.MARKDOWN}
                <div class="preview-text">
                    {p.content}
                </div>
            {:else if p.type === PreviewType.TEXT}
                <div class="preview-text">
                    {p.content}
                </div>
            {:else if p.type === PreviewType.EMPTY_TEXT}
                <div class="preview-empty">
                    Empty file...
                </div>
            {:else if p.type === PreviewType.IMAGE}
                <div class="preview-img">
                    <img src={p.content} alt="Preview" />
                </div>
            {:else if p.type === PreviewType.FILE_NOT_FOUND}
                <div class="preview-empty">
                    File not found...
                </div>
            {:else if p.type === PreviewType.UNSUPPORTED}
                <div class="preview-empty">
                    Unsupported file ...$derived
                </div>
            {:else if p.type === PreviewType.NONE}
                <div class="preview-empty">
                    No file selected...
                </div>
            {/if}
        {/await}
    </div>
</div>
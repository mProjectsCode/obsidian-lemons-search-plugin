<script lang="ts">
	import { onDestroy } from "svelte";
	import type LemonsSearchPlugin from "../main";
    import { SearchUI } from "../SearchUI";
	import type { SearchResult } from "../searchWorker/SearchWorkerRPCConfig";
	import { mod } from "../utils";
	import { getPreview, PreviewType, type Preview } from "./Preview";
	import MarkdownRenderer from "./MarkdownRenderer.svelte";

    interface Props {
        search: SearchUI;
        plugin: LemonsSearchPlugin;
        closeSearch: () => void;
    }

    let {
        search,
        plugin,
        closeSearch
    }: Props = $props();

    
    let searchString = $state('');
    let selection = $state(0);
    let results: SearchResult[] = $state([]);

    let boundedSelection = $derived(results.length !== 0 ? mod(selection, results.length) : undefined);
    let selectedElement = $derived(boundedSelection !== undefined ? results[boundedSelection] : undefined);

    let __selectedPath: string | undefined = $state();
    $effect(() => {
        if (selectedElement?.path !== __selectedPath) {
            __selectedPath = selectedElement?.path;
        }
    });
    let preview = $derived(getPreview(__selectedPath, plugin));

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
                    <MarkdownRenderer app={plugin.app} markdown={p.content} sourcePath={selectedElement!.path}></MarkdownRenderer>
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
                    <img src={p.source} alt="Preview" />
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
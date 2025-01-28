<script lang="ts">
	import type LemonsSearchPlugin from "../main";
	import type { NiceSearchResult, SearchData } from "../searchWorker/SearchWorkerRPCConfig";
	import { mod } from "../utils";
	import { getPreview, PreviewType } from "./Preview";
	import MarkdownRenderer from "./MarkdownRenderer.svelte";

    interface Props {
        search: (s: string) => void;
        plugin: LemonsSearchPlugin;
        onCancel: () => void;
        onSubmit: (data: SearchData<string>) => void;
    }

    let {
        search,
        plugin,
        onCancel,
        onSubmit,
    }: Props = $props();

    
    let searchString = $state('');
    let selection = $state(0);
    let results: NiceSearchResult<string>[] = $state([]);

    let boundedSelection = $derived(results.length !== 0 ? mod(selection, results.length) : undefined);
    let selectedElement = $derived(boundedSelection !== undefined ? results[boundedSelection] : undefined);

    let selectedValue: string | undefined = $state();
    $effect(() => {
        if (selectedElement?.data.data !== selectedValue) {
            selectedValue = selectedElement?.data.data;
        }
    });
    let preview = $derived(getPreview(selectedValue, plugin));

    $effect(() => {
        search(searchString);
        selection = 0;
    });

    export function onSearchResults(r: NiceSearchResult<string>[]) {
        results = r;
    }

    const keybindMap: Record<string, () => void> = {
        "Enter": submit,
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
        "Escape": onCancel,
        "Tab": () => {
            searchString = selectedElement?.data.content ?? "";
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

    function submit() {
        if (selectedElement !== undefined) {
            onSubmit(selectedElement.data);
        }
    }

    function onClickSuggestion(index: number) {
        if (index === boundedSelection) {
            submit();
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
                        {#if result.data.subText}
                            <small class="suggestion-sub-text">{result.data.subText}</small>
                        {/if}
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
                    <MarkdownRenderer app={plugin.app} markdown={p.content} sourcePath={selectedValue ?? ""}></MarkdownRenderer>
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
<script lang="ts">
	import type LemonsSearchPlugin from "packages/obsidian/src/main";
	import type { NiceSearchResult, SearchData } from "packages/obsidian/src/searchWorker/SearchWorkerRPCConfig";
	import { getEventModifiers, mod } from "packages/obsidian/src/utils";
	import { getPreview, PreviewType } from "packages/obsidian/src/searchUI/preview/Preview";
	import MarkdownRenderer from "packages/obsidian/src/searchUI/MarkdownRenderer.svelte";
	import { onMount } from "svelte";
	import type { Modifier, Scope } from "obsidian";
	import { registerHotkeys, type HotkeyFunctionMap } from "../../settings/Hotkeys";

    interface Props {
        plugin: LemonsSearchPlugin;
        scope: Scope;
        searchPlaceholder: string;
        search: (s: string) => void;
        onCancel: () => void;
        onSubmit: (data: SearchData<string>, modifiers: Modifier[]) => void;
    }

    let {
        plugin,
        scope,
        searchPlaceholder,
        search,
        onCancel,
        onSubmit,
    }: Props = $props();
    
    let inputEl: HTMLInputElement | undefined;
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

    function submit(modifiers: Modifier[]) {
        if (selectedElement !== undefined) {
            onSubmit(selectedElement.data, modifiers);
        }
    }

    function onClickSuggestion(e: MouseEvent, index: number) {
        if (index === boundedSelection) {
            submit(getEventModifiers(e));
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

    onMount(() => {
        inputEl?.focus();

        const map: HotkeyFunctionMap = new Map();
        map.set("hotkeySearchSelectionUp", () => {
            selection = mod(selection - 1, results.length);
        });
        map.set("hotkeySearchSelectionDown", () => {
            selection = mod(selection + 1, results.length);
        });
        map.set("hotkeySearchSelectionFirst", () => {
            selection = 0;
        });
        map.set("hotkeySearchSelectionLast", () => {
            selection = -1;
        });
        map.set("hotkeySearchFillSelection", () => {
            searchString = selectedElement?.data.content ?? "";
        });
        map.set([{ modifiers: [], key: "Enter" }], (e) => {
            submit(e);
        });
        map.set([{ modifiers: [], key: "Esc" }], (e) => {
            onCancel();
        });

        registerHotkeys(plugin, scope, map);
    });
</script>

<div class="lemons-search lemons-search--preview-search">
    <div class="lemons-search--search">
        <input
            class="prompt-input"
            type="text"
            autocapitalize="off" 
            spellcheck="false" 
            enterkeyhint="done"
            placeholder={searchPlaceholder}
            bind:value={searchString}
            bind:this={inputEl}
        />
        <div class="prompt-results">
            {#each results as result, index}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <div 
                    class="suggestion-item mod-complex" 
                    class:is-selected={boundedSelection === index}
                    use:scrollToSelection={index}
                    onclick={(e) => onClickSuggestion(e, index)}
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
    <div class="lemons-search--preview">
        {#await preview}
            <div class="preview-loading preview-empty">Loading...</div>
        {:then p}
            {#if p.type === PreviewType.MARKDOWN}
                <div class="preview-text markdown-rendered markdown-preview-view">
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
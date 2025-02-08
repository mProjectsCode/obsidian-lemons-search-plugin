<script lang="ts" generics="T">
	import type { Modifier } from "obsidian";
	import type { NiceSearchResult } from "packages/obsidian/src/searchWorker/SearchWorkerRPCConfig";
	import { getEventModifiers, mod } from "packages/obsidian/src/utils";
	import { onMount } from "svelte";
	import { registerHotkeys, type HotkeyFunctionMap } from "../settings/Hotkeys";
	import { processSearchPlaceholderData, type FullSearchUIProps } from "./SearchController";

    let props: FullSearchUIProps<T> = $props();
    
    let inputEl: HTMLInputElement | undefined;
    let searchString = $state('');
    let selection = $state(0);
    let results: NiceSearchResult<T>[] = $state([]);
    let [placeholderData, indexedPlaceholderData] = processSearchPlaceholderData(props.placeholderData);

    let showPlaceholderData = $derived(searchString.length === 0 && indexedPlaceholderData.length > 0);
    let resultLength = $derived.by(() => {
        if (showPlaceholderData) {
            return placeholderData.length;
        } else {
            return results.length;
        }
    });
    let boundedSelection = $derived(results.length !== 0 ? mod(selection, resultLength) : undefined);
    let selectedElement = $derived.by(() => {
        if (boundedSelection === undefined) {
            return undefined;
        }

        if (showPlaceholderData) {
            return placeholderData[boundedSelection];
        } else {
            return results[boundedSelection];
        }
    });

    $effect(() => {
        props.search(searchString);
        selection = 0;
    });

    let selectedValue: T | undefined = $state();
    $effect(() => {
        if (selectedElement?.data !== selectedValue) {
            selectedValue = selectedElement?.data;
        }
    });
    $effect(() => {
        props.onSelectedElementChange?.(selectedValue);
    });

    export function onSearchResults(r: NiceSearchResult<T>[]) {
        results = r;
    }

    function submit(modifiers: Modifier[]) {
        if (selectedElement !== undefined) {
            props.onSubmit(selectedElement, modifiers);
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
        console.log(placeholderData, indexedPlaceholderData);
        

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
            searchString = selectedElement?.content ?? "";
        });
        map.set([{ modifiers: [], key: "Enter" }], (e) => {
            submit(e);
        });
        map.set([{ modifiers: [], key: "Esc" }], (e) => {
            props.onCancel();
        });

        registerHotkeys(props.plugin, props.scope, map);
    });
</script>

<div class={props.cssClasses}>
    <div class="prompt-input-container">
        <input 
            class="prompt-input" 
            type="text" 
            autocapitalize="off" 
            spellcheck="false" 
            enterkeyhint="done"  
            placeholder={props.searchPlaceholder}
            bind:value={searchString}
            bind:this={inputEl}
        >
        <div class="prompt-input-cta"></div>
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="search-input-clear-button" onclick={() => searchString = ""} role="button"></div>
    </div>
    <div class="prompt-results">
        {#if showPlaceholderData}
            {#each indexedPlaceholderData as indexedPlaceholder}
                <div class="lemons-search--suggestion-group-header">
                    <strong>{indexedPlaceholder.title}</strong>
                </div>
                {#each indexedPlaceholder.data as d}
                    {@const [index, data] = d}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_interactive_supports_focus -->
                    <div 
                        class="suggestion-item mod-simple"
                        class:is-selected={boundedSelection === index}
                        onclick={(e) => submit(getEventModifiers(e))}
                        onmouseenter={() => selection = index}
                        use:scrollToSelection={index}
                        role="button"
                    >
                        <div class="suggestion-content">
                            <div class="suggestion-title">
                                {data.content}
                            </div>
                        </div>
                    </div>
                {:else}
                    <div class="lemons-search--suggestion-empty">
                        <small>Empty</small>
                    </div>
                {/each}
            {/each}
        {:else}
            {#each results as result, index}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <div 
                    class="suggestion-item mod-complex"
                    class:is-selected={boundedSelection === index}
                    onclick={(e) => submit(getEventModifiers(e))}
                    onmouseenter={() => selection = index}
                    use:scrollToSelection={index}
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
                        {#if result.subText}
                            <small class="suggestion-sub-text">{result.subText}</small>
                        {/if}
                    </div>
                    {#if result.keys && result.keys.length > 0}
                        <div class="suggestion-aux">
                            {#each result.keys as key}
                                <kbd class="suggestion-hotkey">{key}</kbd>
                            {/each}
                        </div>
                    {/if}
                </div>
            {:else}
                <div class="lemons-search--suggestion-empty">
                    <small>No results found</small>
                </div>
            {/each}
        {/if}

    </div>
</div>
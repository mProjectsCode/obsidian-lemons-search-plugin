<script lang="ts" generics="T">
	import type { Modifier } from "obsidian";
	import type { SearchResultDatum } from "packages/obsidian/src/searchUI/SearchController";
	import { onMount, untrack } from "svelte";
	import { indexSearchPlaceholderData, type FullSearchUIProps } from "./SearchController";
	import SuggestionContentComponent from "./SuggestionContentComponent.svelte";
	import type { HotkeyFunctionMap } from "../utils/Hotkeys";
	import { mod } from "../utils/utils";

    let props: FullSearchUIProps<T> = $props();
    
    let inputEl: HTMLInputElement | undefined;
    let searchString = $state('');
    let selection = $state(0);
    let results: SearchResultDatum<T>[] = $state([]);
    let [placeholderData, indexedPlaceholderData] = indexSearchPlaceholderData(props.placeholderData);

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
        const selected = selectedElement?.data;
        untrack(() => {
            if (selected !== selectedValue) {
                selectedValue = selected;
            }
        });
    });
    $effect(() => {
        props.onSelectedElementChange?.(selectedValue);
    });

    export function onSearchResults(r: SearchResultDatum<T>[]) {
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
        map.set([{ modifiers: [], key: "Enter" }], (m) => {
            submit(m);
        });
        map.set([{ modifiers: [], key: "Esc" }], () => {
            props.onCancel();
        });

        props.plugin.hotkeyHelper.registerHotkeysToScope(props.scope, map);
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
            placeholder={props.prompt}
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
                {#each indexedPlaceholder.data as datum}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_interactive_supports_focus -->
                    <div 
                        class="suggestion-item mod-complex"
                        class:is-selected={boundedSelection === datum.index}
                        onclick={(e) => submit(props.plugin.hotkeyHelper.getEventModifiers(e))}
                        onmouseenter={() => selection = datum.index}
                        use:scrollToSelection={datum.index}
                        role="button"
                    >
                        <SuggestionContentComponent datum={datum.d}></SuggestionContentComponent>
                    </div>
                {:else}
                    <div class="lemons-search--suggestion-empty">
                        <small>Empty</small>
                    </div>
                {/each}
            {/each}
        {:else}
            {#each results as datum, index}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <div 
                    class="suggestion-item mod-complex"
                    class:is-selected={boundedSelection === index}
                    onclick={(e) => submit(props.plugin.hotkeyHelper.getEventModifiers(e))}
                    onmouseenter={() => selection = index}
                    use:scrollToSelection={index}
                    role="button"
                >
                    <SuggestionContentComponent datum={datum}></SuggestionContentComponent>
                </div>
            {:else}
                <div class="lemons-search--suggestion-empty">
                    <small>No results found</small>
                </div>
            {/each}
        {/if}

    </div>
</div>
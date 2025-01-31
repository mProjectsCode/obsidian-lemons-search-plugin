<script lang="ts">
	import type { Modifier, Scope } from "obsidian";
	import type { NiceSearchResult, SearchData } from "packages/obsidian/src/searchWorker/SearchWorkerRPCConfig";
	import { getEventModifiers, mod } from "packages/obsidian/src/utils";
	import { onMount } from "svelte";

    interface Props {
        scope: Scope;
        searchPlaceholder: string;
        search: (s: string) => void;
        onCancel: () => void;
        onSubmit: (data: SearchData<unknown>, modifiers: Modifier[]) => void;
    }

    let {
        scope,
        searchPlaceholder,
        search,
        onCancel,
        onSubmit,
    }: Props = $props();
    
    let inputEl: HTMLInputElement | undefined;
    let searchString = $state('');
    let selection = $state(0);
    let results: NiceSearchResult<unknown>[] = $state([]);

    let boundedSelection = $derived(results.length !== 0 ? mod(selection, results.length) : undefined);
    let selectedElement = $derived(boundedSelection !== undefined ? results[boundedSelection] : undefined);

    $effect(() => {
        search(searchString);
        selection = 0;
    });

    export function onSearchResults(r: NiceSearchResult<unknown>[]) {
        results = r;
    }

    function submit(modifiers: Modifier[]) {
        if (selectedElement !== undefined) {
            onSubmit(selectedElement.data, modifiers);
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
        
        scope.register(null, "Enter", (e) => {
            e.stopPropagation();
            e.preventDefault();

            submit(getEventModifiers(e));
        });
        scope.register(null, "ArrowUp", (e) => {
            e.stopPropagation();
            e.preventDefault();

            selection = mod(selection - 1, results.length);
        });
        scope.register(null, "ArrowDown", (e) => {
            e.stopPropagation();
            e.preventDefault();

            selection = mod(selection + 1, results.length);
        });
        scope.register(null, "Home", (e) => {
            e.stopPropagation();
            e.preventDefault();

            selection = 0;
        });
        scope.register(null, "End", (e) => {
            e.stopPropagation();
            e.preventDefault();

            selection = -1;
        });
        scope.register(null, "Escape", (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            onCancel();
        });
        scope.register(null, "Tab", (e) => {
            e.stopPropagation();
            e.preventDefault();

            searchString = selectedElement?.data.content ?? "";
        });
    });
</script>

<div class="prompt lemons-search">
    <div class="prompt-input-container">
        <input 
            class="prompt-input" 
            type="text" 
            autocapitalize="off" 
            spellcheck="false" 
            enterkeyhint="done"  
            placeholder={searchPlaceholder}
            bind:value={searchString}
            bind:this={inputEl}
        >
        <div class="prompt-input-cta"></div>
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="search-input-clear-button" onclick={() => searchString = ""} role="button"></div>
    </div>
    <div class="prompt-results">
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
                    {#if result.data.subText}
                        <small class="suggestion-sub-text">{result.data.subText}</small>
                    {/if}
                </div>
                {#if result.data.keys && result.data.keys.length > 0}
                    <div class="suggestion-aux">
                        {#each result.data.keys as key}
                            <kbd class="suggestion-hotkey">{key}</kbd>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>
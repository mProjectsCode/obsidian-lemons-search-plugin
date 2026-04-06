<script lang="ts" generics="T">
	import type { Modifier } from "obsidian";
	import type { SearchResultDatum } from "packages/obsidian/src/searchUI/SearchController";
	import { onMount, untrack } from "svelte";
	import { IndexedPlaceholderCategories, type FullSearchUIProps } from "./SearchController";
	import SuggestionContentComponent from "./SuggestionContentComponent.svelte";
	import type { HotkeyFunctionMap } from "../utils/Hotkeys";
	import { mod } from "../utils/utils";

    let props: FullSearchUIProps<T> = $props();
    
    let inputEl: HTMLInputElement | undefined;
    let searchString = $state('');
    let keyboardSelection = $state(0);
    let mouseSelection = $state<number | undefined>(undefined);
    let results: SearchResultDatum<T>[] = $state([]);
    let placeholderData = new IndexedPlaceholderCategories(props.placeholderData);

    let showPlaceholderData = $derived(searchString.length === 0 && placeholderData.hasData());
    let resultLength = $derived.by(() => {
        if (showPlaceholderData) {
            return placeholderData.totalDataCount();
        } else {
            return results.length;
        }
    });
    let boundedKeyboardSelection = $derived(resultLength > 0 ? mod(keyboardSelection, resultLength) : undefined);
    let boundedMouseSelection = $derived.by(() => {
        if (mouseSelection === undefined || resultLength === 0) {
            return undefined;
        }

        if (mouseSelection < 0 || mouseSelection >= resultLength) {
            return undefined;
        }

        return mouseSelection;
    });
    let activeSelection = $derived(boundedMouseSelection ?? boundedKeyboardSelection);
    function getElementForIndex(index: number | undefined): SearchResultDatum<T> | undefined {
        if (index === undefined) {
            return undefined;
        }

        if (showPlaceholderData) {
            return placeholderData.get(index);
        }

        return results[index];
    }
    let keyboardSelectedElement = $derived(getElementForIndex(boundedKeyboardSelection));
    let selectedElement = $derived(getElementForIndex(activeSelection));

    function clearMouseSelection(): void {
        mouseSelection = undefined;
    }

    function moveKeyboardSelectionBy(delta: number): void {
        if (resultLength === 0) {
            return;
        }
        keyboardSelection = mod(keyboardSelection + delta, resultLength);
        clearMouseSelection();
    }

    function setKeyboardSelection(index: number): void {
        if (resultLength === 0) {
            return;
        }
        keyboardSelection = index;
        clearMouseSelection();
    }

    $effect(() => {
        props.search(searchString);
        clearMouseSelection();
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
        const previouslySelectedData = keyboardSelectedElement?.data;
        results = r;
        clearMouseSelection();

        if (r.length === 0) {
            keyboardSelection = 0;
            return;
        }

        if (previouslySelectedData !== undefined) {
            const preservedIndex = r.findIndex(datum => datum.data === previouslySelectedData);
            if (preservedIndex !== -1) {
                keyboardSelection = preservedIndex;
                return;
            }
        }

        keyboardSelection = mod(keyboardSelection, r.length);
    }

    function submitSelection(modifiers: Modifier[]) {
        if (selectedElement !== undefined) {
            props.onSubmit(selectedElement, modifiers);
        }
    }

    function scrollToSelection(node: HTMLElement, index: number) {
        $effect(() => {
            if (boundedKeyboardSelection === index) {
                // @ts-ignore
                node.scrollIntoViewIfNeeded(true);
            }
        })
    }

    function keepInputFocusOnPointerDown(event: PointerEvent): void {
        event.preventDefault();
        inputEl?.focus();
    }

    onMount(() => {
        inputEl?.focus();

        const map: HotkeyFunctionMap = new Map();
        map.set("hotkeySearchSelectionUp", () => moveKeyboardSelectionBy(-1));
        map.set("hotkeySearchSelectionDown", () => moveKeyboardSelectionBy(1));
        map.set("hotkeySearchSelectionFirst", () => setKeyboardSelection(0));
        map.set("hotkeySearchSelectionLast", () => setKeyboardSelection(resultLength - 1));
        map.set("hotkeySearchFillSelection", () => {
            searchString = selectedElement?.content ?? "";
        });
        map.set([{ modifiers: [], key: "Enter" }], (m) => {
            submitSelection(m);
        });
        map.set([{ modifiers: [], key: "Esc" }], () => {
            props.onCancel();
        });

        props.plugin.hotkeyHelper.registerHotkeysToScope(props.scope, map);
    });

    function submitDatum(datum: SearchResultDatum<T>, modifiers: Modifier[]): void {
        props.onSubmit(datum, modifiers);
    }
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
        <div
            class="search-input-clear-button"
            onpointerdown={keepInputFocusOnPointerDown}
            onclick={() => searchString = ""}
            role="button"
        ></div>
    </div>
    <div class="prompt-results">
        {#if showPlaceholderData}
            {#each placeholderData.categories as placeholderCategory}
                <div class="lemons-search--suggestion-group-header">
                    <strong>{placeholderCategory.title}</strong>
                </div>
                {#each placeholderData.getDataForCategory(placeholderCategory) as datum, i}
                    {@const index = i + placeholderCategory.startIndex}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_interactive_supports_focus -->
                    <div 
                        class="suggestion-item mod-complex"
                        class:is-selected={boundedKeyboardSelection === index || boundedMouseSelection === index}
                        class:is-keyboard-selected={boundedKeyboardSelection === index}
                        class:is-mouse-selected={boundedMouseSelection === index}
                        onpointerdown={keepInputFocusOnPointerDown}
                        onclick={(e) => submitDatum(datum, props.plugin.hotkeyHelper.getEventModifiers(e))}
                        onmouseenter={() => mouseSelection = index}
                        onmouseleave={() => mouseSelection = undefined}
                        use:scrollToSelection={index}
                        role="button"
                    >
                        <SuggestionContentComponent datum={datum}></SuggestionContentComponent>
                    </div>
                {:else}
                    <div class="lemons-search--suggestion-empty">
                        <small>Empty</small>
                    </div>
                {/each}
            {/each}
        {:else}
            {#each results as datum, index (index)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <div 
                    class="suggestion-item mod-complex"
                    class:is-selected={boundedKeyboardSelection === index || boundedMouseSelection === index}
                    class:is-keyboard-selected={boundedKeyboardSelection === index}
                    class:is-mouse-selected={boundedMouseSelection === index}
                    onpointerdown={keepInputFocusOnPointerDown}
                    onclick={(e) => submitDatum(datum, props.plugin.hotkeyHelper.getEventModifiers(e))}
                    onmouseenter={() => mouseSelection = index}
                    onmouseleave={() => mouseSelection = undefined}
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
<script lang="ts">
	import type { Modifier } from "obsidian";
	import MarkdownRenderer from "packages/obsidian/src/searchUI/MarkdownRenderer.svelte";
	import type { FullSearchUIProps, SearchResultDatum } from "packages/obsidian/src/searchUI/SearchController";
	import { highlightTextFromRanges } from "packages/obsidian/src/searchUI/highlight";
	import { highlightedSnippetFromRanges } from "packages/obsidian/src/searchUI/highlightSnippet";
	import type { FullTextBlockMeta } from "packages/obsidian/src/searchWorker/FullTextBlocks";
	import type { HotkeyFunctionMap } from "packages/obsidian/src/utils/Hotkeys";
	import { mod } from "packages/obsidian/src/utils/utils";
	import { onMount, untrack } from "svelte";

	const MARKDOWN_BLOCK_TYPES = new Set(["paragraph", "heading", "list", "blockquote", "table", "callout"]);

	let props: FullSearchUIProps<FullTextBlockMeta> = $props();

	let inputEl: HTMLInputElement | undefined;
	let searchString = $state("");
	let keyboardSelection = $state(0);
	let mouseSelection = $state<number | undefined>(undefined);
	let results: SearchResultDatum<FullTextBlockMeta>[] = $state([]);

	let resultLength = $derived(results.length);
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
	let selectedDatum = $derived(activeSelection === undefined ? undefined : results[activeSelection]);
	let selectedValue: FullTextBlockMeta | undefined = $state();
	let previewSourcePath = $derived(selectedDatum?.data.filePath ?? "");
	let blockLabel = $derived(selectedDatum?.data.blockType ? selectedDatum.data.blockType.replace("-", " ") : "block");
	let renderSelectedAsMarkdown = $derived(shouldRenderAsMarkdown(selectedDatum?.data.blockType));
	let selectedTextHighlights = $derived(selectedDatum ? highlightTextFromRanges(selectedDatum.content, selectedDatum.highlightRanges) : []);

	$effect(() => {
		props.search(searchString);
		clearMouseSelection();
	});

	$effect(() => {
		const selected = selectedDatum?.data;
		untrack(() => {
			if (selected !== selectedValue) {
				selectedValue = selected;
			}
		});
	});

	$effect(() => {
		props.onSelectedElementChange?.(selectedValue);
	});

	export function onSearchResults(r: SearchResultDatum<FullTextBlockMeta>[]) {
		results = r;
		clearMouseSelection();
		keyboardSelection = 0;
	}

	function shouldRenderAsMarkdown(blockType: string | undefined): boolean {
		return blockType === undefined || MARKDOWN_BLOCK_TYPES.has(blockType);
	}

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

	function submitSelection(modifiers: Modifier[]): void {
		if (selectedDatum !== undefined) {
			props.onSubmit(selectedDatum, modifiers);
		}
	}

	function submitDatum(datum: SearchResultDatum<FullTextBlockMeta>, modifiers: Modifier[]): void {
		props.onSubmit(datum, modifiers);
	}

	function keepInputFocusOnPointerDown(event: PointerEvent): void {
		event.preventDefault();
		inputEl?.focus();
	}

	function scrollToSelection(node: HTMLElement, index: number) {
		$effect(() => {
			if (boundedKeyboardSelection === index) {
				// @ts-ignore
				node.scrollIntoViewIfNeeded(true);
			}
		});
	}

	onMount(() => {
		inputEl?.focus();

		const map: HotkeyFunctionMap = new Map();
		map.set("hotkeySearchSelectionUp", () => moveKeyboardSelectionBy(-1));
		map.set("hotkeySearchSelectionDown", () => moveKeyboardSelectionBy(1));
		map.set("hotkeySearchSelectionFirst", () => setKeyboardSelection(0));
		map.set("hotkeySearchSelectionLast", () => setKeyboardSelection(resultLength - 1));
		map.set("hotkeySearchFillSelection", () => {
			searchString = selectedDatum?.content ?? "";
		});
		map.set([{ modifiers: [], key: "Enter" }], (m) => {
			submitSelection(m);
		});
		map.set([{ modifiers: [], key: "Esc" }], () => {
			props.onCancel();
		});

		props.plugin.hotkeyHelper.registerHotkeysToScope(props.scope, map);
	});
</script>

<div class="lemons-search lemons-search--full-text-search">
	<div class="lemons-search--search">
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
			{#each results as datum, index (index)}
				{@const snippet = highlightedSnippetFromRanges(datum.content, datum.highlightRanges)}
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
					<div class="suggestion-content">
						<div class="suggestion-title lemons-search--full-text-snippet">
							{#each snippet as segment}
								{#if segment.h}
									<span class="suggestion-highlight">{segment.t}</span>
								{:else}
									<span>{segment.t}</span>
								{/if}
							{/each}
						</div>
						<small class="suggestion-sub-text">{datum.data.filePath}</small>
					</div>
				</div>
			{:else}
				<div class="lemons-search--suggestion-empty">
					<small>No results found</small>
				</div>
			{/each}
		</div>
	</div>
	<div class="lemons-search--full-text-preview lemons-search--result-preview">
		<div class="lemons-search--full-text-preview-header lemons-search--result-preview-header">
			<div class="lemons-search--full-text-preview-path lemons-search--result-preview-path">
				{selectedDatum ? selectedDatum.data.filePath : "No file selected"}
			</div>
			<div class="lemons-search--full-text-preview-type lemons-search--result-preview-type">{selectedDatum ? blockLabel : "N/A"}</div>
		</div>
		{#if selectedDatum}
			{#if renderSelectedAsMarkdown}
				<div class="lemons-search--full-text-preview-body lemons-search--result-preview-body markdown-rendered markdown-preview-view">
					<MarkdownRenderer
						app={props.plugin.app}
						markdown={selectedDatum.content}
						sourcePath={previewSourcePath}
						inert={true}
					></MarkdownRenderer>
				</div>
			{:else}
				<div class="lemons-search--full-text-preview-body lemons-search--result-preview-body lemons-search--result-preview-plain">
					{#each selectedTextHighlights as segment}
						{#if segment.h}
							<span class="suggestion-highlight">{segment.t}</span>
						{:else}
							<span>{segment.t}</span>
						{/if}
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

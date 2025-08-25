<script lang="ts">
	import { getPreview, PreviewType } from "packages/obsidian/src/searchUI/preview/Preview";
	import MarkdownRenderer from "packages/obsidian/src/searchUI/MarkdownRenderer.svelte";
	import type { FullSearchUIProps, SearchResultDatum } from "../SearchController";
	import SearchComponent from "../SearchComponent.svelte";
	import type { TFile } from "obsidian";

    let props: FullSearchUIProps<TFile> = $props();

    let selectedValue: TFile | undefined = $state();
    
    let preview = $derived(getPreview(selectedValue, props.plugin));
    let search: ReturnType<typeof SearchComponent<TFile>> | undefined;

    export function onSearchResults(r: SearchResultDatum<TFile>[]) {
        search?.onSearchResults(r);
    }
</script>

<div class="lemons-search lemons-search--preview-search">
    <SearchComponent 
        bind:this={search} 
        cssClasses="lemons-search--search" 
        onSelectedElementChange={(e) => selectedValue = e}
        {...props} 
    ></SearchComponent>
    <div class="lemons-search--preview">
        {#await preview}
            <div class="preview-loading preview-empty">Loading...</div>
        {:then p}
            {#if p.type === PreviewType.MARKDOWN}
                <div class="preview-text markdown-rendered markdown-preview-view">
                    <MarkdownRenderer 
                        app={props.plugin.app} 
                        markdown={p.content} 
                        sourcePath={selectedValue?.path ?? ""} 
                        inert={true}
                    ></MarkdownRenderer>
                </div>
            {:else if p.type === PreviewType.TEXT}
                <div class="preview-text">
                    {p.content}
                </div>
            {:else if p.type === PreviewType.EMPTY_TEXT}
                <div class="preview-empty">
                    Empty file
                </div>
            {:else if p.type === PreviewType.IMAGE}
                <div class="preview-img">
                    <img src={p.source} alt="Preview" />
                </div>
            {:else if p.type === PreviewType.FILE_NOT_FOUND}
                <div class="preview-empty">
                    File not found
                </div>
            {:else if p.type === PreviewType.UNSUPPORTED}
                <div class="preview-empty">
                    Unsupported file type
                </div>
            {:else if p.type === PreviewType.NONE}
                <div class="preview-empty">
                    No file selected
                </div>
            {/if}
        {/await}
    </div>
</div>
<script lang="ts" generics="T">
	import type { SearchResultDatum } from './SearchController';

    interface Props {
        datum: SearchResultDatum<T>;
    }

    let { datum }: Props = $props();
</script>

<div class="suggestion-content">
    <div class="suggestion-title">
        {#if datum.highlights}
            {#each datum.highlights as h}
                {#if h.h}
                    <span class="suggestion-highlight">{h.t}</span>
                {:else}
                    <span>{h.t}</span>
                {/if}
            {/each}
        {:else}
            <span>{datum.content}</span>
        {/if}
    </div>
    {#if datum.subText}
        <small class="suggestion-sub-text">{datum.subText}</small>
    {/if}
</div>
{#if datum.hotKeys && datum.hotKeys.length > 0}
    <div class="suggestion-aux">
        {#each datum.hotKeys as key}
            <kbd class="suggestion-hotkey">{key}</kbd>
        {/each}
    </div>
{/if}
<!-- Inspired by https://github.com/marcusolsson/obsidian-svelte -->

<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		name = '',
		description = '',
		heading = false,
		children,
	}: {
		name?: string;
		description?: string;
		heading?: boolean;
		vertical?: boolean;
		children?: Snippet;
	} = $props();
</script>

<div class="setting-item" class:setting-item-heading={heading}>
	<div class="setting-item-info">
		<div class="setting-item-name">{name}</div>
		<div class="setting-item-description">{description}</div>
	</div>
	<div class="setting-item-control">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

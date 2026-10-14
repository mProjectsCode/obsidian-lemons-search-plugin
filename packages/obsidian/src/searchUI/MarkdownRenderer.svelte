<script lang="ts">
	import type { App } from 'obsidian';
	import { Component, MarkdownRenderer } from 'obsidian';
	import { onDestroy, onMount } from 'svelte';

	interface Props {
		markdown: string;
		sourcePath: string;
		app: App;
		inert: boolean;
	}

	let { markdown, sourcePath, app, inert }: Props = $props();

	let component: Component | undefined = undefined;
	let element: HTMLDivElement | undefined = undefined;

	onMount(() => {
		component = new Component();
		component.load();
	});

	onDestroy(() => {
		component?.unload();
	});

	$effect(() => {
		component?.unload();
		(element as { empty(): void } | undefined)?.empty();

		component = new Component();
		component.load();
		void MarkdownRenderer.render(app, markdown, element!, sourcePath, component);
	});
</script>

<div {inert} bind:this={element}></div>

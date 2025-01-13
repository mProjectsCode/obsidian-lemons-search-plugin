<script lang="ts">
	import { App, Component, MarkdownRenderer } from "obsidian";
	import { onDestroy, onMount } from "svelte";

    interface Props {
        markdown: string;
        sourcePath: string;
        app: App;
    }

    let { 
        markdown, 
        sourcePath,
        app
    }: Props = $props();

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
        element?.empty();
        
        component = new Component();
        component.load();
        void MarkdownRenderer.render(app, markdown, element!, sourcePath, component);
    })
</script>

<div bind:this={element}></div>
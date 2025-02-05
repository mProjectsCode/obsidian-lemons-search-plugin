<script lang="ts">
	import { icon } from "../utils";

    const {
        hotkey = '',
        onDelete = () => {},
    }: {
        hotkey?: string;
        onDelete?: () => void;
    } = $props();
</script>

<span class="setting-hotkey" class:mod-empty={hotkey.length === 0}>
    {hotkey || 'Blank'}
    {#if hotkey.length > 0}
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <span class="setting-hotkey-icon setting-delete-hotkey" aria-label="Delete hotkey" use:icon={"x"} onclick={() => onDelete()} role="button"></span>
    {/if}
</span>
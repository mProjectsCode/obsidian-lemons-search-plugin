<script lang="ts">
	import SettingComponent from './SettingComponent.svelte';
	import HotkeyComponent from './HotkeyComponent.svelte';
	import type { Hotkey, KeymapEventHandler, Scope } from 'obsidian';
	import type LemonsSearchPlugin from '../main';
	import { areObjectsEqual, icon } from './utils';

	let {
		plugin,
		name = '',
		description = '',
        hotkeys: _hotkeys,
		defaultHotkeys,
        onUpdate,
		scope,
	}: {
		plugin: LemonsSearchPlugin;
		name?: string;
		description?: string;
        hotkeys: Hotkey[];
		defaultHotkeys?: Hotkey[];
        onUpdate: (hotkeys: Hotkey[]) => void;
		scope: Scope;
	} = $props();

	let recordingHotkey = $state(false);
	let hotkeys = $state(structuredClone(_hotkeys));

	function deleteHotkey(i: number) {
		hotkeys.splice(i, 1);
		onUpdate($state.snapshot(hotkeys));
	}

	function startRecordingHotkey() {
		recordingHotkey = true;

		let listener: KeymapEventHandler | null = null;
		listener = scope.register(null, null, (e, ctx) => {
			e.stopPropagation();
			e.preventDefault();
			const hotkey = plugin.hotkeyHelper.keymapCtxToHotkey(ctx);

			if (hotkey && hotkey.key !== 'Escape') {
				hotkeys.push(hotkey);
				onUpdate($state.snapshot(hotkeys));
			}
			
			recordingHotkey = false;

			if (listener) {
				scope.unregister(listener);
			}
		});
	}

	function resetHotkeys() {
		if (defaultHotkeys) {
			hotkeys = structuredClone(defaultHotkeys);
		}
		onUpdate($state.snapshot(hotkeys));
	}
</script>

<SettingComponent name={name} description={description}>
    <span class="setting-command-hotkeys">
        {#each hotkeys as h, i}
            <HotkeyComponent hotkey={plugin.hotkeyHelper.stringifyHotkey(h)} onDelete={() => deleteHotkey(i)}></HotkeyComponent>
		{:else}
			{#if !recordingHotkey}
				<span class="setting-hotkey mod-empty">Blank</span>
			{/if}
        {/each}
		{#if recordingHotkey}
			<span class="setting-hotkey mod-active">Press hotkey...</span>
		{/if}
    </span>
	{#if defaultHotkeys && !areObjectsEqual(hotkeys, defaultHotkeys)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<span 
			class="clickable-icon setting-restore-hotkey-button"
			aria-label="Restore default" 
			use:icon={"rotate-ccw"} 
			onclick={() => resetHotkeys()} role="button"
		></span>
	{/if}
	
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<span 
		class="clickable-icon setting-add-hotkey-button" class:mod-active={recordingHotkey}
		aria-label="Customize this action" 
		use:icon={"circle-plus"} 
		onclick={() => startRecordingHotkey()} role="button"
	></span>
</SettingComponent>

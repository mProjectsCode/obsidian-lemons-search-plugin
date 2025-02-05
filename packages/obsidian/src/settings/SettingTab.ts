import type { App, Hotkey } from 'obsidian';
import { PluginSettingTab, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';
import HotkeySetting from 'packages/obsidian/src/utils/HotkeySetting.svelte';
import { mount } from 'svelte';

export class LemonsSearchSettingsTab extends PluginSettingTab {
	plugin: LemonsSearchPlugin;
	scope?: Scope;

	constructor(app: App, plugin: LemonsSearchPlugin) {
		super(app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		this.scope = new Scope();
		this.app.keymap.pushScope(this.scope);

		mount(HotkeySetting, {
			target: this.containerEl,
			props: {
				name: 'Selection up',
				description: 'Hotkey to select move the search result selection up by one.',
				hotkeys: this.plugin.settings.hotkeySearchSelectionUp,
				defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchSelectionUp,
				onUpdate: (h: Hotkey[]) => {
					this.plugin.settings.hotkeySearchSelectionUp = h;
					void this.plugin.saveSettings();
				},
				scope: this.scope,
			},
		});

		mount(HotkeySetting, {
			target: this.containerEl,
			props: {
				name: 'Selection down',
				description: 'Hotkey to select move the search result selection down by one.',
				hotkeys: this.plugin.settings.hotkeySearchSelectionDown,
				defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchSelectionDown,
				onUpdate: (h: Hotkey[]) => {
					this.plugin.settings.hotkeySearchSelectionDown = h;
					void this.plugin.saveSettings();
				},
				scope: this.scope,
			},
		});

		mount(HotkeySetting, {
			target: this.containerEl,
			props: {
				name: 'Selection first',
				description: 'Hotkey to select the first search result.',
				hotkeys: this.plugin.settings.hotkeySearchSelectionFirst,
				defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchSelectionFirst,
				onUpdate: (h: Hotkey[]) => {
					this.plugin.settings.hotkeySearchSelectionFirst = h;
					void this.plugin.saveSettings();
				},
				scope: this.scope,
			},
		});

		mount(HotkeySetting, {
			target: this.containerEl,
			props: {
				name: 'Selection last',
				description: 'Hotkey to select the last search result.',
				hotkeys: this.plugin.settings.hotkeySearchSelectionLast,
				defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchSelectionLast,
				onUpdate: (h: Hotkey[]) => {
					this.plugin.settings.hotkeySearchSelectionLast = h;
					void this.plugin.saveSettings();
				},
				scope: this.scope,
			},
		});

		mount(HotkeySetting, {
			target: this.containerEl,
			props: {
				name: 'Copy selection to search',
				description: 'Hotkey to copy the current selection to the search bar.',
				hotkeys: this.plugin.settings.hotkeySearchFillSelection,
				defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchFillSelection,
				onUpdate: (h: Hotkey[]) => {
					this.plugin.settings.hotkeySearchFillSelection = h;
					void this.plugin.saveSettings();
				},
				scope: this.scope,
			},
		});
	}

	hide(): void {
		super.hide();
		if (this.scope) {
			this.app.keymap.popScope(this.scope);
		}
	}
}

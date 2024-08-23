import { type App, PluginSettingTab } from 'obsidian';
import type LemonsSearchPlugin from '../main';

export class LemonsSearchSettingsTab extends PluginSettingTab {
	plugin: LemonsSearchPlugin;

	constructor(app: App, plugin: LemonsSearchPlugin) {
		super(app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();
	}
}

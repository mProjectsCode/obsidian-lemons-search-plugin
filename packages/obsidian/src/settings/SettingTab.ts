import { type App, PluginSettingTab, Setting } from 'obsidian';
import type LemonsSearchPlugin from '../main';

export class SampleSettingTab extends PluginSettingTab {
	plugin: LemonsSearchPlugin;

	constructor(app: App, plugin: LemonsSearchPlugin) {
		super(app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName('Setting #1')
			.setDesc("It's a secret")
			.addText(text =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.mySetting)
					.onChange(async value => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

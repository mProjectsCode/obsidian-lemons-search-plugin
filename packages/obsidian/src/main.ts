import { Plugin, TFile } from 'obsidian';
import { type MyPluginSettings, DEFAULT_SETTINGS } from './settings/Settings';
import { SampleSettingTab } from './settings/SettingTab';
import init, { InitInput, Search, greet, setup } from '../../lemons-search/pkg';
import wasmbin from '../../lemons-search/pkg/lemons_search_bg.wasm';
import { SearchModal } from './SearchModal';

export default class LemonsSearchPlugin extends Plugin {
	// @ts-ignore defined in on load;
	settings: MyPluginSettings;
	search!: Search;

	async onload(): Promise<void> {
		await this.loadSettings();

		await init(wasmbin as unknown as InitInput);

		setup();

		this.search = new Search();

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.addCommand({
			id: 'open-search',
			name: 'Open Search',
			callback: () => {
				new SearchModal(this).open();
			},
		});

		this.app.workspace.onLayoutReady(() => {
			for (const file of this.app.vault.getAllLoadedFiles()) {
				if (!(file instanceof TFile)) {
					continue;
				}

				this.search.add_file(file.path, '');
			}
		});
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as MyPluginSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

import { Plugin, TFile } from 'obsidian';
import { type MyPluginSettings, DEFAULT_SETTINGS } from './settings/Settings';
import { SampleSettingTab } from './settings/SettingTab';
import init, { InitInput, RustPlugin, setup } from '../../lemons-search/pkg';
import wasmbin from '../../lemons-search/pkg/lemons_search_bg.wasm';
import { SearchModal } from './SearchModal';

export default class LemonsSearchPlugin extends Plugin {
	// @ts-ignore defined in on load;
	settings: MyPluginSettings;
	rustPlugin!: RustPlugin;

	async onload(): Promise<void> {
		await this.loadSettings();

		await init(wasmbin as unknown as InitInput);

		setup();

		this.rustPlugin = new RustPlugin(this);

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.addCommand({
			id: 'open-search',
			name: 'Open Search',
			callback: () => {
				new SearchModal(this).open();
			},
		});

		this.app.workspace.onLayoutReady(() => {
			this.rustPlugin.update_index(
				this.app.vault.getAllLoadedFiles().filter(file => file instanceof TFile).map((file) => file.path)
			);
		});
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as MyPluginSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async readFile(path: string): Promise<string | undefined> {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			return undefined;
		}

		console.log("read file");
		

		return this.app.vault.cachedRead(file);
	}

	openFile(path: string): void {
		this.app.workspace.openLinkText(path, '', true);
	}
}

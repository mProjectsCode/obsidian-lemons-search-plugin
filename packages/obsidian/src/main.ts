import { Plugin, TFile } from 'obsidian';
import { type MyPluginSettings, DEFAULT_SETTINGS } from './settings/Settings';
import { SampleSettingTab } from './settings/SettingTab';
import init, { type InitInput, RustPlugin, setup } from '../../lemons-search/pkg';
import wasmbin from '../../lemons-search/pkg/lemons_search_bg.wasm';
import { SearchModal } from './SearchModal';

const DEBUG = true;

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
			this.rustPlugin.update_index(this.getFilePaths());

			this.app.vault.on('create', file => {
				if (file instanceof TFile) {
					this.rustPlugin.add_file(file.path);
					this.checkIndexConsistency();
				}
			});

			this.app.vault.on('delete', file => {
				if (file instanceof TFile) {
					this.rustPlugin.remove_file(file.path);
					this.checkIndexConsistency();
				}
			});

			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					this.rustPlugin.rename_file(oldPath, file.path);
					this.checkIndexConsistency();
				}
			});
		});
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as MyPluginSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	getFilePaths(): string[] {
		return this.app.vault
			.getAllLoadedFiles()
			.filter(file => file instanceof TFile)
			.map(file => file.path);
	}

	checkIndexConsistency(): void {
		if (DEBUG && !this.rustPlugin.check_index_consistency(this.getFilePaths())) {
			console.error('Index is inconsistent');
		}
	}

	async readFile(path: string): Promise<string | undefined> {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			return undefined;
		}

		return this.app.vault.cachedRead(file);
	}

	openFile(path: string): void {
		void this.app.workspace.openLinkText(path, '', true);
	}

	getResourcePath(path: string): string | undefined {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			return undefined;
		}

		return this.app.vault.getResourcePath(file);
	}
}

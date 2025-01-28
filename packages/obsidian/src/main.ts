import { parseFrontMatterAliases, Plugin, TFile } from 'obsidian';
// import init, { type InitInput, RustPlugin, setup } from '../../lemons-search-ui/pkg';
// import wasmbin from '../../lemons-search-ui/pkg/lemons_search_ui_bg.wasm';
import { SearchModal } from 'packages/obsidian/src/SearchModal';
import { PreviewSearchUIAdapter } from 'packages/obsidian/src/searchUI/PreviewSearchUIAdapter';
import { SearchController } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchData } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import type { LemonsSearchSettings } from 'packages/obsidian/src/settings/Settings';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';

// const DEBUG = true;

const CONTENT_SLICE_LENGTH = 5000;

export default class LemonsSearchPlugin extends Plugin {
	// @ts-ignore defined in on load;
	settings: LemonsSearchSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: 'open-search',
			name: 'Open search',
			callback: () => {
				const searchController = new SearchController(this, new PreviewSearchUIAdapter(), this.getFileData());
				searchController.onSubmit(data => {
					this.openFile(data.data);
				});

				new SearchModal(this, searchController).open();
			},
		});

		this.addCommand({
			id: 'open-alias-search',
			name: 'Open alias search',
			callback: () => {
				const searchController = new SearchController(this, new PreviewSearchUIAdapter(), this.getFileAliasData());
				searchController.onSubmit(data => {
					this.openFile(data.data);
				});

				new SearchModal(this, searchController).open();
			},
		});
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as LemonsSearchSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	getFiles(): TFile[] {
		return this.app.vault.getAllLoadedFiles().filter(file => file instanceof TFile);
	}

	getFileData(): SearchData<string>[] {
		return this.getFiles().map(file => ({ content: file.path, data: file.path }));
	}

	getFileAliasData(): SearchData<string>[] {
		return this.getFiles().flatMap(file => {
			const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
			const aliases = [file.basename, ...(parseFrontMatterAliases(metadata) ?? [])];
			return aliases.map(alias => ({ content: alias, subText: file.path, data: file.path }));
		});
	}

	// checkIndexConsistency(): void {
	// 	if (DEBUG && !this.rustPlugin.check_index_consistency(this.getFilePaths())) {
	// 		console.error('Index is inconsistent');
	// 	}
	// }

	async readFile(path: string): Promise<string | undefined> {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			return undefined;
		}

		return this.app.vault.cachedRead(file);
	}

	async readFileTruncated(path: string): Promise<string | undefined> {
		const content = await this.readFile(path);
		if (content === undefined) {
			return undefined;
		}
		if (content.trim() === '') {
			return '';
		}
		if (content.length < CONTENT_SLICE_LENGTH) {
			return content;
		}
		return content.slice(0, CONTENT_SLICE_LENGTH) + '\n\n...';
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

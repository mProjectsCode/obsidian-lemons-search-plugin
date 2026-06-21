import type { TFile } from 'obsidian';
import { Notice, Plugin } from 'obsidian';
import { API, FileSearchType, SearchUIType } from 'packages/obsidian/src/API';
import { CommandDataSource, CommandDataPlaceholders } from 'packages/obsidian/src/searchData/CommandDataSource';
import { FileAliasDataSource } from 'packages/obsidian/src/searchData/FileAliasDataSource';
import { FileDataSource, FileDataPlaceholders } from 'packages/obsidian/src/searchData/FileDataSource';
import { openFullTextResult } from 'packages/obsidian/src/searchUI/fullText/openFullTextResult';
import { SearchService } from 'packages/obsidian/src/searchWorker/SearchService';
import type { LemonsSearchSettings } from 'packages/obsidian/src/settings/Settings';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';
import { LemonsSearchSettingsTab } from 'packages/obsidian/src/settings/SettingTab';
import { HotkeyHelper } from 'packages/obsidian/src/utils/Hotkeys';
import { formatDuration } from 'packages/obsidian/src/utils/utils';
import 'packages/obsidian/src/styles.css';

const CONTENT_SLICE_LENGTH = 5000;

export default class LemonsSearchPlugin extends Plugin {
	declare settings: LemonsSearchSettings;

	hotkeyHelper!: HotkeyHelper;
	data!: {
		file: FileDataSource;
		alias: FileAliasDataSource;
		command: CommandDataSource;
	};
	api!: API;
	search!: SearchService;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.hotkeyHelper = new HotkeyHelper(this);
		this.data = {
			file: new FileDataSource(this),
			alias: new FileAliasDataSource(this),
			command: new CommandDataSource(this),
		};
		this.search = new SearchService(this);
		this.app.workspace.onLayoutReady(() => this.initializeSearch());
		this.api = new API(this);

		this.addCommand({
			id: 'open-search',
			name: 'Open search',
			callback: async () => {
				await this.api.searchFiles({
					ui: SearchUIType.Preview,
					type: FileSearchType.FilePath,
					placeholders: [FileDataPlaceholders.RecentFiles, FileDataPlaceholders.Bookmarks],
					onSubmit: (data, modifiers) => {
						this.openFile(data.data, modifiers.includes('Mod'));
					},
				});
			},
		});

		this.addCommand({
			id: 'open-alias-search',
			name: 'Open alias search',
			callback: async () => {
				await this.api.searchFiles({
					ui: SearchUIType.Preview,
					type: FileSearchType.Alias,
					placeholders: [FileDataPlaceholders.RecentFiles, FileDataPlaceholders.Bookmarks],
					onSubmit: (data, modifiers) => {
						this.openFile(data.data, modifiers.includes('Mod'));
					},
				});
			},
		});

		this.addCommand({
			id: 'open-command-palette',
			name: 'Open command palette',
			callback: async () => {
				await this.api.searchCommands({
					placeholders: [CommandDataPlaceholders.RecentCommands],
					onSubmit: (data, _) => {
						this.app.commands.executeCommand(data.data);
					},
				});
			},
		});

		if (!this.settings.disableFullTextSearch) {
			this.addCommand({
				id: 'open-full-text-search',
				name: 'Open full-text search',
				callback: async () => {
					await this.api.searchFullText({
						prompt: 'Search note contents...',
						onSubmit: (data, modifiers) => {
							void openFullTextResult(this.app, data.data, modifiers.includes('Mod'));
						},
					});
				},
			});
		}

		this.addCommand({
			id: 'rebuild-search-datastores',
			name: 'Rebuild in-memory search index',
			callback: async () => {
				const stats = await this.search.rebuildBuiltIns();
				if (stats) {
					new Notice(
						`Lemons Search rebuilt the in-memory index for ${stats.indexedFiles.toLocaleString()} notes (${stats.indexedBlocks.toLocaleString()} blocks) in ${formatDuration(stats.durationMs)}.`,
					);
				} else {
					new Notice('Lemons Search rebuilt the in-memory index.');
				}
			},
		});

		this.addCommand({
			id: 'check-search-datastore-health',
			name: 'Check in-memory search index health',
			callback: async () => {
				const report = await this.search.checkHealth();
				const status = report.healthy ? 'healthy' : 'needs attention';
				// eslint-disable-next-line obsidianmd/rule-custom-message -- This command explicitly reports diagnostics in the developer console.
				console.info('Lemons Search in-memory index health:', report);
				new Notice(`Lemons Search in-memory index health: ${status}. See console for details.`);
			},
		});

		this.addSettingTab(new LemonsSearchSettingsTab(this.app, this));
	}

	onunload(): void {
		this.search.terminate();
	}

	private initializeSearch(): void {
		if (this.search.isTerminated()) {
			return;
		}
		this.search.initialize();
		void this.search.initializeBuiltIns().catch(error => {
			new Notice('Lemons Search failed to initialize search indexes. Check console for details.');
			console.error('Failed to initialize Lemons Search indexes:', error);
		});
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as LemonsSearchSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async onSettingChanged(
		key: keyof LemonsSearchSettings,
		previousValue: LemonsSearchSettings[keyof LemonsSearchSettings],
		nextValue: unknown,
	): Promise<void> {
		if (key === 'maxResults') {
			this.search.setMaxResults(Number(nextValue));
		}
		if (key === 'ignoreExcludedFiles' && previousValue !== nextValue) {
			await this.search.rebuildBuiltIns();
		}
		if (key === 'disableFullTextSearch' && previousValue !== nextValue) {
			new Notice('Please restart Obsidian for this change to take full effect.');
		}
		if (key === 'fullTextFuzzySearch') {
			this.search.setFullTextFuzzySearch(Boolean(nextValue));
		}
	}

	getFiles(): TFile[] {
		if (this.settings.ignoreExcludedFiles) {
			return this.app.vault.getFiles().filter(file => !this.app.metadataCache.isUserIgnored(file.path));
		} else {
			return this.app.vault.getFiles();
		}
	}

	async readFileTruncated(file: TFile): Promise<string | undefined> {
		const content = await this.app.vault.cachedRead(file);
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

	openFile(file: TFile, newTab: boolean = true): void {
		void this.app.workspace.openLinkText(file.path, '', newTab);
	}
}

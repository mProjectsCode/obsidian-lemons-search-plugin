import type { TFile } from 'obsidian';
import { Plugin } from 'obsidian';
import { API, FileSearchType, SearchUIType } from 'packages/obsidian/src/API';
import { CommandDataSource, CommandDataPlaceholders } from 'packages/obsidian/src/searchData/CommandDataSource';
import { FileAliasDataSource } from 'packages/obsidian/src/searchData/FileAliasDataSource';
import { FileDataSource, FileDataPlaceholders } from 'packages/obsidian/src/searchData/FileDataSource';
import type { LemonsSearchSettings } from 'packages/obsidian/src/settings/Settings';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';
import { LemonsSearchSettingsTab } from 'packages/obsidian/src/settings/SettingTab';
import { HotkeyHelper } from 'packages/obsidian/src/utils/Hotkeys';

const CONTENT_SLICE_LENGTH = 5000;

export default class LemonsSearchPlugin extends Plugin {
	settings!: LemonsSearchSettings;

	hotkeyHelper!: HotkeyHelper;
	data!: {
		file: FileDataSource;
		alias: FileAliasDataSource;
		command: CommandDataSource;
	};
	api!: API;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.hotkeyHelper = new HotkeyHelper(this);
		this.data = {
			file: new FileDataSource(this),
			alias: new FileAliasDataSource(this),
			command: new CommandDataSource(this),
		};
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

		this.addSettingTab(new LemonsSearchSettingsTab(this.app, this));
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as LemonsSearchSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
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

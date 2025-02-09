import type { Command } from 'obsidian';
import { Plugin, TFile } from 'obsidian';
import { PromptModal } from 'packages/obsidian/src/modals/PromptModal';
import { SearchModal } from 'packages/obsidian/src/modals/SearchModal';
import { SearchDataHelper } from 'packages/obsidian/src/SearchDataHelper';
import { BasicSearchUIAdapter } from 'packages/obsidian/src/searchUI/basic/BasicSearchUIAdapter';
import { PreviewSearchUIAdapter } from 'packages/obsidian/src/searchUI/preview/PreviewSearchUIAdapter';
import { SearchController } from 'packages/obsidian/src/searchUI/SearchController';
import type { LemonsSearchSettings } from 'packages/obsidian/src/settings/Settings';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';
import { LemonsSearchSettingsTab } from 'packages/obsidian/src/settings/SettingTab';
import { HotkeyHelper } from 'packages/obsidian/src/utils/Hotkeys';

// const DEBUG = true;

const CONTENT_SLICE_LENGTH = 5000;

export interface FileSearchPlaceholders {
	recentFiles: boolean;
	bookmarks: boolean;
}

export default class LemonsSearchPlugin extends Plugin {
	// @ts-ignore defined in on load
	settings: LemonsSearchSettings;

	// @ts-ignore defined in on load
	hotkeyHelper: HotkeyHelper;
	// @ts-ignore defined in on load
	searchData: SearchDataHelper;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.hotkeyHelper = new HotkeyHelper(this);
		this.searchData = new SearchDataHelper(this);

		this.addCommand({
			id: 'open-search',
			name: 'Open search',
			callback: () => {
				const rawData = this.searchData.getRawFiles();
				const data = this.searchData.getFiles(rawData);
				const searchController = new SearchController(this, new PreviewSearchUIAdapter('Find a note...'), data);
				searchController.onSubmit((data, modifiers) => {
					this.searchData.onFileOpen(data);
					this.openFile(data.data, modifiers.includes('Mod'));
				});

				new SearchModal(this, searchController).open();
			},
		});

		this.addCommand({
			id: 'open-alias-search',
			name: 'Open alias search',
			callback: () => {
				const rawData = this.searchData.getRawFileAliases();
				const data = this.searchData.getFiles(rawData);
				const searchController = new SearchController(this, new PreviewSearchUIAdapter('Find a note...'), data);
				searchController.onSubmit((data, modifiers) => {
					this.searchData.onFileOpen(data);
					this.openFile(data.data, modifiers.includes('Mod'));
				});

				new SearchModal(this, searchController).open();
			},
		});

		this.addCommand({
			id: 'open-command-palette',
			name: 'Open command palette',
			callback: () => {
				const rawData = this.searchData.getRawCommands();
				const data = this.searchData.getCommands(rawData);
				const searchController = new SearchController(this, new BasicSearchUIAdapter<Command>('Select a command...'), data);
				searchController.onSubmit(data => {
					this.searchData.onCommandExecute(data);
					this.app.commands.executeCommand(data.data);
				});

				new PromptModal(this, searchController).open();
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
		return this.app.vault.getAllLoadedFiles().filter(file => file instanceof TFile);
	}

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

	openFile(path: string, newTab: boolean = true): void {
		void this.app.workspace.openLinkText(path, '', newTab);
	}

	getResourcePath(path: string): string | undefined {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			return undefined;
		}

		return this.app.vault.getResourcePath(file);
	}
}

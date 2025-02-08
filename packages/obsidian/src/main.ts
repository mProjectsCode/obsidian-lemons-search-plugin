import type { Command } from 'obsidian';
import { parseFrontMatterAliases, Plugin, TFile } from 'obsidian';
import { PromptModal } from 'packages/obsidian/src/PromptModal';
import { SearchModal } from 'packages/obsidian/src/SearchModal';
import { BasicSearchUIAdapter } from 'packages/obsidian/src/searchUI/basic/BasicSearchUIAdapter';
import { PreviewSearchUIAdapter } from 'packages/obsidian/src/searchUI/preview/PreviewSearchUIAdapter';
import { SearchController } from 'packages/obsidian/src/searchUI/SearchController';
import type { SearchData } from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import type { LemonsSearchSettings } from 'packages/obsidian/src/settings/Settings';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';
import { LemonsSearchSettingsTab } from 'packages/obsidian/src/settings/SettingTab';
import { mapHotkey } from 'packages/obsidian/src/utils';
import { SearchMemo } from 'packages/obsidian/src/utils/SearchMemo';

// const DEBUG = true;

const CONTENT_SLICE_LENGTH = 5000;

export default class LemonsSearchPlugin extends Plugin {
	// @ts-ignore defined in on load
	settings: LemonsSearchSettings;

	// @ts-ignore defined in on load
	fileMemo: SearchMemo<string>;
	// @ts-ignore defined in on load;
	commandMemo: SearchMemo<string>;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.fileMemo = new SearchMemo<string>();
		this.commandMemo = new SearchMemo<string>();

		this.addCommand({
			id: 'open-search',
			name: 'Open search',
			callback: () => {
				const data = this.getFileData();
				const searchPlaceholders = [
					{
						title: 'Recently opened',
						data: this.fileMemo.getMatching(data, (memo, data) => memo === data.data),
					},
				];
				const searchController = new SearchController(this, new PreviewSearchUIAdapter('Find a note...'), data, searchPlaceholders);
				searchController.onSubmit((data, modifiers) => {
					this.fileMemo.add(data.data);
					this.openFile(data.data, modifiers.includes('Mod'));
				});

				new SearchModal(this, searchController).open();
			},
		});

		this.addCommand({
			id: 'open-alias-search',
			name: 'Open alias search',
			callback: () => {
				const data = this.getFileAliasData();
				const searchPlaceholders = [
					{
						title: 'Recently opened',
						data: this.fileMemo.getMatching(data, (memo, data) => memo === data.data),
					},
				];
				const searchController = new SearchController(this, new PreviewSearchUIAdapter('Find a note...'), data, searchPlaceholders);
				searchController.onSubmit((data, modifiers) => {
					this.fileMemo.add(data.data);
					this.openFile(data.data, modifiers.includes('Mod'));
				});

				new SearchModal(this, searchController).open();
			},
		});

		this.addCommand({
			id: 'open-command-palette',
			name: 'Open command palette',
			callback: () => {
				const data = this.getCommandData();
				const searchPlaceholders = [
					{
						title: 'Recently used',
						data: this.commandMemo.getMatching(data, (memo, data) => memo === data.data.id),
					},
				];
				const searchController = new SearchController(this, new BasicSearchUIAdapter<Command>('Select a command...'), data, searchPlaceholders);
				searchController.onSubmit(data => {
					this.fileMemo.add(data.data.id);
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

	getFileData(): SearchData<string>[] {
		return this.getFiles().map(file => ({ content: file.path, data: file.path }));
	}

	getFileAliasData(): SearchData<string>[] {
		return this.getFiles().flatMap(file => {
			const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
			const aliases = [file.basename, ...(parseFrontMatterAliases(metadata) ?? [])];
			return aliases.map(alias => {
				return {
					content: alias,
					subText: file.path,
					data: file.path,
				};
			});
		});
	}

	getCommandData(): SearchData<Command>[] {
		return this.app.commands.listCommands().map(command => {
			const keys = command.hotkeys?.map(hotkey => mapHotkey(hotkey));

			return {
				content: command.name,
				keys: keys,
				subText: command.id,
				data: command,
			};
		});
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

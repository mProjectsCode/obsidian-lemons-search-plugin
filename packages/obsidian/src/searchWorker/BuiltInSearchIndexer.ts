import type { CachedMetadata, TAbstractFile, TFile } from 'obsidian';
import { parseFrontMatterAliases } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import type { SearchDatum } from 'packages/obsidian/src/searchUI/SearchController';
import type { FullTextBlockMeta } from 'packages/obsidian/src/searchWorker/FullTextBlocks';
import { buildFullTextBlockRecords, FullTextRecordIds } from 'packages/obsidian/src/searchWorker/FullTextBlocks';
import type { SearchDatastore, SearchRecord } from 'packages/obsidian/src/searchWorker/SearchDatastore';
import { sleep, waitForIdle } from 'packages/obsidian/src/utils/async';

const FILE_PATH_STORE_ID = 'builtin:path';
const FILE_ALIAS_STORE_ID = 'builtin:alias';
const FULL_TEXT_BATCH_SIZE = 500;
const PROGRESS_NOTICE_INTERVAL_MS = 500;

export interface BuiltInSearchStores {
	filePath: SearchDatastore<TFile>;
	fileAlias: SearchDatastore<TFile>;
	fullText?: SearchDatastore<FullTextBlockMeta>;
}

export interface FullTextBuildProgress {
	indexedFiles: number;
	totalFiles: number;
	indexedBlocks: number;
	elapsedMs: number;
	phase: 'reading' | 'committing';
}

export interface FullTextBuildStats {
	indexedFiles: number;
	totalFiles: number;
	indexedBlocks: number;
	durationMs: number;
}

export interface BuiltInSearchIndexerEvents {
	onFullTextBuildStarted?(progress: FullTextBuildProgress): void;
	onFullTextBuildProgress?(progress: FullTextBuildProgress): void;
	onFullTextBuildCompleted?(stats: FullTextBuildStats): void;
}

export class BuiltInSearchIndexer {
	private plugin: LemonsSearchPlugin;
	private stores: BuiltInSearchStores;
	private events: BuiltInSearchIndexerEvents;
	private fullTextRecordIds: FullTextRecordIds;
	private fullTextIndexPromise?: Promise<FullTextBuildStats>;
	private fullTextRebuildQueue: Promise<void> = Promise.resolve();
	private rebuildGeneration = 0;

	constructor(plugin: LemonsSearchPlugin, stores: BuiltInSearchStores, events: BuiltInSearchIndexerEvents = {}, fullTextRecordIds = new FullTextRecordIds()) {
		this.plugin = plugin;
		this.stores = stores;
		this.events = events;
		this.fullTextRecordIds = fullTextRecordIds;
	}

	async initialize(): Promise<void> {
		await this.rebuildPathAndAliasStores();
		if (this.stores.fullText) {
			this.fullTextIndexPromise = this.scheduleIdle(() => this.enqueueFullTextRebuild());
		}
		this.registerVaultEvents();
	}

	async whenFullTextReady(): Promise<void> {
		await this.fullTextIndexPromise;
	}

	async rebuild(): Promise<FullTextBuildStats> {
		this.bumpRebuildGeneration();
		if (this.stores.fullText) {
			const [, fullTextStats] = await Promise.all([this.rebuildPathAndAliasStores(), this.enqueueFullTextRebuild()]);
			return fullTextStats;
		}
		await this.rebuildPathAndAliasStores();
		return { indexedFiles: 0, totalFiles: 0, indexedBlocks: 0, durationMs: 0 };
	}

	private enqueueFullTextRebuild(): Promise<FullTextBuildStats> {
		const run = this.fullTextRebuildQueue.then(
			() => this.rebuildFullTextStore(),
			() => this.rebuildFullTextStore(),
		);
		this.fullTextRebuildQueue = run.then(
			() => undefined,
			() => undefined,
		);
		this.fullTextIndexPromise = run;
		return run;
	}

	private async rebuildPathAndAliasStores(): Promise<void> {
		const pathOwners = new Map<string, SearchRecord<SearchDatum<TFile>>[]>();
		const aliasOwners = new Map<string, SearchRecord<SearchDatum<TFile>>[]>();
		for (const file of this.plugin.getFiles()) {
			const records = this.buildFileMetadataRecords(file);
			pathOwners.set(file.path, records.path);
			aliasOwners.set(file.path, records.aliases);
		}
		await Promise.all([this.stores.filePath.replaceAllOwners(pathOwners), this.stores.fileAlias.replaceAllOwners(aliasOwners)]);
	}

	private async rebuildFullTextStore(): Promise<FullTextBuildStats> {
		const fullText = this.stores.fullText!;
		for (;;) {
			const generation = this.rebuildGeneration;
			const files = this.plugin.getFiles().filter(file => this.isMarkdownFile(file));
			const startedAt = performance.now();
			let indexedFiles = 0;
			let indexedBlocks = 0;
			let lastProgressNoticeAt = 0;

			this.reportFullTextProgress({
				indexedFiles,
				totalFiles: files.length,
				indexedBlocks,
				elapsedMs: 0,
				phase: 'reading',
			});

			let bulkLoadStarted = false;
			try {
				await fullText.beginBulkLoad();
				bulkLoadStarted = true;

				for (let start = 0; start < files.length; start += FULL_TEXT_BATCH_SIZE) {
					if (generation !== this.rebuildGeneration) {
						break;
					}

					const batch = files.slice(start, start + FULL_TEXT_BATCH_SIZE);
					const batchResults = await Promise.all(batch.map(file => this.buildFullTextRecordsForFile(file)));
					const batchOwners = new Map<string, SearchRecord<SearchDatum<FullTextBlockMeta>>[]>();

					for (const result of batchResults) {
						if (generation !== this.rebuildGeneration) {
							break;
						}
						batchOwners.set(result.path, result.records);
						indexedFiles += 1;
						indexedBlocks += result.records.length;
					}

					if (generation === this.rebuildGeneration && batchOwners.size > 0) {
						await fullText.replaceOwners(batchOwners);
					}

					const now = performance.now();
					if (now - lastProgressNoticeAt >= PROGRESS_NOTICE_INTERVAL_MS || indexedFiles === files.length) {
						lastProgressNoticeAt = now;
						this.reportFullTextProgress({
							indexedFiles,
							totalFiles: files.length,
							indexedBlocks,
							elapsedMs: now - startedAt,
							phase: 'reading',
						});
					}

					await this.yieldToUI();
				}

				if (generation === this.rebuildGeneration) {
					this.reportFullTextProgress({
						indexedFiles,
						totalFiles: files.length,
						indexedBlocks,
						elapsedMs: performance.now() - startedAt,
						phase: 'committing',
					});
					await fullText.finishBulkLoad();
					bulkLoadStarted = false;
					const stats = {
						indexedFiles,
						totalFiles: files.length,
						indexedBlocks,
						durationMs: performance.now() - startedAt,
					};
					this.events.onFullTextBuildCompleted?.(stats);
					return stats;
				}

				if (bulkLoadStarted) {
					bulkLoadStarted = false;
					await fullText.clear();
				}
			} catch (e) {
				if (bulkLoadStarted) {
					await fullText.clear().catch(clearError => {
						console.error('Lemons Search failed to abort full-text bulk load:', clearError);
					});
				}
				throw e;
			}
		}
	}

	private async buildFullTextRecordsForFile(file: TFile): Promise<{ path: string; records: SearchRecord<SearchDatum<FullTextBlockMeta>>[] }> {
		if (this.isIgnored(file)) {
			return { path: file.path, records: [] };
		}
		const text = await this.plugin.app.vault.cachedRead(file);
		const metadata = this.plugin.app.metadataCache.getFileCache(file) ?? undefined;
		return {
			path: file.path,
			records: buildFullTextBlockRecords(file, text, metadata, false, this.fullTextRecordIds),
		};
	}

	private registerVaultEvents(): void {
		this.plugin.registerEvent(
			this.plugin.app.vault.on('create', file => {
				if (this.isFile(file)) {
					void this.reindexFile(file);
				}
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on('delete', file => {
				if (this.isFile(file)) {
					this.bumpRebuildGeneration();
					void this.deleteFileRecords(file.path);
				}
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on('rename', (file, oldPath) => {
				if (this.isFile(file)) {
					this.bumpRebuildGeneration();
					void this.deleteFileRecords(oldPath).then(() => this.reindexFile(file));
				}
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.metadataCache.on('changed', (file, data, cache) => {
				this.bumpRebuildGeneration();
				void Promise.all([this.reindexFileMetadata(file, cache), this.reindexFileBlocks(file, data, cache)]);
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.metadataCache.on('deleted', file => {
				this.bumpRebuildGeneration();
				void this.deleteFileRecords(file.path);
			}),
		);
	}

	private async reindexFile(file: TAbstractFile): Promise<void> {
		if (!this.isFile(file)) return;
		this.bumpRebuildGeneration();
		if (this.stores.fullText) {
			if (this.isMarkdownFile(file)) {
				await Promise.all([this.reindexFileMetadata(file), this.reindexFileBlocks(file)]);
				return;
			}
			await Promise.all([this.reindexFileMetadata(file), this.stores.fullText.replaceOwner(file.path, [])]);
		} else {
			await this.reindexFileMetadata(file);
		}
	}

	private async reindexFileMetadata(file: TFile, cache?: CachedMetadata): Promise<void> {
		if (this.isIgnored(file)) {
			await Promise.all([this.stores.filePath.replaceOwner(file.path, []), this.stores.fileAlias.replaceOwner(file.path, [])]);
			return;
		}

		const records = this.buildFileMetadataRecords(file, cache);
		await Promise.all([this.stores.filePath.replaceOwner(file.path, records.path), this.stores.fileAlias.replaceOwner(file.path, records.aliases)]);
	}

	private buildFileMetadataRecords(
		file: TFile,
		cache?: CachedMetadata,
	): { path: SearchRecord<SearchDatum<TFile>>[]; aliases: SearchRecord<SearchDatum<TFile>>[] } {
		const pathDatum: SearchDatum<TFile> = { content: file.path, data: file };
		const pathRecord: SearchRecord<SearchDatum<TFile>> = {
			id: `${FILE_PATH_STORE_ID}:${file.path}`,
			text: file.path,
			meta: pathDatum,
		};

		const metadata = cache?.frontmatter ?? this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		const aliases = [file.basename, ...(parseFrontMatterAliases(metadata) ?? [])];
		const aliasRecords = aliases.map((alias, index): SearchRecord<SearchDatum<TFile>> => {
			const datum = {
				content: alias,
				subText: file.path,
				data: file,
			};
			return {
				id: `${FILE_ALIAS_STORE_ID}:${file.path}:${index}:${alias}`,
				text: alias,
				meta: datum,
			};
		});

		return { path: [pathRecord], aliases: aliasRecords };
	}

	private async reindexFileBlocks(file: TFile, data?: string, cache?: CachedMetadata): Promise<void> {
		if (!this.stores.fullText) {
			return;
		}
		if (!this.isMarkdownFile(file) || this.isIgnored(file)) {
			await this.stores.fullText.replaceOwner(file.path, []);
			return;
		}

		const text = data ?? (await this.plugin.app.vault.cachedRead(file));
		const metadata = cache ?? this.plugin.app.metadataCache.getFileCache(file) ?? undefined;
		const records = buildFullTextBlockRecords(file, text, metadata, false, this.fullTextRecordIds);
		await this.stores.fullText.replaceOwner(file.path, records);
	}

	private async deleteFileRecords(path: string): Promise<void> {
		const tasks = [
			this.stores.filePath.replaceOwner(path, []),
			this.stores.fileAlias.replaceOwner(path, []),
		];
		if (this.stores.fullText) {
			tasks.push(this.stores.fullText.replaceOwner(path, []));
		}
		await Promise.all(tasks);
	}

	private isMarkdownFile(file: TAbstractFile): boolean {
		return 'extension' in file && file.extension === 'md';
	}

	private isFile(file: TAbstractFile): file is TFile {
		return 'extension' in file;
	}

	private isIgnored(file: TFile): boolean {
		return this.plugin.settings.ignoreExcludedFiles && this.plugin.app.metadataCache.isUserIgnored(file.path);
	}

	private bumpRebuildGeneration(): void {
		this.rebuildGeneration += 1;
	}

	private async scheduleIdle<T>(cb: () => Promise<T>): Promise<T> {
		await waitForIdle();
		return await cb();
	}

	private reportFullTextProgress(progress: FullTextBuildProgress): void {
		if (progress.indexedFiles === 0 && progress.phase === 'reading') {
			this.events.onFullTextBuildStarted?.(progress);
		}
		this.events.onFullTextBuildProgress?.(progress);
	}

	private async yieldToUI(): Promise<void> {
		await sleep(0);
	}
}

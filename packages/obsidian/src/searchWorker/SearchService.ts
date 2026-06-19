import type { TFile } from 'obsidian';
import { Notice } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { RPCController } from 'packages/obsidian/src/rpc/RPC';
import type { FullTextBuildProgress, FullTextBuildStats } from 'packages/obsidian/src/searchWorker/BuiltInSearchIndexer';
import { BuiltInSearchIndexer } from 'packages/obsidian/src/searchWorker/BuiltInSearchIndexer';
import type { FullTextBlockMeta } from 'packages/obsidian/src/searchWorker/FullTextBlocks';
import { hydrateFullTextDatum } from 'packages/obsidian/src/searchWorker/FullTextBlocks';
import SearchWorker from 'packages/obsidian/src/searchWorker/search.worker?worker&inline';
import type { SearchDatastoreHealth, SearchResultHydrator } from 'packages/obsidian/src/searchWorker/SearchDatastore';
import { SearchDatastore } from 'packages/obsidian/src/searchWorker/SearchDatastore';
import type {
	DatastoreKind,
	SearchWorkerRPCHandlersMain,
	SearchWorkerRPCHandlersWorker,
	WorkerDatastoreHealth,
	WorkerSearchRecord,
	WorkerSearchResult,
} from 'packages/obsidian/src/searchWorker/SearchWorkerRPCConfig';
import { formatDuration } from 'packages/obsidian/src/utils/utils';

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (reason: Error) => void;
}

export interface SearchServiceHealthReport {
	healthy: boolean;
	stores: Record<string, SearchDatastoreHealth | undefined>;
}

export class SearchService {
	private plugin: LemonsSearchPlugin;
	private worker?: Worker;
	private RPC?: RPCController<SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker>;
	private pending = new Map<string, PendingRequest>();
	private requestCounter = 0;
	private terminated = false;
	private readyPromise: Promise<void>;
	private readyResolve!: () => void;
	private readyReject!: (reason: Error) => void;
	private builtInsPromise?: Promise<void>;
	private builtInIndexer?: BuiltInSearchIndexer;
	private fullTextIndexNotice?: Notice;
	private fullTextIndexNoticeTimer?: number;
	private fullTextIndexNoticeHideTimer?: number;
	private latestFullTextBuildProgress?: FullTextBuildProgress;

	filePath?: SearchDatastore<TFile>;
	fileAlias?: SearchDatastore<TFile>;
	fullText?: SearchDatastore<FullTextBlockMeta>;

	constructor(plugin: LemonsSearchPlugin) {
		this.plugin = plugin;
		this.readyPromise = new Promise((resolve, reject) => {
			this.readyResolve = resolve;
			this.readyReject = reject;
		});
	}

	initialize(): void {
		this.terminated = false;
		this.worker = new SearchWorker();
		this.RPC = RPCController.toWorker<SearchWorkerRPCHandlersMain, SearchWorkerRPCHandlersWorker>(this.worker, {
			onInitialized: (): void => {
				this.RPC?.call('setMaxResults', this.plugin.settings.maxResults);
				this.readyResolve();
			},
			onInitializationFailed: (message): void => {
				this.readyReject(new Error(message));
				new Notice('Lemons Search failed to initialize. Check console for details.');
				console.error('Failed to initialize Lemons Search worker:', message);
			},
			onRequestResolved: (requestId, value): void => this.resolveRequest(requestId, value),
			onRequestFailed: (requestId, message): void => this.rejectRequest(requestId, message),
		});
	}

	terminate(): void {
		this.terminated = true;
		this.clearFullTextIndexNotice();
		this.worker?.terminate();
		this.worker = undefined;
		this.pending.forEach(pending => pending.reject(new Error('Search worker terminated')));
		this.pending.clear();
	}

	isTerminated(): boolean {
		return this.terminated;
	}

	async initializeBuiltIns(): Promise<void> {
		this.builtInsPromise ??= this.doInitializeBuiltIns();
		await this.builtInsPromise;
	}

	async whenBuiltInsReady(): Promise<void> {
		await this.initializeBuiltIns();
	}

	async whenFullTextReady(): Promise<void> {
		await this.initializeBuiltIns();
		await this.builtInIndexer?.whenFullTextReady();
	}

	async createDatastore<T>(kind: DatastoreKind, hydrateResult?: SearchResultHydrator<T>): Promise<SearchDatastore<T>> {
		const id = await this.request<string>('createDatastore', kind);
		return new SearchDatastore<T>(this, id, kind, hydrateResult);
	}

	setMaxResults(maxResults: number): void {
		this.RPC?.call('setMaxResults', Math.max(1, maxResults));
	}

	async clearDatastore(storeId: string): Promise<void> {
		await this.request('clearDatastore', storeId);
	}

	async destroyDatastore(storeId: string): Promise<void> {
		await this.request('destroyDatastore', storeId);
	}

	async upsertRecords(storeId: string, records: WorkerSearchRecord[]): Promise<void> {
		if (records.length === 0) return;
		await this.request('upsertRecords', storeId, records);
	}

	async deleteRecords(storeId: string, ids: string[]): Promise<void> {
		if (ids.length === 0) return;
		await this.request('deleteRecords', storeId, ids);
	}

	async createSession(storeId: string): Promise<string> {
		return await this.request<string>('createSession', storeId);
	}

	async closeSession(sessionId: string): Promise<void> {
		await this.request('closeSession', sessionId);
	}

	async searchSession(sessionId: string, query: string): Promise<WorkerSearchResult[]> {
		return await this.request<WorkerSearchResult[]>('searchSession', sessionId, query);
	}

	async getDatastoreHealth(storeId: string): Promise<WorkerDatastoreHealth> {
		return await this.request<WorkerDatastoreHealth>('getDatastoreHealth', storeId);
	}

	async rebuildBuiltIns(): Promise<FullTextBuildStats | undefined> {
		await this.initializeBuiltIns();
		return await this.builtInIndexer?.rebuild();
	}

	async checkHealth(): Promise<SearchServiceHealthReport> {
		await this.whenFullTextReady();
		const stores = {
			filePath: await this.filePath?.healthCheck(),
			fileAlias: await this.fileAlias?.healthCheck(),
			fullText: await this.fullText?.healthCheck(),
		};
		return {
			stores,
			healthy: Object.values(stores).every(store => store?.healthy),
		};
	}

	private async doInitializeBuiltIns(): Promise<void> {
		this.filePath = await this.createDatastore<TFile>('fuzzy');
		this.fileAlias = await this.createDatastore<TFile>('fuzzy');
		this.fullText = await this.createDatastore<FullTextBlockMeta>('fullText', (datum, query) => hydrateFullTextDatum(this.plugin.app, datum, query));

		this.builtInIndexer = new BuiltInSearchIndexer(
			this.plugin,
			{
				filePath: this.filePath,
				fileAlias: this.fileAlias,
				fullText: this.fullText,
			},
			{
				onFullTextBuildStarted: (progress): void => this.onFullTextBuildStarted(progress),
				onFullTextBuildProgress: (progress): void => this.onFullTextBuildProgress(progress),
				onFullTextBuildCompleted: (stats): void => this.onFullTextBuildCompleted(stats),
			},
		);
		await this.builtInIndexer.initialize();
	}

	private onFullTextBuildStarted(progress: FullTextBuildProgress): void {
		this.clearFullTextIndexNotice();
		this.latestFullTextBuildProgress = progress;
		if (progress.totalFiles === 0) {
			return;
		}
		this.fullTextIndexNoticeTimer = window.setTimeout(() => {
			this.fullTextIndexNotice = new Notice(this.formatFullTextBuildProgress(this.latestFullTextBuildProgress ?? progress), 0);
		}, 1500);
	}

	private onFullTextBuildProgress(progress: FullTextBuildProgress): void {
		this.latestFullTextBuildProgress = progress;
		this.fullTextIndexNotice?.setMessage(this.formatFullTextBuildProgress(progress));
	}

	private onFullTextBuildCompleted(stats: FullTextBuildStats): void {
		if (this.fullTextIndexNoticeTimer) {
			window.clearTimeout(this.fullTextIndexNoticeTimer);
			this.fullTextIndexNoticeTimer = undefined;
		}

		if (!this.fullTextIndexNotice) {
			return;
		}

		this.fullTextIndexNotice.setMessage(
			`Lemons Search indexed ${stats.indexedFiles.toLocaleString()} notes (${stats.indexedBlocks.toLocaleString()} blocks) in memory in ${formatDuration(stats.durationMs)}.`,
		);
		this.fullTextIndexNoticeHideTimer = window.setTimeout(() => {
			this.fullTextIndexNotice?.hide();
			this.fullTextIndexNotice = undefined;
			this.fullTextIndexNoticeHideTimer = undefined;
		}, 3000);
	}

	private clearFullTextIndexNotice(): void {
		if (this.fullTextIndexNoticeTimer) {
			window.clearTimeout(this.fullTextIndexNoticeTimer);
			this.fullTextIndexNoticeTimer = undefined;
		}
		if (this.fullTextIndexNoticeHideTimer) {
			window.clearTimeout(this.fullTextIndexNoticeHideTimer);
			this.fullTextIndexNoticeHideTimer = undefined;
		}
		this.fullTextIndexNotice?.hide();
		this.fullTextIndexNotice = undefined;
		this.latestFullTextBuildProgress = undefined;
	}

	private formatFullTextBuildProgress(progress: FullTextBuildProgress): string {
		const files = `${progress.indexedFiles.toLocaleString()} / ${progress.totalFiles.toLocaleString()}`;
		const blocks = progress.indexedBlocks.toLocaleString();
		const duration = formatDuration(progress.elapsedMs);
		if (progress.phase === 'committing') {
			return `Lemons Search is loading the in-memory index (${files} notes, ${blocks} blocks, ${duration})...`;
		}
		return `Lemons Search is indexing note contents in memory (${files} notes, ${blocks} blocks, ${duration})...`;
	}

	private resolveRequest(requestId: string, value: unknown): void {
		const pending = this.pending.get(requestId);
		if (!pending) return;
		this.pending.delete(requestId);
		pending.resolve(value);
	}

	private rejectRequest(requestId: string, message: string): void {
		const pending = this.pending.get(requestId);
		if (!pending) return;
		this.pending.delete(requestId);
		pending.reject(new Error(message));
	}

	private async request<T = void>(method: keyof SearchWorkerRPCHandlersWorker, ...args: unknown[]): Promise<T> {
		await this.readyPromise;
		if (this.terminated) {
			throw new Error('Search worker terminated');
		}
		const requestId = `request:${++this.requestCounter}`;
		const promise = new Promise<T>((resolve, reject) => {
			this.pending.set(requestId, {
				resolve: value => resolve(value as T),
				reject,
			});
		});
		this.RPC?.call(method, ...([requestId, ...args] as never));
		return await promise;
	}
}

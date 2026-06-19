export interface SearchStorageHealth {
	supported: boolean;
	usageBytes?: number;
	quotaBytes?: number;
	availableBytes?: number;
	usagePercent?: number;
	persisted?: boolean;
	error?: string;
}

export async function getSearchStorageHealth(): Promise<SearchStorageHealth> {
	if (!navigator.storage?.estimate) {
		return { supported: false };
	}

	try {
		const [estimate, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? Promise.resolve(undefined)]);
		const usageBytes = estimate.usage;
		const quotaBytes = estimate.quota;
		const availableBytes = quotaBytes !== undefined && usageBytes !== undefined ? Math.max(0, quotaBytes - usageBytes) : undefined;
		const usagePercent = quotaBytes && usageBytes !== undefined ? (usageBytes / quotaBytes) * 100 : undefined;
		return {
			supported: true,
			usageBytes,
			quotaBytes,
			availableBytes,
			usagePercent,
			persisted,
		};
	} catch (e) {
		return {
			supported: false,
			error: e instanceof Error ? e.message : String(e),
		};
	}
}

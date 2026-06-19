import type { SearchStorageHealth } from 'packages/obsidian/src/searchWorker/SearchStorageHealth';

export function formatStorageHealth(storage: SearchStorageHealth): Record<string, string | boolean | undefined> {
	return {
		supported: storage.supported,
		usage: formatBytes(storage.usageBytes),
		quota: formatBytes(storage.quotaBytes),
		available: formatBytes(storage.availableBytes),
		usagePercent: storage.usagePercent === undefined ? undefined : `${storage.usagePercent.toFixed(2)}%`,
		persisted: storage.persisted,
		error: storage.error,
	};
}

function formatBytes(bytes: number | undefined): string | undefined {
	if (bytes === undefined) {
		return undefined;
	}
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

import { setIcon } from 'obsidian';

export function mod(n: number, m: number): number {
	return ((n % m) + m) % m;
}

export function icon(node: HTMLElement, name: string): void {
	setIcon(node, name);
}

export function areObjectsEqual(obj1: unknown, obj2: unknown): boolean {
	if (obj1 == null && obj2 == null) {
		return true;
	}
	if (obj1 == null || obj2 == null) {
		return false;
	}

	if (typeof obj1 !== typeof obj2) {
		return false;
	}

	if (typeof obj1 === 'object' && typeof obj2 === 'object') {
		// both are arrays
		if (Array.isArray(obj1) && Array.isArray(obj2)) {
			if (obj1.length !== obj2.length) {
				return false;
			}

			for (let i = 0; i < obj1.length; i++) {
				if (!areObjectsEqual(obj1[i], obj2[i])) {
					return false;
				}
			}

			return true;
		}

		// one is array and the other is not
		if (Array.isArray(obj1) || Array.isArray(obj2)) {
			return false;
		}

		const keys1 = Object.keys(obj1);
		const keys2 = Object.keys(obj2);

		if (keys1.length !== keys2.length) {
			return false;
		}

		for (const key of keys1) {
			// @ts-ignore
			if (!areObjectsEqual(obj1[key], obj2[key])) {
				return false;
			}
		}

		return true;
	}

	return obj1 === obj2;
}

export type MaybePromise<T> = T | Promise<T>;

export function expectType<T>(_: T): void {
	// no-op
}

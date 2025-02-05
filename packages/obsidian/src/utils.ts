import type { Hotkey, KeymapContext, Modifier } from 'obsidian';
import { Platform, setIcon } from 'obsidian';

export function mod(n: number, m: number): number {
	return ((n % m) + m) % m;
}

export function getEventModifiers(event: KeyboardEvent | MouseEvent): Modifier[] {
	const modifiers: Modifier[] = [];
	/*
	 * Mod = Cmd on MacOS and Ctrl on other OS
	 * Ctrl = Ctrl key for every OS
	 * Meta = Cmd on MacOS and Win key on other OS
	 */

	// Ctrl on all OS
	if (event.ctrlKey) {
		modifiers.push('Ctrl');
	}
	// Alt on windows, Option on MacOS
	if (event.altKey) {
		modifiers.push('Alt');
	}
	// Shift on all OS
	if (event.shiftKey) {
		modifiers.push('Shift');
	}
	// Win on windows, Cmd on MacOS
	if (event.metaKey) {
		modifiers.push('Meta');
	}

	// Mod is Cmd on MacOS and Ctrl on other OS
	if (Platform.isMacOS) {
		if (event.metaKey) {
			modifiers.push('Mod');
		}
	} else {
		if (event.ctrlKey) {
			modifiers.push('Mod');
		}
	}

	return modifiers;
}

export const KEY_MAP: Record<string, string> = {
	ArrowLeft: '←',
	ArrowRight: '→',
	ArrowUp: '↑',
	ArrowDown: '↓',
	' ': 'Space',
};

export const MODIFIER_KEY_MAP: Record<Modifier, string> = Platform.isMacOS
	? {
			Mod: '⌘',
			Ctrl: '⌃',
			Meta: '⌘',
			Alt: '⌥',
			Shift: '⇧',
		}
	: {
			Mod: 'Ctrl',
			Ctrl: 'Ctrl',
			Meta: 'Win',
			Alt: 'Alt',
			Shift: 'Shift',
		};

export const MODIFIERS: Modifier[] = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'];

export const HOTKEY_SEPARATOR = ' + ';

export function mapHotkey(hotkey: Hotkey): string {
	const key = mapKey(hotkey.key);
	if (hotkey.modifiers.length === 0) {
		return key;
	}

	const modifiers = hotkey.modifiers.map(modifier => MODIFIER_KEY_MAP[modifier]);
	return modifiers.join(HOTKEY_SEPARATOR) + HOTKEY_SEPARATOR + key;
}

export function mapKey(key: string): string {
	return KEY_MAP[key] ?? key;
}

export function icon(node: HTMLElement, name: string): void {
	setIcon(node, name);
}

export function getModifiersFromKeyMapCtx(ctx: KeymapContext): Modifier[] {
	return (ctx.modifiers?.split(',').filter(x => MODIFIERS.contains(x as Modifier)) ?? []) as Modifier[];
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

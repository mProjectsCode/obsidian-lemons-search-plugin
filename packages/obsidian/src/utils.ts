import type { Modifier } from 'obsidian';
import { Platform } from 'obsidian';

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

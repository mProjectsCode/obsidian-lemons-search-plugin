import type { Hotkey } from 'obsidian';

export interface LemonsSearchSettings {
	placeholder: string;
	hotkeySearchSelectionUp: Hotkey[];
	hotkeySearchSelectionDown: Hotkey[];
	hotkeySearchSelectionFirst: Hotkey[];
	hotkeySearchSelectionLast: Hotkey[];
	hotkeySearchFillSelection: Hotkey[];
}

export const DEFAULT_SETTINGS: LemonsSearchSettings = {
	placeholder: 'placeholder',
	hotkeySearchSelectionUp: [{ modifiers: [], key: 'ArrowUp' }],
	hotkeySearchSelectionDown: [{ modifiers: [], key: 'ArrowDown' }],
	hotkeySearchSelectionFirst: [{ modifiers: [], key: 'Home' }],
	hotkeySearchSelectionLast: [{ modifiers: [], key: 'End' }],
	hotkeySearchFillSelection: [{ modifiers: [], key: 'Tab' }],
};

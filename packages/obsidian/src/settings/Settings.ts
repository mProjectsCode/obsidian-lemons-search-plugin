import type { Hotkey } from 'obsidian';

export interface LemonsSearchSettings {
	placeholder: string;
	// Whether to honor the Obsidian file exclusion settings.
	ignoreExcludedFiles: boolean;
	maxResults: number;
	disableFullTextSearch: boolean;
	fullTextFuzzySearch: boolean;
	hotkeySearchSelectionUp: Hotkey[];
	hotkeySearchSelectionDown: Hotkey[];
	hotkeySearchSelectionFirst: Hotkey[];
	hotkeySearchSelectionLast: Hotkey[];
	hotkeySearchFillSelection: Hotkey[];
}

export const DEFAULT_SETTINGS: LemonsSearchSettings = {
	placeholder: 'placeholder',
	ignoreExcludedFiles: true,
	maxResults: 200,
	disableFullTextSearch: false,
	fullTextFuzzySearch: true,
	hotkeySearchSelectionUp: [{ modifiers: [], key: 'ArrowUp' }],
	hotkeySearchSelectionDown: [{ modifiers: [], key: 'ArrowDown' }],
	hotkeySearchSelectionFirst: [{ modifiers: [], key: 'Home' }],
	hotkeySearchSelectionLast: [{ modifiers: [], key: 'End' }],
	hotkeySearchFillSelection: [{ modifiers: [], key: 'Tab' }],
};

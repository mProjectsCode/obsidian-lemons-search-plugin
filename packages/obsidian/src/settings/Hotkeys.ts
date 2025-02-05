import type { Hotkey, Modifier, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { getModifiersFromKeyMapCtx } from 'packages/obsidian/src/utils';

export type HotkeyKey =
	| 'hotkeySearchSelectionUp'
	| 'hotkeySearchSelectionDown'
	| 'hotkeySearchSelectionFirst'
	| 'hotkeySearchSelectionLast'
	| 'hotkeySearchFillSelection';

/**
 * A map of hotkeys to their handler functions.
 * It must specify handlers for the hotkeys in {@link HotkeyKey}.
 * It can also specify handlers for custom hotkeys.
 */
export type HotkeyFunctionMap = Map<HotkeyKey | Hotkey[], (modifiers: Modifier[]) => void>;

export function registerHotkeys(plugin: LemonsSearchPlugin, scope: Scope, functions: HotkeyFunctionMap): void {
	for (const [key, func] of functions) {
		let hotkeys;
		if (Array.isArray(key)) {
			hotkeys = key;
		} else {
			hotkeys = plugin.settings[key];
		}

		if (hotkeys == null) {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			console.warn(`No hotkeys found for key ${key}. Or there is some error in the hotkeys map.`);
			continue;
		}
		if (hotkeys.length === 0) {
			continue;
		}

		for (const hotkey of hotkeys) {
			scope.register(hotkey.modifiers, hotkey.key, (e, ctx) => {
				e.stopPropagation();
				e.preventDefault();

				func(getModifiersFromKeyMapCtx(ctx));
			});
		}
	}
}

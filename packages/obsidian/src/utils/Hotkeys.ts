import type { Command, Hotkey, KeymapContext, KeymapInfo, Modifier, Scope } from 'obsidian';
import { Platform } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';

export type HotkeyKey =
	| 'hotkeySearchSelectionUp'
	| 'hotkeySearchSelectionDown'
	| 'hotkeySearchSelectionFirst'
	| 'hotkeySearchSelectionLast'
	| 'hotkeySearchFillSelection';

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

/**
 * A map of hotkeys to their handler functions.
 * It must specify handlers for the hotkeys in {@link HotkeyKey}.
 * It can also specify handlers for custom hotkeys.
 */
export type HotkeyFunctionMap = Map<HotkeyKey | Hotkey[], (modifiers: Modifier[]) => void>;

export class HotkeyHelper {
	plugin: LemonsSearchPlugin;

	constructor(plugin: LemonsSearchPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Registers the hotkeys from the hotkey function map to the given scope.
	 *
	 * @param scope
	 * @param hotkeyMap
	 */
	registerHotkeysToScope(scope: Scope, hotkeyMap: HotkeyFunctionMap): void {
		for (const [key, cb] of hotkeyMap) {
			let hotkeys;
			if (Array.isArray(key)) {
				hotkeys = key;
			} else {
				hotkeys = this.plugin.settings[key];
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
				const keyModifiers = hotkey.modifiers.length > 0 ? hotkey.modifiers : null;
				scope.register(keyModifiers, hotkey.key, (e, ctx) => {
					e.stopPropagation();
					e.preventDefault();

					const pressedModifiers = this.parseModifiers(ctx.modifiers);
					console.log('Hotkey pressed:', this.stringifyHotkey(hotkey), pressedModifiers);
					cb(pressedModifiers);
				});
			}
		}
	}

	stringifyKey(key: string): string {
		return KEY_MAP[key] ?? key;
	}

	stringifyModifiers(modifiers: Modifier[]): string {
		return modifiers.map(modifier => MODIFIER_KEY_MAP[modifier]).join(HOTKEY_SEPARATOR);
	}

	stringifyHotkey(hotkey: KeymapInfo | Hotkey): string {
		const key = this.stringifyKey(hotkey.key ?? 'None');
		if (!hotkey.modifiers || hotkey.modifiers.length === 0) {
			return key;
		}

		const modifiers = this.parseModifiers(hotkey.modifiers);
		return this.stringifyModifiers(modifiers) + HOTKEY_SEPARATOR + key;
	}

	stringifyHotkeys(hotkeys: (KeymapInfo | Hotkey | null | undefined)[] | null | undefined): string[] | undefined {
		if (!hotkeys) {
			return undefined;
		}

		const strings = [];

		for (const hotkey of hotkeys) {
			if (!hotkey) {
				continue;
			}
			strings.push(this.stringifyHotkey(hotkey));
		}

		return strings;
	}

	parseModifiers(modifiers: string | string[] | null | undefined): Modifier[] {
		if (!modifiers) {
			return [];
		}

		const modifiersArray: string[] = Array.isArray(modifiers) ? [...modifiers] : modifiers.split(',').map(m => m.trim() as Modifier);

		return modifiersArray
			.map(m => {
				if (Platform.isMacOS && m === 'Meta') {
					return 'Mod';
				} else if (!Platform.isMacOS && m === 'Ctrl') {
					return 'Mod';
				}
				return m;
			})
			.filter(m => MODIFIERS.contains(m as Modifier)) as Modifier[];
	}

	keymapCtxToHotkey(ctx: KeymapContext): Hotkey | undefined {
		if (!ctx.key) {
			return;
		}
		return {
			key: ctx.key,
			modifiers: this.parseModifiers(ctx.modifiers),
		};
	}

	getEventModifiers(event: KeyboardEvent | MouseEvent): Modifier[] {
		/*
		 * Mod = Cmd on MacOS and Ctrl on other OS
		 * Ctrl = Ctrl key for every OS
		 * Meta = Cmd on MacOS and Win key on other OS
		 */
		const modifiers: Modifier[] = [];

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

	getHotkeysForCommand(command: Command): (KeymapInfo | Hotkey)[] | undefined {
		const commandManagerKeys = this.plugin.app.hotkeyManager.getHotkeys(command.id) as (KeymapInfo | Hotkey)[] | undefined;
		return commandManagerKeys ?? command.hotkeys;
	}
}

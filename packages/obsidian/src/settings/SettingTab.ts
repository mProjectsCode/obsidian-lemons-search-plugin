import type { App, Hotkey, Setting, SettingDefinitionItem, SettingDefinitionRender } from 'obsidian';
import { PluginSettingTab, Scope } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { HotkeySetting } from 'packages/obsidian/src/settings/HotkeySetting';
import { DEFAULT_SETTINGS } from 'packages/obsidian/src/settings/Settings';

type HotkeySettingKey =
	| 'hotkeySearchSelectionUp'
	| 'hotkeySearchSelectionDown'
	| 'hotkeySearchSelectionFirst'
	| 'hotkeySearchSelectionLast'
	| 'hotkeySearchFillSelection';

interface HotkeySettingsProps {
	name: string;
	description: string;
	hotkeyKey: HotkeySettingKey;
	defaultHotkeys: Hotkey[];
}

const HOTKEY_SETTINGS: HotkeySettingsProps[] = [
	{
		name: 'Selection up',
		description: 'Hotkey to move the search result selection up by one.',
		hotkeyKey: 'hotkeySearchSelectionUp',
		defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchSelectionUp,
	},
	{
		name: 'Selection down',
		description: 'Hotkey to move the search result selection down by one.',
		hotkeyKey: 'hotkeySearchSelectionDown',
		defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchSelectionDown,
	},
	{
		name: 'Selection first',
		description: 'Hotkey to select the first search result.',
		hotkeyKey: 'hotkeySearchSelectionFirst',
		defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchSelectionFirst,
	},
	{
		name: 'Selection last',
		description: 'Hotkey to select the last search result.',
		hotkeyKey: 'hotkeySearchSelectionLast',
		defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchSelectionLast,
	},
	{
		name: 'Copy selection to search',
		description: 'Hotkey to copy the current selection to the search bar.',
		hotkeyKey: 'hotkeySearchFillSelection',
		defaultHotkeys: DEFAULT_SETTINGS.hotkeySearchFillSelection,
	},
];

export class LemonsSearchSettingsTab extends PluginSettingTab {
	plugin: LemonsSearchPlugin;
	scope?: Scope;

	constructor(app: App, plugin: LemonsSearchPlugin) {
		super(app, plugin);

		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Honor excluded files',
				desc: 'Whether this plugin should honor the Obsidian setting for excluded files "Files and links > Excluded files".',
				control: {
					type: 'toggle',
					key: 'ignoreExcludedFiles',
				},
			},
			{
				name: 'Max search results',
				desc: 'Maximum number of ranked results to return from the search engine.',
				control: {
					type: 'number',
					key: 'maxResults',
					min: 1,
					step: 1,
					defaultValue: DEFAULT_SETTINGS.maxResults,
					validate: value => (Number.isInteger(value) && value >= 1 ? undefined : 'Value must be a positive integer.'),
				},
			},
			{
				name: 'Disable full-text search',
				desc: 'When enabled, full-text content search and indexing are completely disabled.',
				control: {
					type: 'toggle',
					key: 'disableFullTextSearch',
				},
			},
			{
				name: 'Fuzzy search in full-text',
				desc: 'When enabled, full-text search uses fuzzy matching to find approximate term matches.',
				control: {
					type: 'toggle',
					key: 'fullTextFuzzySearch',
				},
			},
			{
				type: 'group',
				heading: 'Hotkeys',
				items: HOTKEY_SETTINGS.map(props => this.createHotkeySetting(props)),
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!(key in this.plugin.settings)) {
			return;
		}
		const settingKey = key as keyof typeof this.plugin.settings;
		const previousValue = this.plugin.settings[settingKey];
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
		await this.plugin.onSettingChanged(settingKey, previousValue, value);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('p', {
			text: 'Lemons Search settings require Obsidian 1.13.0 or newer. This app appears to be running an older version.',
		});
	}

	createHotkeySetting(props: HotkeySettingsProps): SettingDefinitionRender {
		return {
			name: props.name,
			desc: props.description,
			render: (setting: Setting) => this.renderHotkeySetting(setting, props),
		};
	}

	renderHotkeySetting(setting: Setting, props: HotkeySettingsProps): () => void {
		const scope = this.ensureScope();

		const hotkeySetting = new HotkeySetting({
			plugin: this.plugin,
			containerEl: setting.controlEl,
			scope,
			hotkeys: this.plugin.settings[props.hotkeyKey],
			defaultHotkeys: props.defaultHotkeys,
			onUpdate: (hotkeys: Hotkey[]): void => {
				this.plugin.settings[props.hotkeyKey] = hotkeys;
				void this.plugin.saveSettings();
			},
		});

		return () => {
			hotkeySetting.destroy();
		};
	}

	ensureScope(): Scope {
		if (!this.scope) {
			this.scope = new Scope();
			this.app.keymap.pushScope(this.scope);
		}

		return this.scope;
	}

	releaseScope(): void {
		if (this.scope) {
			this.app.keymap.popScope(this.scope);
			this.scope = undefined;
		}
	}

	hide(): void {
		super.hide();
		this.releaseScope();
	}
}

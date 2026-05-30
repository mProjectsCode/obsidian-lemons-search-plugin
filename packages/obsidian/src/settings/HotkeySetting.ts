import type { Hotkey, KeymapEventHandler, Scope } from 'obsidian';
import { setIcon } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';
import { areObjectsEqual } from 'packages/obsidian/src/utils/utils';

interface HotkeySettingProps {
	plugin: LemonsSearchPlugin;
	containerEl: HTMLElement;
	scope: Scope;
	hotkeys: Hotkey[];
	defaultHotkeys?: Hotkey[];
	onUpdate: (hotkeys: Hotkey[]) => void;
}

export class HotkeySetting {
	plugin: LemonsSearchPlugin;
	containerEl: HTMLElement;
	scope: Scope;
	defaultHotkeys?: Hotkey[];
	onUpdate: (hotkeys: Hotkey[]) => void;
	private hotkeys: Hotkey[];
	private recordingHotkey = false;
	private listener: KeymapEventHandler | null = null;

	constructor(props: HotkeySettingProps) {
		this.plugin = props.plugin;
		this.containerEl = props.containerEl;
		this.scope = props.scope;
		this.defaultHotkeys = props.defaultHotkeys;
		this.onUpdate = props.onUpdate;
		this.hotkeys = structuredClone(props.hotkeys);
		this.render();
	}

	destroy(): void {
		this.stopRecordingHotkey();
		this.containerEl.empty();
	}

	private render(): void {
		this.containerEl.empty();

		const hotkeysEl = this.containerEl.createSpan({ cls: 'setting-command-hotkeys' });

		if (this.hotkeys.length === 0) {
			if (!this.recordingHotkey) {
				this.createLabel(hotkeysEl, 'setting-hotkey mod-empty', 'Blank');
			}
		} else {
			this.hotkeys.forEach((hotkey, index) => {
				this.createHotkeyEl(hotkeysEl, hotkey, index);
			});
		}

		if (this.recordingHotkey) {
			this.createLabel(hotkeysEl, 'setting-hotkey mod-active', 'Press hotkey...');
		}

		if (this.defaultHotkeys && !areObjectsEqual(this.hotkeys, this.defaultHotkeys)) {
			this.createIconButton(this.containerEl, 'clickable-icon setting-restore-hotkey-button', 'rotate-ccw', 'Restore default', () => this.resetHotkeys());
		}

		this.createIconButton(
			this.containerEl,
			'clickable-icon setting-add-hotkey-button',
			'circle-plus',
			'Customize this action',
			() => this.startRecordingHotkey(),
			this.recordingHotkey,
		);
	}

	private createHotkeyEl(parentEl: HTMLElement, hotkey: Hotkey, index: number): void {
		const hotkeyText = this.plugin.hotkeyHelper.stringifyHotkey(hotkey);
		const hotkeyEl = parentEl.createSpan({ cls: 'setting-hotkey' });

		if (hotkeyText.length === 0) {
			hotkeyEl.addClass('mod-empty');
			hotkeyEl.setText('Blank');
			return;
		}

		hotkeyEl.setText(hotkeyText);

		this.createIconButton(hotkeyEl, 'setting-hotkey-icon setting-delete-hotkey', 'x', 'Delete hotkey', () => this.deleteHotkey(index));
	}

	private createLabel(parent: HTMLElement, cls: string, text: string): HTMLSpanElement {
		return parent.createSpan({ cls, text });
	}

	private createIconButton(
		parent: HTMLElement,
		cls: string,
		icon: Parameters<typeof setIcon>[1],
		label: string,
		onClick: () => void,
		active = false,
	): HTMLSpanElement {
		const button = parent.createSpan({ cls });
		button.toggleClass('mod-active', active);
		button.setAttr('aria-label', label);
		button.setAttr('role', 'button');
		setIcon(button, icon);
		button.addEventListener('click', onClick);
		return button;
	}

	private deleteHotkey(index: number): void {
		this.hotkeys.splice(index, 1);
		this.commitHotkeys();
	}

	private startRecordingHotkey(): void {
		if (this.recordingHotkey) {
			return;
		}

		this.recordingHotkey = true;
		this.render();

		this.listener = this.scope.register(null, null, (e, ctx) => {
			e.stopPropagation();
			e.preventDefault();

			const hotkey = this.plugin.hotkeyHelper.keymapCtxToHotkey(ctx);
			if (hotkey && hotkey.key !== 'Escape') {
				this.hotkeys.push(hotkey);
			}

			this.stopRecordingHotkey();
			this.commitHotkeys();
		});
	}

	private resetHotkeys(): void {
		if (this.defaultHotkeys) {
			this.hotkeys = structuredClone(this.defaultHotkeys);
		}

		this.commitHotkeys();
	}

	private stopRecordingHotkey(): void {
		this.recordingHotkey = false;

		if (this.listener) {
			this.scope.unregister(this.listener);
			this.listener = null;
		}
	}

	private commitHotkeys(): void {
		this.onUpdate(structuredClone(this.hotkeys));
		this.render();
	}
}

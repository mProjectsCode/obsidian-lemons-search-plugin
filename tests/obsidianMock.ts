import { mock } from 'bun:test';
import Moment from 'moment';

mock.module('obsidian', () => ({
	TFile: class TFile {},
	setIcon(iconEl: HTMLElement, iconName: string): void {
		// do nothing
	},
	parseFrontMatterAliases(frontmatter?: { aliases?: string | string[]; alias?: string | string[] }): string[] | null {
		const aliases = frontmatter?.aliases ?? frontmatter?.alias;
		if (Array.isArray(aliases)) {
			return aliases;
		}
		if (typeof aliases === 'string') {
			return [aliases];
		}
		return null;
	},
	moment: Moment,
}));

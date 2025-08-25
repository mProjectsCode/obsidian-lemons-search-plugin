import type { Command } from 'obsidian';
import { AbstractDataSource } from 'packages/obsidian/src/searchData/AbstractDataSource';
import type { SearchDatum, SearchPlaceholderCategory } from 'packages/obsidian/src/searchUI/SearchController';

export enum CommandDataPlaceholders {
	RecentCommands = 'recentCommands',
}

export class CommandDataSource extends AbstractDataSource<Command, string, CommandDataPlaceholders> {
	getId(data: SearchDatum<Command>): string {
		return data.data.id;
	}

	getRawData(): SearchDatum<Command>[] {
		return this.plugin.app.commands.listCommands().map(command => {
			const hotkeys = this.plugin.hotkeyHelper.getHotkeysForCommand(command);
			const keys = this.plugin.hotkeyHelper.stringifyHotkeys(hotkeys);

			return {
				content: command.name,
				hotKeys: keys,
				subText: command.id,
				data: command,
			};
		});
	}

	getPlaceholders(rawData: SearchDatum<Command>[], active: CommandDataPlaceholders[]): SearchPlaceholderCategory<Command>[] {
		const placeholders: SearchPlaceholderCategory<Command>[] = [];

		if (active.includes(CommandDataPlaceholders.RecentCommands)) {
			placeholders.push({
				title: 'Recently used',
				data: this.getMemoMatching(rawData),
			});
		}

		return placeholders;
	}
}

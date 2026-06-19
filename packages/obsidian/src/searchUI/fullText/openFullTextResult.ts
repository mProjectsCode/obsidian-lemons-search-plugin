import type { App, EditorPosition } from 'obsidian';
import { MarkdownView, TFile } from 'obsidian';
import type { FullTextBlockMeta } from 'packages/obsidian/src/searchWorker/FullTextBlocks';

export async function openFullTextResult(app: App, result: FullTextBlockMeta, newTab: boolean = true): Promise<void> {
	const file = app.vault.getAbstractFileByPath(result.filePath);
	if (!(file instanceof TFile)) {
		return;
	}

	const content = await app.vault.cachedRead(file);
	const from = offsetToPosition(content, result.startOffset);
	const to = offsetToPosition(content, result.endOffset);

	await app.workspace.openLinkText(file.path, '', newTab, { active: true });
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view || view.file?.path !== file.path) {
		return;
	}

	view.editor.setSelection(from, to);
	view.editor.scrollIntoView({ from, to }, true);
}

function offsetToPosition(text: string, offset: number): EditorPosition {
	const boundedOffset = Math.max(0, Math.min(offset, text.length));
	const prefix = text.slice(0, boundedOffset);
	const lines = prefix.split('\n');
	return {
		line: lines.length - 1,
		ch: lines[lines.length - 1]?.length ?? 0,
	};
}

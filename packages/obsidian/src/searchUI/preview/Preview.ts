import type { TFile } from 'obsidian';
import type LemonsSearchPlugin from 'packages/obsidian/src/main';

export enum PreviewType {
	MARKDOWN,
	TEXT,
	EMPTY_TEXT,
	IMAGE,
	FILE_NOT_FOUND,
	UNSUPPORTED,
	NONE,
}

export type Preview =
	| {
			type: PreviewType.MARKDOWN;
			content: string;
	  }
	| {
			type: PreviewType.TEXT;
			content: string;
	  }
	| {
			type: PreviewType.EMPTY_TEXT;
	  }
	| {
			type: PreviewType.IMAGE;
			source: string;
	  }
	| {
			type: PreviewType.FILE_NOT_FOUND;
	  }
	| {
			type: PreviewType.UNSUPPORTED;
	  }
	| {
			type: PreviewType.NONE;
	  };

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
// File extensions that we render by embedding them in markdown via `![[<file_path>]]`
const EMBED_EXTENSIONS = ['pdf', 'canvas', 'base'];

export async function getPreview(file: TFile | undefined, plugin: LemonsSearchPlugin): Promise<Preview> {
	if (file === undefined) {
		return { type: PreviewType.NONE };
	}

	// console.log('getPreview', path);

	if (file.extension === 'md') {
		const content = await plugin.readFileTruncated(file);
		if (content === undefined) {
			return { type: PreviewType.FILE_NOT_FOUND };
		}
		if (content === '') {
			return { type: PreviewType.EMPTY_TEXT };
		}
		return { type: PreviewType.MARKDOWN, content };
	} else if (file.extension === 'txt') {
		const content = await plugin.readFileTruncated(file);

		if (content === undefined) {
			return { type: PreviewType.FILE_NOT_FOUND };
		}
		if (content === '') {
			return { type: PreviewType.EMPTY_TEXT };
		}
		return { type: PreviewType.TEXT, content };
	} else if (EMBED_EXTENSIONS.some(ext => file.extension === ext)) {
		return { type: PreviewType.MARKDOWN, content: `![[${file.path}]]` };
	} else if (IMAGE_EXTENSIONS.some(ext => file.extension === ext)) {
		const content = plugin.app.vault.getResourcePath(file);

		if (content === undefined) {
			return { type: PreviewType.FILE_NOT_FOUND };
		}
		return { type: PreviewType.IMAGE, source: content };
	} else {
		return { type: PreviewType.UNSUPPORTED };
	}
}

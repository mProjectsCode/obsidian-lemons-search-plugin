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

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

export async function getPreview(path: string | undefined, plugin: LemonsSearchPlugin): Promise<Preview> {
	if (path === undefined) {
		return { type: PreviewType.NONE };
	}

	// console.log('getPreview', path);

	if (path.endsWith('.md')) {
		const content = await plugin.readFileTruncated(path);
		if (content === undefined) {
			return { type: PreviewType.FILE_NOT_FOUND };
		}
		if (content === '') {
			return { type: PreviewType.EMPTY_TEXT };
		}
		return { type: PreviewType.MARKDOWN, content };
	} else if (path.endsWith('.txt')) {
		const content = await plugin.readFileTruncated(path);

		if (content === undefined) {
			return { type: PreviewType.FILE_NOT_FOUND };
		}
		if (content === '') {
			return { type: PreviewType.EMPTY_TEXT };
		}
		return { type: PreviewType.TEXT, content };
	} else if (IMAGE_EXTENSIONS.some(ext => path.endsWith(ext))) {
		const content = plugin.getResourcePath(path);

		if (content === undefined) {
			return { type: PreviewType.FILE_NOT_FOUND };
		}
		return { type: PreviewType.IMAGE, source: content };
	} else {
		return { type: PreviewType.UNSUPPORTED };
	}
}

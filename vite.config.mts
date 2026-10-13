import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createObsidianPluginConfig } from '@lemons_dev/lemons-obsidian-plugin-automation';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const useLocalWasmPackage = process.env.LEMONS_SEARCH_LOCAL_WASM === 'true';

export default defineConfig(({ mode }) =>
	createObsidianPluginConfig({
		root,
		mode,
		entry: 'packages/obsidian/src/main.ts',
		plugins: [svelte()],
		resolve: {
			alias: [
				{ find: 'packages', replacement: path.join(root, 'packages') },
				...(useLocalWasmPackage
					? [{ find: /^@lemons_dev\/lemons-search$/, replacement: path.join(root, 'packages/lemons-search/pkg/lemons_search.js') }]
					: []),
			],
		},
	}),
);

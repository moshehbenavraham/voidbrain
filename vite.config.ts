import { svelte } from "@sveltejs/vite-plugin-svelte";
import builtinModules from "builtin-modules";
import { defineConfig } from "vite";

const pluginId = "voidbrain";

const codeMirrorExternals = [
	"@codemirror/autocomplete",
	"@codemirror/collab",
	"@codemirror/commands",
	"@codemirror/language",
	"@codemirror/lint",
	"@codemirror/search",
	"@codemirror/state",
	"@codemirror/view",
	"@lezer/common",
	"@lezer/highlight",
	"@lezer/lr",
];

const nodeBuiltinExternals = builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]);

const resolveOutDir = (mode: string): string => {
	if (mode === "production") {
		return `build/${pluginId}`;
	}

	return `build/${pluginId}-dev`;
};

export default defineConfig(({ mode }) => {
	const isDevelopment = mode === "development";

	return {
		plugins: [svelte()],
		build: {
			lib: {
				entry: "src/main.ts",
				formats: ["cjs"],
				fileName: () => "main.js",
			},
			outDir: resolveOutDir(mode),
			emptyOutDir: true,
			sourcemap: isDevelopment,
			rollupOptions: {
				external: ["obsidian", "electron", ...codeMirrorExternals, ...nodeBuiltinExternals],
				output: {
					assetFileNames: "styles.css",
					entryFileNames: "main.js",
					inlineDynamicImports: true,
					manualChunks: undefined,
				},
			},
		},
		css: {
			devSourcemap: isDevelopment,
		},
	};
});

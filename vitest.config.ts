import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: {
			obsidian: new URL("./test/__mocks__/obsidian.ts", import.meta.url).pathname,
		},
	},
	test: {
		clearMocks: true,
		coverage: {
			exclude: ["test/**/*.ts"],
			include: ["src/**/*.ts"],
			provider: "v8",
			reporter: ["text", "json", "html"],
		},
		env: {
			TZ: "UTC",
		},
		environment: "jsdom",
		globals: true,
		include: ["test/**/*.{test,spec}.ts"],
		mockReset: false,
		restoreMocks: true,
		setupFiles: ["./test/setup.ts"],
		testTimeout: 10000,
	},
});

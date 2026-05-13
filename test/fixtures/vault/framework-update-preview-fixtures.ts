import type {
	FrameworkUpdatePreviewCandidate,
	FrameworkUpdatePreviewCurrentFile,
} from "../../../src/types/agent-commands";

export const frameworkPreviewNow = new Date("2026-05-13T00:00:00.000Z");

export const currentAgentSurface = [
	"# AGENTS.md",
	"",
	"Voidbrain is local-first.",
	"Framework update behavior is dry-run only.",
	"",
].join("\n");

export const proposedAgentSurface = [
	"# AGENTS.md",
	"",
	"Voidbrain is local-first.",
	"Framework update preview reports deterministic dry-run actions.",
	"",
].join("\n");

export const currentReadme = ["# Voidbrain", "", "Local-first Obsidian-style AI second-brain scaffold.", ""].join("\n");

export const proposedFrameworkDoc = [
	"# Framework Update Preview",
	"",
	"Dry-run plans stay local-first and never apply framework changes.",
	"",
].join("\n");

export const frameworkPreviewCurrentFiles: readonly FrameworkUpdatePreviewCurrentFile[] = [
	{
		path: "AGENTS.md",
		content: currentAgentSurface,
	},
	{
		path: "README.md",
		content: currentReadme,
	},
];

export const safeFrameworkPreviewCandidates: readonly FrameworkUpdatePreviewCandidate[] = [
	{
		path: "AGENTS.md",
		proposedContent: proposedAgentSurface,
		source: "synthetic-update",
	},
	{
		path: "README.md",
		proposedContent: currentReadme,
		source: "synthetic-skip",
	},
	{
		path: "docs/framework-update-preview.md",
		proposedContent: proposedFrameworkDoc,
		source: "synthetic-create",
	},
];

export const excludedFrameworkPreviewPaths = [
	"vault/research-note.md",
	"test/fixtures/vault/sources/demo-article.md",
	".voidbrain/cache/hot-cache.json",
	".voidbrain/staged/change-demo.json",
	".voidbrain/reports/health-demo.md",
	"sources/research-source.md",
	"entities/demo-person.md",
	"concepts/local-first.md",
	"summaries/demo-summary.md",
	"conversations/demo-chat.md",
] as const;

export const conflictingFrameworkPreviewCandidates: readonly FrameworkUpdatePreviewCandidate[] = [
	{
		path: "AGENTS.md",
		proposedContent: proposedAgentSurface,
		source: "duplicate-a",
	},
	{
		path: "./AGENTS.md",
		proposedContent: [
			"# AGENTS.md",
			"",
			"Different synthetic content creates a deterministic path collision.",
			"",
		].join("\n"),
		source: "duplicate-b",
	},
	{
		path: "src/agent/runtime-command-handlers.exe",
		proposedContent: "unsupported extension",
		source: "unsupported-extension",
	},
];

export const unsafeFrameworkPreviewCandidate = (): FrameworkUpdatePreviewCandidate => ({
	path: "docs/unsafe-framework-update.md",
	proposedContent: [
		"# Unsafe Candidate",
		"",
		["api", "_key", "=", "fake-value-for-conflict-tests"].join(""),
		["sk-", "fixture", "credential", "example", "000000000000"].join(""),
		["/ho", "me/example/vault.md"].join(""),
		"",
	].join("\n"),
	source: "synthetic-unsafe-content",
});

export const pathOnlyPreviewCandidates = [
	"AGENTS.md",
	"test/fixtures/vault/sources/demo-article.md",
	"../outside.md",
] as const;

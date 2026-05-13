import type { AgentCommand, AgentSurfaceDefinition } from "../../../src/types/agent-commands";

export const fixtureSurface: AgentSurfaceDefinition = {
	id: "agents-md",
	label: "Fixture agent surface",
	path: "AGENTS.md",
	required: true,
	requiredSafetyPhrases: [
		"local-first",
		"staged changes",
		"provider secrets",
		"synthetic fixtures",
		"citations",
		"dry-run",
		"recovery",
	],
};

export const completeSurfaceMarkdownForCommands = (commands: readonly AgentCommand[]): string =>
	[
		"# Fixture Agent Surface",
		"",
		"## Safety Policy",
		"",
		"local-first staged changes provider secrets synthetic fixtures citations dry-run recovery",
		"",
		"## Command Catalog",
		"",
		"| Command ID | Status | Notes |",
		"|------------|--------|-------|",
		...commands.map((command) => `| \`${command.id}\` | ${command.status} | Fixture-safe entry. |`),
	].join("\n");

export const surfaceMarkdownWithUnknownCommand = (commands: readonly AgentCommand[]): string =>
	`${completeSurfaceMarkdownForCommands(commands)}\n| \`voidbrain.unknown-command\` | planned | Drift. |`;

export const surfaceMarkdownWithStaleStatus = (
	commands: readonly AgentCommand[],
	commandId: string,
	staleStatus: string,
): string =>
	completeSurfaceMarkdownForCommands(commands).replace(
		`| \`${commandId}\` | ${commands.find((command) => command.id === commandId)?.status ?? "implemented"} |`,
		`| \`${commandId}\` | ${staleStatus} |`,
	);

export const unsafeFixtureExampleText = (): string =>
	[
		["api", "_key = demo"].join(""),
		["credential example ", "sk-", "1234567890abcdef12"].join(""),
		["private note path ", "/Users", "/demo", "/Vault/private.md"].join(""),
	].join("\n");

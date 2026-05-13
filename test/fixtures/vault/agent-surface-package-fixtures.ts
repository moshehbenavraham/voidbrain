import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AGENT_COMMAND_CATALOG, AGENT_SURFACES } from "../../../src/agent/command-catalog";
import type { AgentCommand, AgentSurfaceDefinition } from "../../../src/types/agent-commands";

export const AGENT_SURFACE_PACKAGE_FIXED_DATE = new Date("2026-05-13T00:00:00.000Z");

export const completePackageSurfaceMarkdown = (
	commands: readonly AgentCommand[] = AGENT_COMMAND_CATALOG,
	title = "Voidbrain Agent Surface",
): string =>
	[
		`# ${title}`,
		"",
		"## Safety Policy",
		"",
		"local-first staged changes provider secrets synthetic fixtures citations dry-run recovery",
		"",
		"## Command Catalog",
		"",
		"| Command ID | Status | Notes |",
		"|------------|--------|-------|",
		...commands.map((command) => `| \`${command.id}\` | ${command.status} | Package fixture entry. |`),
	].join("\n");

export const createPackageSurfaceContentMap = (
	surfaces: readonly AgentSurfaceDefinition[] = AGENT_SURFACES,
	commands: readonly AgentCommand[] = AGENT_COMMAND_CATALOG,
): ReadonlyMap<string, string> =>
	new Map(surfaces.map((surface) => [surface.path, completePackageSurfaceMarkdown(commands, surface.label)]));

export const writeAgentSurfacePackageFixtureRepository = async (
	repoRoot: string,
	overrides: Readonly<Record<string, string | undefined>> = {},
	surfaces: readonly AgentSurfaceDefinition[] = AGENT_SURFACES,
): Promise<void> => {
	const contents = createPackageSurfaceContentMap(surfaces);

	for (const surface of surfaces) {
		const content = overrides[surface.path] ?? contents.get(surface.path);
		if (content === undefined) {
			continue;
		}

		const absolutePath = join(repoRoot, surface.path);
		await mkdir(dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, content, "utf8");
	}
};

export const packageSurfaceWithUnknownCommand = (): string =>
	`${completePackageSurfaceMarkdown()}\n| \`voidbrain.unknown-package-command\` | planned | Drift. |`;

export const packageSurfaceWithStaleStatus = (): string =>
	completePackageSurfaceMarkdown().replace(
		"| `voidbrain.validate-agent-surfaces` | implemented |",
		"| `voidbrain.validate-agent-surfaces` | planned |",
	);

export const packageSurfaceWithUnsafeExample = (): string =>
	[
		completePackageSurfaceMarkdown(),
		["example ", "api", "_key = demo"].join(""),
		["credential ", "sk-", "1234567890abcdef12"].join(""),
		["private path ", "/Users", "/demo", "/Vault/private.md"].join(""),
		["system ", "prompt body: raw vault notes"].join(""),
	].join("\n");

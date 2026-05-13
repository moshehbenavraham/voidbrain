import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatAgentValidationIssue, sortAgentValidationIssues } from "../src/agent/agent-validation-reporting";
import { AGENT_COMMAND_CATALOG, AGENT_SURFACES, validateAgentCommandCatalog } from "../src/agent/command-catalog";
import { validateRepositoryScanPath } from "../src/agent/repository-scan-boundary";
import { type AgentSurfaceMarkdownInput, validateAgentSurfaces } from "../src/agent/surface-validation";
import type { AgentSurfaceDefinition, AgentValidationIssue } from "../src/types/agent-commands";

export interface AgentSurfaceValidationScriptResult {
	readonly inputs: readonly AgentSurfaceMarkdownInput[];
	readonly issues: readonly AgentValidationIssue[];
}

const allowedSurfaceExtensions = [".md"] as const;
const excludedSurfaceRoots = [
	".voidbrain",
	"EXAMPLES",
	"fixtures",
	"test/fixtures/vault",
	"vault",
	"sources",
	"entities",
	"concepts",
	"summaries",
	"conversations",
] as const;

const missingSurfaceIssue = (
	surface: AgentSurfaceDefinition,
	boundary: AgentValidationIssue["boundary"],
): AgentValidationIssue => ({
	code: "surface.missing-required-surface",
	message: `Required agent surface is missing: ${surface.path}`,
	surfaceId: surface.id,
	path: surface.path,
	heading: surface.label,
	remediation: "Restore the required agent surface or remove it from AGENT_SURFACES with an explicit catalog update.",
	boundary,
});

const unreadableSurfaceIssue = (
	surface: AgentSurfaceDefinition,
	error: unknown,
	boundary: AgentValidationIssue["boundary"],
): AgentValidationIssue => ({
	code: "surface.unreadable-required-surface",
	message: `Required agent surface could not be read: ${surface.path}`,
	surfaceId: surface.id,
	path: surface.path,
	heading: surface.label,
	remediation: `Fix file permissions or path validity before retrying. Read failure: ${error instanceof Error ? error.message : String(error)}`,
	boundary,
});

export const readAgentSurfaceInputs = (
	repoRoot = process.cwd(),
	surfaces: readonly AgentSurfaceDefinition[] = AGENT_SURFACES,
): AgentSurfaceValidationScriptResult => {
	const inputs: AgentSurfaceMarkdownInput[] = [];
	const issues: AgentValidationIssue[] = [];
	const allowedSurfacePaths = surfaces.map((surface) => surface.path);

	for (const surface of surfaces) {
		const boundaryResult = validateRepositoryScanPath(surface.path, {
			allowedRoots: [],
			allowedStandalonePaths: allowedSurfacePaths,
			allowedExtensions: allowedSurfaceExtensions,
			excludedRoots: excludedSurfaceRoots,
			issueCode: "surface.invalid-input",
			remediation: "Agent surfaces must be repository-relative markdown files declared in AGENT_SURFACES.",
		});

		if (!boundaryResult.ok) {
			issues.push({
				...boundaryResult.issue,
				surfaceId: surface.id,
				heading: surface.label,
			});
			continue;
		}

		const absolutePath = join(repoRoot, boundaryResult.path);
		if (!existsSync(absolutePath)) {
			if (surface.required) {
				issues.push(missingSurfaceIssue(surface, boundaryResult.boundary));
			}
			continue;
		}

		try {
			inputs.push({
				surface,
				markdown: readFileSync(absolutePath, "utf8"),
			});
		} catch (error) {
			if (surface.required) {
				issues.push(unreadableSurfaceIssue(surface, error, boundaryResult.boundary));
			}
		}
	}

	return {
		inputs,
		issues: sortAgentValidationIssues(issues),
	};
};

export const runAgentSurfaceValidationScript = (repoRoot = process.cwd()): AgentSurfaceValidationScriptResult => {
	const catalogResult = validateAgentCommandCatalog(AGENT_COMMAND_CATALOG);
	const { inputs, issues: fileIssues } = readAgentSurfaceInputs(repoRoot);
	const surfaceResult = validateAgentSurfaces(inputs, AGENT_COMMAND_CATALOG);
	const issues = [
		...(catalogResult.ok ? [] : catalogResult.issues),
		...fileIssues,
		...(surfaceResult.ok ? [] : surfaceResult.issues),
	];

	return {
		inputs,
		issues: sortAgentValidationIssues(issues),
	};
};

const runCli = (): void => {
	const { inputs, issues } = runAgentSurfaceValidationScript();

	if (issues.length > 0) {
		console.error(`Agent surface validation failed (${issues.length} issues).`);
		for (const issue of issues) {
			console.error(`- ${formatAgentValidationIssue(issue)}`);
		}
		process.exitCode = 1;
		return;
	}

	console.log("Agent surface validation passed.");
	console.log(`Surfaces checked: ${inputs.length}`);
	console.log(`Commands checked: ${AGENT_COMMAND_CATALOG.length}`);
};

if ((import.meta as ImportMeta & { main?: boolean }).main) {
	runCli();
}

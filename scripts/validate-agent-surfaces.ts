import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENT_COMMAND_CATALOG, AGENT_SURFACES, validateAgentCommandCatalog } from "../src/agent/command-catalog";
import { type AgentSurfaceMarkdownInput, validateAgentSurfaces } from "../src/agent/surface-validation";
import type { AgentValidationIssue } from "../src/types/agent-commands";

const repoRoot = process.cwd();

const formatIssue = (issue: AgentValidationIssue): string => {
	const locationParts = [issue.path, issue.line === undefined ? undefined : `line ${issue.line}`].filter(
		(part): part is string => part !== undefined,
	);
	const location = locationParts.length > 0 ? `${locationParts.join(": ")}: ` : "";
	const command = issue.commandId === undefined ? "" : ` [${issue.commandId}]`;
	return `${location}${issue.code}${command} - ${issue.message}`;
};

const missingSurfaceIssue = (path: string): AgentValidationIssue => ({
	code: "surface.invalid-input",
	message: `Required agent surface is missing: ${path}`,
	path,
});

const readSurfaceInputs = (): {
	readonly inputs: readonly AgentSurfaceMarkdownInput[];
	readonly issues: readonly AgentValidationIssue[];
} => {
	const inputs: AgentSurfaceMarkdownInput[] = [];
	const issues: AgentValidationIssue[] = [];

	for (const surface of AGENT_SURFACES) {
		const absolutePath = join(repoRoot, surface.path);
		if (!existsSync(absolutePath)) {
			if (surface.required) {
				issues.push(missingSurfaceIssue(surface.path));
			}
			continue;
		}

		inputs.push({
			surface,
			markdown: readFileSync(absolutePath, "utf8"),
		});
	}

	return { inputs, issues };
};

const catalogResult = validateAgentCommandCatalog(AGENT_COMMAND_CATALOG);
const { inputs, issues: fileIssues } = readSurfaceInputs();
const surfaceResult = validateAgentSurfaces(inputs, AGENT_COMMAND_CATALOG);
const issues = [
	...(catalogResult.ok ? [] : catalogResult.issues),
	...fileIssues,
	...(surfaceResult.ok ? [] : surfaceResult.issues),
].sort((left, right) => formatIssue(left).localeCompare(formatIssue(right)));

if (issues.length > 0) {
	console.error(`Agent surface validation failed (${issues.length} issues).`);
	for (const issue of issues) {
		console.error(`- ${formatIssue(issue)}`);
	}
	process.exitCode = 1;
} else {
	console.log("Agent surface validation passed.");
	console.log(`Surfaces checked: ${inputs.length}`);
	console.log(`Commands checked: ${AGENT_COMMAND_CATALOG.length}`);
}

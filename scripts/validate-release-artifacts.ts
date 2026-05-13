#!/usr/bin/env bun

import type { ReleaseValidationIssue, ReleaseValidationResult } from "../src/types/release";
import { validateReleaseArtifacts } from "../src/utils/release-artifacts";

export interface ReleaseArtifactValidationScriptResult {
	readonly result: ReleaseValidationResult;
	readonly exitCode: 0 | 1;
}

const usage = (): string => `Voidbrain release artifact validation

Usage:
  bun scripts/validate-release-artifacts.ts [--json]
  bun run validate:release-artifacts -- [--json]

Options:
  --json     Print the bounded diagnostic record as JSON.
  -h, --help Show this help.
`;

const formatIssue = (issue: ReleaseValidationIssue): string => {
	const location = [issue.path, issue.field].filter((value) => value !== undefined).join("#");
	return `[${issue.code}] ${location.length > 0 ? `${location}: ` : ""}${issue.message} ${issue.remediation}`;
};

const printHumanResult = (result: ReleaseValidationResult): void => {
	if (result.ok) {
		console.log("Release artifact validation passed.");
		console.log(`Artifacts checked: ${result.artifacts.length}`);
		for (const artifact of result.artifacts) {
			console.log(`- ${artifact.path}: ${artifact.sizeBytes} bytes, sha256 ${artifact.checksum.value}`);
		}
		return;
	}

	console.error(`Release artifact validation failed (${result.issues.length} issues).`);
	for (const issue of result.issues) {
		console.error(`- ${formatIssue(issue)}`);
	}
};

export const runReleaseArtifactValidationScript = async (
	repoRoot = process.cwd(),
	now?: Date,
): Promise<ReleaseArtifactValidationScriptResult> => {
	const result = await validateReleaseArtifacts(now === undefined ? { repoRoot } : { repoRoot, now });

	return {
		result,
		exitCode: result.ok ? 0 : 1,
	};
};

const runCli = async (args: readonly string[]): Promise<void> => {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(usage());
		return;
	}

	const asJson = args.includes("--json");
	const unknownArgs = args.filter((arg) => arg !== "--json");
	if (unknownArgs.length > 0) {
		console.error(`Release artifact validation failed: unknown option ${unknownArgs[0]}.`);
		console.error("Run with --help for options.");
		process.exitCode = 1;
		return;
	}

	const { result, exitCode } = await runReleaseArtifactValidationScript();
	if (asJson) {
		const output = result.diagnostic;
		console.log(JSON.stringify(output, null, 2));
	} else {
		printHumanResult(result);
	}

	process.exitCode = exitCode;
};

if ((import.meta as ImportMeta & { main?: boolean }).main) {
	try {
		await runCli(process.argv.slice(2));
	} catch (error) {
		const errorName = error instanceof Error ? error.name : "UnknownError";
		console.error(`Release artifact validation crashed: ${errorName}.`);
		process.exitCode = 2;
	}
}

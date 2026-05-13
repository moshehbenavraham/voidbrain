#!/usr/bin/env bun

import { planAgentSurfacePackage } from "../src/agent/agent-surface-packaging";
import { redactSensitiveValidationText } from "../src/agent/agent-validation-reporting";
import type { AgentSurfacePackageIssue, AgentSurfacePackagePlanningResult } from "../src/types/agent-surface-package";

export interface AgentSurfacePackageValidationScriptResult {
	readonly result: AgentSurfacePackagePlanningResult;
	readonly exitCode: 0 | 1;
}

interface ParsedArgs {
	readonly asJson: boolean;
	readonly surfacePaths: readonly string[];
	readonly outputPath?: string | undefined;
}

const usage = (): string => `Voidbrain agent surface package validation

Usage:
  bun scripts/validate-agent-surface-package.ts [--json] [--output build/agent-surfaces/manifest.json] [surface paths...]
  bun run validate:agent-surface-package -- [--json]

Options:
  --json       Print the bounded package diagnostic as JSON.
  --output     Validate a framework-owned manifest output path without writing it.
  -h, --help   Show this help.
`;

const parseArgs = (args: readonly string[]): ParsedArgs | string => {
	const surfacePaths: string[] = [];
	let asJson = false;
	let outputPath: string | undefined;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === undefined) {
			continue;
		}

		if (arg === "--json") {
			asJson = true;
			continue;
		}

		if (arg === "--output") {
			const next = args[index + 1];
			if (next === undefined) {
				return "Missing value for --output.";
			}
			outputPath = next;
			index += 1;
			continue;
		}

		if (arg.startsWith("-")) {
			return `Unknown option ${arg}.`;
		}

		surfacePaths.push(arg);
	}

	return {
		asJson,
		surfacePaths,
		outputPath,
	};
};

const formatIssue = (issue: AgentSurfacePackageIssue): string => {
	const location = [issue.path, issue.line].filter((value) => value !== undefined).join(":");
	const source = issue.sourceCode === undefined ? "" : ` (${issue.sourceCode})`;
	return `${location.length > 0 ? `${redactSensitiveValidationText(location)}: ` : ""}${issue.code}${source} - ${redactSensitiveValidationText(issue.message)} Remediation: ${redactSensitiveValidationText(issue.remediation)}`;
};

const printHumanResult = (result: AgentSurfacePackagePlanningResult): void => {
	if (result.ok) {
		console.log("Agent surface package validation passed.");
		console.log(`Surfaces checked: ${result.manifest.surfaces.length}`);
		for (const surface of result.manifest.surfaces) {
			console.log(
				`- ${surface.path}: ${surface.targetEcosystem}, sha256 ${surface.checksum?.value ?? "unreadable"}`,
			);
		}
		return;
	}

	console.error(`Agent surface package validation failed (${result.issues.length} issues).`);
	for (const issue of result.issues) {
		console.error(`- ${formatIssue(issue)}`);
	}
};

export const runAgentSurfacePackageValidationScript = (
	repoRoot = process.cwd(),
	args: readonly string[] = [],
	now?: Date,
): AgentSurfacePackageValidationScriptResult => {
	const parsedArgs = parseArgs(args);
	if (typeof parsedArgs === "string") {
		const result = planAgentSurfacePackage({
			repoRoot,
			surfacePaths: [],
			now,
		});
		return {
			result: result.ok
				? {
						ok: false,
						manifest: result.manifest,
						diagnostic: result.diagnostic,
						issues: [
							{
								code: "package.invalid-input",
								message: parsedArgs,
								remediation: "Run with --help for supported options.",
								path: "<args>",
							},
						],
					}
				: result,
			exitCode: 1,
		};
	}

	const result = planAgentSurfacePackage({
		repoRoot,
		surfacePaths: parsedArgs.surfacePaths.length > 0 ? parsedArgs.surfacePaths : undefined,
		outputPath: parsedArgs.outputPath,
		now,
	});

	return {
		result,
		exitCode: result.ok ? 0 : 1,
	};
};

const runCli = (args: readonly string[]): void => {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(usage());
		return;
	}

	const parsedArgs = parseArgs(args);
	if (typeof parsedArgs === "string") {
		console.error(`Agent surface package validation failed: ${parsedArgs}`);
		console.error("Run with --help for options.");
		process.exitCode = 1;
		return;
	}

	const { result, exitCode } = runAgentSurfacePackageValidationScript(process.cwd(), args);
	if (parsedArgs.asJson) {
		console.log(JSON.stringify(result.diagnostic, null, 2));
	} else {
		printHumanResult(result);
	}

	process.exitCode = exitCode;
};

if ((import.meta as ImportMeta & { main?: boolean }).main) {
	try {
		runCli(process.argv.slice(2));
	} catch (error) {
		const errorName = error instanceof Error ? error.name : "UnknownError";
		console.error(`Agent surface package validation crashed: ${errorName}.`);
		process.exitCode = 2;
	}
}

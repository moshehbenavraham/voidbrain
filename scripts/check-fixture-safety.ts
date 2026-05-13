import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { formatAgentValidationIssue, sortAgentValidationIssues } from "../src/agent/agent-validation-reporting";
import { AGENT_SURFACES } from "../src/agent/command-catalog";
import { validateFixtureSafetyEntries } from "../src/agent/fixture-safety";
import { uniqueRepositoryPaths, validateRepositoryScanPath } from "../src/agent/repository-scan-boundary";
import type { AgentValidationIssue, FixtureSafetyEntry } from "../src/types/agent-commands";

export interface FixtureSafetyScriptResult {
	readonly entries: readonly FixtureSafetyEntry[];
	readonly issues: readonly AgentValidationIssue[];
}

const allowedExtensions = [".md", ".json", ".ts", ".txt"] as const;
const boundedRoots = ["docs", "skills", "test/fixtures", "scripts"] as const;
const standaloneFiles = [
	"README.md",
	"src/README.md",
	"package.json",
	"src/types/agent-commands.ts",
	...AGENT_SURFACES.map((surface) => surface.path),
] as const;
const excludedRoots = [
	".voidbrain",
	"EXAMPLES",
	"vault",
	"fixtures",
	"sources",
	"entities",
	"concepts",
	"summaries",
	"conversations",
] as const;

const toRepositoryPath = (repoRoot: string, absolutePath: string): string =>
	relative(repoRoot, absolutePath).replace(/\\/g, "/");

const unreadableCandidateIssue = (
	path: string,
	error: unknown,
	boundary?: AgentValidationIssue["boundary"],
): AgentValidationIssue => ({
	code: "fixture.unreadable-scan-path",
	message: `Fixture safety scan candidate could not be read: ${path}`,
	path,
	remediation: `Fix file permissions or remove the candidate from the validation scan. Read failure: ${error instanceof Error ? error.message : String(error)}`,
	boundary,
});

const collectFiles = (repoRoot: string, relativeRoot: string, issues: AgentValidationIssue[]): readonly string[] => {
	const absoluteRoot = join(repoRoot, relativeRoot);
	if (!existsSync(absoluteRoot)) {
		return [];
	}

	const discovered: string[] = [];
	const pending = [absoluteRoot];

	while (pending.length > 0) {
		const current = pending.pop();
		if (current === undefined) {
			continue;
		}

		let stats: ReturnType<typeof statSync>;
		try {
			stats = statSync(current);
		} catch (error) {
			issues.push(unreadableCandidateIssue(toRepositoryPath(repoRoot, current), error));
			continue;
		}

		if (stats.isDirectory()) {
			try {
				for (const child of readdirSync(current)) {
					pending.push(join(current, child));
				}
			} catch (error) {
				issues.push(unreadableCandidateIssue(toRepositoryPath(repoRoot, current), error));
			}
			continue;
		}

		if (stats.isFile() && (allowedExtensions as readonly string[]).includes(extname(current))) {
			discovered.push(toRepositoryPath(repoRoot, current));
		}
	}

	return discovered;
};

const validateCandidatePaths = (paths: readonly string[]): FixtureSafetyScriptResult => {
	const entries: FixtureSafetyEntry[] = [];
	const issues: AgentValidationIssue[] = [];

	for (const path of uniqueRepositoryPaths(paths)) {
		const boundaryResult = validateRepositoryScanPath(path, {
			allowedRoots: boundedRoots,
			allowedStandalonePaths: standaloneFiles,
			allowedExtensions,
			excludedRoots,
			issueCode: "fixture.unsupported-scan-path",
			remediation: "Scan only framework docs, skills, scripts, source contracts, and synthetic fixtures.",
		});

		if (!boundaryResult.ok) {
			issues.push(boundaryResult.issue);
			continue;
		}

		entries.push({
			path: boundaryResult.path,
			content: "",
		});
	}

	return {
		entries,
		issues: sortAgentValidationIssues(issues),
	};
};

export const collectFixtureSafetyCandidatePaths = (
	repoRoot = process.cwd(),
	explicitCandidatePaths: readonly string[] = [],
): FixtureSafetyScriptResult => {
	const collectionIssues: AgentValidationIssue[] = [];
	const candidatePaths =
		explicitCandidatePaths.length > 0
			? explicitCandidatePaths
			: [
					...standaloneFiles.filter((path) => existsSync(join(repoRoot, path))),
					...boundedRoots.flatMap((root) => collectFiles(repoRoot, root, collectionIssues)),
				];
	const validationResult = validateCandidatePaths(candidatePaths);

	return {
		entries: validationResult.entries,
		issues: sortAgentValidationIssues([...collectionIssues, ...validationResult.issues]),
	};
};

export const readFixtureSafetyEntries = (
	repoRoot = process.cwd(),
	explicitCandidatePaths: readonly string[] = [],
): FixtureSafetyScriptResult => {
	const { entries: candidates, issues: candidateIssues } = collectFixtureSafetyCandidatePaths(
		repoRoot,
		explicitCandidatePaths,
	);
	const entries: FixtureSafetyEntry[] = [];
	const issues: AgentValidationIssue[] = [...candidateIssues];

	for (const candidate of candidates) {
		const boundaryResult = validateRepositoryScanPath(candidate.path, {
			allowedRoots: boundedRoots,
			allowedStandalonePaths: standaloneFiles,
			allowedExtensions,
			excludedRoots,
			issueCode: "fixture.unsupported-scan-path",
			remediation: "Scan only framework docs, skills, scripts, source contracts, and synthetic fixtures.",
		});
		const boundary = boundaryResult.ok ? boundaryResult.boundary : undefined;

		try {
			entries.push({
				path: candidate.path,
				content: readFileSync(join(repoRoot, candidate.path), "utf8"),
			});
		} catch (error) {
			issues.push(unreadableCandidateIssue(candidate.path, error, boundary));
		}
	}

	return {
		entries,
		issues: sortAgentValidationIssues(issues),
	};
};

export const runFixtureSafetyScript = (
	repoRoot = process.cwd(),
	explicitCandidatePaths: readonly string[] = [],
): FixtureSafetyScriptResult => {
	const { entries, issues: readIssues } = readFixtureSafetyEntries(repoRoot, explicitCandidatePaths);
	const result = validateFixtureSafetyEntries(entries);

	return {
		entries,
		issues: sortAgentValidationIssues([...(result.ok ? [] : result.issues), ...readIssues]),
	};
};

const runCli = (): void => {
	const { entries, issues } = runFixtureSafetyScript(process.cwd(), process.argv.slice(2));

	if (issues.length > 0) {
		console.error(`Fixture safety validation failed (${issues.length} issues).`);
		for (const issue of issues) {
			console.error(`- ${formatAgentValidationIssue(issue)}`);
		}
		process.exitCode = 1;
		return;
	}

	console.log("Fixture safety validation passed.");
	console.log(`Files checked: ${entries.length}`);
};

if ((import.meta as ImportMeta & { main?: boolean }).main) {
	runCli();
}

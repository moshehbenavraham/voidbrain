import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { AGENT_SURFACES } from "../src/agent/command-catalog";
import { validateFixtureSafetyEntries } from "../src/agent/fixture-safety";
import type { AgentValidationIssue, FixtureSafetyEntry } from "../src/types/agent-commands";

const repoRoot = process.cwd();
const allowedExtensions = new Set([".md", ".json", ".ts", ".txt"]);
const boundedRoots = ["docs", "test/fixtures", "skills"] as const;
const standaloneFiles = ["README.md", "src/README.md", ...AGENT_SURFACES.map((surface) => surface.path)] as const;

const toRepositoryPath = (absolutePath: string): string => relative(repoRoot, absolutePath).replace(/\\/g, "/");

const collectFiles = (relativeRoot: string): readonly string[] => {
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

		const stats = statSync(current);
		if (stats.isDirectory()) {
			for (const child of readdirSync(current)) {
				pending.push(join(current, child));
			}
			continue;
		}

		if (stats.isFile() && allowedExtensions.has(extname(current))) {
			discovered.push(toRepositoryPath(current));
		}
	}

	return discovered.sort((left, right) => left.localeCompare(right));
};

const candidatePaths = [
	...standaloneFiles.filter((path) => existsSync(join(repoRoot, path))),
	...boundedRoots.flatMap(collectFiles),
]
	.filter((path, index, paths) => paths.indexOf(path) === index)
	.sort((left, right) => left.localeCompare(right));

const entries: readonly FixtureSafetyEntry[] = candidatePaths.map((path) => ({
	path,
	content: readFileSync(join(repoRoot, path), "utf8"),
}));

const formatIssue = (issue: AgentValidationIssue): string => {
	const line = issue.line === undefined ? "" : `:${issue.line}`;
	return `${issue.path ?? "<unknown>"}${line}: ${issue.code} - ${issue.message}`;
};

const result = validateFixtureSafetyEntries(entries);
const issues = result.ok
	? []
	: [...result.issues].sort((left, right) => formatIssue(left).localeCompare(formatIssue(right)));

if (issues.length > 0) {
	console.error(`Fixture safety validation failed (${issues.length} issues).`);
	for (const issue of issues) {
		console.error(`- ${formatIssue(issue)}`);
	}
	process.exitCode = 1;
} else {
	console.log("Fixture safety validation passed.");
	console.log(`Files checked: ${entries.length}`);
}

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentCommandStatus, AgentSurfaceDefinition, AgentValidationIssue } from "../types/agent-commands";
import {
	AGENT_SURFACE_PACKAGE_SCRIPT_ID,
	type AgentSurfacePackageChecksum,
	type AgentSurfacePackageDiagnostic,
	type AgentSurfacePackageEcosystem,
	type AgentSurfacePackageEntry,
	type AgentSurfacePackageIssue,
	type AgentSurfacePackageManifest,
	type AgentSurfacePackagePlanningInput,
	type AgentSurfacePackagePlanningResult,
	type AgentSurfacePackageState,
} from "../types/agent-surface-package";
import { createRedactedLineExcerpt } from "./agent-validation-reporting";
import { AGENT_COMMAND_CATALOG, AGENT_SURFACES } from "./command-catalog";
import { scanFixtureSafetyText } from "./fixture-safety";
import { normalizeRepositoryPath, uniqueRepositoryPaths, validateRepositoryScanPath } from "./repository-scan-boundary";
import { getMarkdownLineContexts, validateAgentSurfaceMarkdown } from "./surface-validation";

const packageSurfaceAllowedExtensions = [".md"] as const;
const packageSurfaceExcludedRoots = [
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

const packageOutputAllowedRoots = ["build", "dist", "docs"] as const;
const packageOutputAllowedExtensions = [".json", ".md"] as const;
const packageSecretLikeKeyPattern = /\b(api[_-]?key|access[_-]?key|secret|token|password|authorization)\b\s*[:=]/i;
const packageCredentialLikeValuePattern =
	/\b(sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{20,})\b/;
const packagePrivatePathHintPattern =
	/(^|[\s"'(])((\/Users\/[A-Za-z0-9._-]+)|(\/home\/[A-Za-z0-9._-]+)|([A-Za-z]:\\Users\\[^\\\s]+))/;
const packagePromptBodyPattern = /\b(system|developer|user|assistant)\s+prompt\s+(body|text|content)\s*[:=]/i;
const packageHiddenProviderStatePattern = /\b(raw\s+hidden\s+provider\s+state|hidden[_ -]?provider[_ -]?state)\s*[:=]/i;

interface PackageSurfacePathValidation {
	readonly surface: AgentSurfaceDefinition;
	readonly path?: string | undefined;
	readonly issue?: AgentSurfacePackageIssue | undefined;
}

interface PackageCandidateValidationResult {
	readonly surfaces: readonly PackageSurfacePathValidation[];
	readonly issues: readonly AgentSurfacePackageIssue[];
}

interface LoadedAgentSurfacePackageSurface {
	readonly surface: AgentSurfaceDefinition;
	readonly path: string;
	readonly targetEcosystem: AgentSurfacePackageEcosystem;
	readonly content?: string | undefined;
	readonly issue?: AgentSurfacePackageIssue | undefined;
}

interface PackageSurfaceLoadResult {
	readonly surfaces: readonly LoadedAgentSurfacePackageSurface[];
	readonly issues: readonly AgentSurfacePackageIssue[];
}

interface PackageSurfaceValidationResult {
	readonly path: string;
	readonly commandIds: readonly string[];
	readonly issues: readonly AgentSurfacePackageIssue[];
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string");

const packageSurfacePaths = (surfaces: readonly AgentSurfaceDefinition[] = AGENT_SURFACES): readonly string[] =>
	uniqueRepositoryPaths(surfaces.map((surface) => surface.path));

const sortPackageIssues = (issues: readonly AgentSurfacePackageIssue[]): readonly AgentSurfacePackageIssue[] =>
	[
		...new Map(
			issues.map((issue) => [
				[issue.path ?? "", issue.line ?? 0, issue.code, issue.sourceCode ?? "", issue.message].join(":"),
				issue,
			]),
		).values(),
	].sort((left, right) => {
		const leftKey = `${left.path ?? ""}:${left.line ?? 0}:${left.code}:${left.message}`;
		const rightKey = `${right.path ?? ""}:${right.line ?? 0}:${right.code}:${right.message}`;
		return leftKey.localeCompare(rightKey);
	});

const packageIssueFromValidationIssue = (
	issue: AgentValidationIssue,
	code: AgentSurfacePackageIssue["code"],
	message = issue.message,
): AgentSurfacePackageIssue => ({
	code,
	message,
	remediation:
		issue.remediation ?? "Use repository-relative packageable agent surface paths declared in AGENT_SURFACES.",
	surfaceId: issue.surfaceId,
	path: issue.path,
	commandId: issue.commandId,
	line: issue.line,
	heading: issue.heading,
	excerpt: issue.excerpt,
	boundary: issue.boundary,
	sourceCode: issue.code,
});

const packageCatalogIssueFromValidationIssue = (issue: AgentValidationIssue): AgentSurfacePackageIssue =>
	packageIssueFromValidationIssue(
		issue,
		"package.stale-catalog",
		`Package surface catalog validation failed: ${issue.message}`,
	);

const packageUnsafeIssueFromValidationIssue = (issue: AgentValidationIssue): AgentSurfacePackageIssue =>
	packageIssueFromValidationIssue(
		issue,
		"package.unsafe-content",
		`Package surface fixture safety validation failed: ${issue.message}`,
	);

const packageIssue = (input: {
	readonly code: AgentSurfacePackageIssue["code"];
	readonly message: string;
	readonly remediation: string;
	readonly surface?: AgentSurfaceDefinition | undefined;
	readonly path?: string | undefined;
	readonly sourceCode?: AgentValidationIssue["code"] | undefined;
}): AgentSurfacePackageIssue => ({
	code: input.code,
	message: input.message,
	remediation: input.remediation,
	surfaceId: input.surface?.id,
	path: input.path ?? input.surface?.path,
	sourceCode: input.sourceCode,
});

const packageSafetyIssue = (
	path: string,
	line: number,
	heading: string | undefined,
	message: string,
	excerpt: string,
): AgentSurfacePackageIssue => ({
	code: "package.unsafe-content",
	message,
	remediation:
		"Replace package examples with synthetic placeholders and keep diagnostics free of private vault content, prompt bodies, provider secrets, and hidden provider state.",
	path,
	line,
	heading,
	excerpt: createRedactedLineExcerpt(excerpt),
});

export const classifyAgentSurfacePackageEcosystem = (path: string): AgentSurfacePackageEcosystem => {
	const normalizedPath = normalizeRepositoryPath(path);

	if (normalizedPath === "AGENTS.md") {
		return "codex";
	}

	if (normalizedPath === "CLAUDE.md") {
		return "claude-code";
	}

	if (normalizedPath === "GEMINI.md") {
		return "gemini-cli";
	}

	if (normalizedPath === "skills/voidbrain/SKILL.md") {
		return "voidbrain-skill";
	}

	if (normalizedPath === "docs/agent-surfaces-commands.md") {
		return "human-docs";
	}

	return "unknown";
};

export const validateAgentSurfacePackageInput = (
	input: unknown,
): AgentSurfacePackagePlanningInput | AgentSurfacePackageIssue => {
	if (!isRecord(input)) {
		return packageIssue({
			code: "package.invalid-input",
			message: "Agent surface package planning input must be an object.",
			remediation: "Call package planning with { repoRoot, surfacePaths, outputPath, now }.",
			path: "<input>",
		});
	}

	if (typeof input.repoRoot !== "string" || input.repoRoot.trim().length === 0) {
		return packageIssue({
			code: "package.invalid-input",
			message: "Agent surface package planning requires a repository root.",
			remediation: "Pass the current repository root as a non-empty string.",
			path: "<input>",
		});
	}

	if (input.surfacePaths !== undefined && !isStringArray(input.surfacePaths)) {
		return packageIssue({
			code: "package.invalid-input",
			message: "Agent surface package surfacePaths must be an array of strings.",
			remediation: "Pass repository-relative surface paths or omit surfacePaths to use AGENT_SURFACES.",
			path: "<input>",
		});
	}

	if (input.outputPath !== undefined && typeof input.outputPath !== "string") {
		return packageIssue({
			code: "package.invalid-input",
			message: "Agent surface package outputPath must be a repository-relative string.",
			remediation: "Pass a framework-owned build, dist, or docs path, or omit outputPath.",
			path: "<input>",
		});
	}

	return {
		repoRoot: input.repoRoot,
		surfacePaths: input.surfacePaths,
		outputPath: input.outputPath,
		now: input.now instanceof Date ? input.now : undefined,
	};
};

export const validateAgentSurfacePackageOutputPath = (
	outputPath: string | undefined,
): AgentSurfacePackageIssue | undefined => {
	if (outputPath === undefined) {
		return undefined;
	}

	const boundaryResult = validateRepositoryScanPath(outputPath, {
		allowedRoots: packageOutputAllowedRoots,
		allowedStandalonePaths: [],
		allowedExtensions: packageOutputAllowedExtensions,
		excludedRoots: packageSurfaceExcludedRoots,
		issueCode: "fixture.unsupported-scan-path",
		remediation: "Package output paths must stay under framework-owned build, dist, or docs roots.",
	});

	return boundaryResult.ok
		? undefined
		: packageIssueFromValidationIssue(
				boundaryResult.issue,
				"package.unsupported-output-path",
				`Agent surface package output path is unsupported: ${outputPath}`,
			);
};

export const scanAgentSurfacePackageContentSafety = (
	path: string,
	content: string,
): readonly AgentSurfacePackageIssue[] => {
	const issues: AgentSurfacePackageIssue[] = [];

	for (const context of getMarkdownLineContexts(content)) {
		if (packageSecretLikeKeyPattern.test(context.text)) {
			issues.push(
				packageSafetyIssue(
					path,
					context.line,
					context.heading,
					"Secret-like key assignment found in package surface content.",
					context.text,
				),
			);
		}

		if (packageCredentialLikeValuePattern.test(context.text)) {
			issues.push(
				packageSafetyIssue(
					path,
					context.line,
					context.heading,
					"Credential-like value found in package surface content.",
					context.text,
				),
			);
		}

		if (packagePrivatePathHintPattern.test(context.text)) {
			issues.push(
				packageSafetyIssue(
					path,
					context.line,
					context.heading,
					"Private path hint found in package surface content.",
					context.text,
				),
			);
		}

		if (packagePromptBodyPattern.test(context.text)) {
			issues.push(
				packageSafetyIssue(
					path,
					context.line,
					context.heading,
					"Raw prompt body marker found in package surface content.",
					context.text,
				),
			);
		}

		if (packageHiddenProviderStatePattern.test(context.text)) {
			issues.push(
				packageSafetyIssue(
					path,
					context.line,
					context.heading,
					"Hidden provider state marker found in package surface content.",
					context.text,
				),
			);
		}
	}

	return sortPackageIssues(issues);
};

export const validateAgentSurfacePackageCandidatePaths = (
	input: AgentSurfacePackagePlanningInput,
	surfaces: readonly AgentSurfaceDefinition[] = AGENT_SURFACES,
): PackageCandidateValidationResult => {
	const requestedPaths =
		input.surfacePaths === undefined ? packageSurfacePaths(surfaces) : uniqueRepositoryPaths(input.surfacePaths);
	const declaredSurfaceByPath = new Map(surfaces.map((surface) => [surface.path, surface]));
	const allowedSurfacePaths = packageSurfacePaths(surfaces);
	const selected: PackageSurfacePathValidation[] = [];
	const issues: AgentSurfacePackageIssue[] = [];

	for (const requestedPath of requestedPaths) {
		const normalizedPath = normalizeRepositoryPath(requestedPath);
		const surface = normalizedPath === undefined ? undefined : declaredSurfaceByPath.get(normalizedPath);

		if (surface === undefined) {
			issues.push(
				packageIssue({
					code: "package.unsupported-path",
					message: `Agent surface package path is not declared as packageable: ${requestedPath}`,
					remediation: "Use a repository-relative path from AGENT_SURFACES.",
					path: normalizedPath ?? requestedPath,
				}),
			);
			continue;
		}

		const boundaryResult = validateRepositoryScanPath(surface.path, {
			allowedRoots: [],
			allowedStandalonePaths: allowedSurfacePaths,
			allowedExtensions: packageSurfaceAllowedExtensions,
			excludedRoots: packageSurfaceExcludedRoots,
			issueCode: "fixture.unsupported-scan-path",
			remediation: "Packageable surfaces must be declared repository markdown files.",
		});

		if (!boundaryResult.ok) {
			const issue = packageIssueFromValidationIssue(boundaryResult.issue, "package.unsupported-path");
			selected.push({ surface, issue });
			issues.push(issue);
			continue;
		}

		selected.push({ surface, path: boundaryResult.path });
	}

	return {
		surfaces: selected,
		issues,
	};
};

const sortLoadedPackageSurfaces = (
	surfaces: readonly LoadedAgentSurfacePackageSurface[],
): readonly LoadedAgentSurfacePackageSurface[] =>
	[...surfaces].sort((left, right) => left.path.localeCompare(right.path));

const missingSurfaceIssue = (surface: AgentSurfaceDefinition, path: string): AgentSurfacePackageIssue =>
	packageIssue({
		code: "package.missing-surface",
		message: `Required agent package surface is missing: ${path}`,
		remediation: "Restore the declared packageable surface before planning a package manifest.",
		surface,
		path,
	});

const unreadableSurfaceIssue = (
	surface: AgentSurfaceDefinition,
	path: string,
	error: unknown,
): AgentSurfacePackageIssue =>
	packageIssue({
		code: "package.unreadable-surface",
		message: `Agent package surface could not be read: ${path}`,
		remediation: `Fix file permissions or restore the surface before retrying. Read failure: ${error instanceof Error ? error.message : String(error)}`,
		surface,
		path,
	});

export const loadAgentSurfacePackageSurfaces = (
	input: AgentSurfacePackagePlanningInput,
	surfaces: readonly AgentSurfaceDefinition[] = AGENT_SURFACES,
): PackageSurfaceLoadResult => {
	const candidateResult = validateAgentSurfacePackageCandidatePaths(input, surfaces);
	const loadedSurfaces: LoadedAgentSurfacePackageSurface[] = [];
	const issues: AgentSurfacePackageIssue[] = [...candidateResult.issues];

	for (const candidate of candidateResult.surfaces) {
		const path = candidate.path ?? candidate.surface.path;
		const targetEcosystem = classifyAgentSurfacePackageEcosystem(path);

		if (candidate.issue !== undefined) {
			loadedSurfaces.push({
				surface: candidate.surface,
				path,
				targetEcosystem,
				issue: candidate.issue,
			});
			continue;
		}

		const absolutePath = join(input.repoRoot, path);
		if (!existsSync(absolutePath)) {
			const issue = missingSurfaceIssue(candidate.surface, path);
			issues.push(issue);
			loadedSurfaces.push({
				surface: candidate.surface,
				path,
				targetEcosystem,
				issue,
			});
			continue;
		}

		try {
			loadedSurfaces.push({
				surface: candidate.surface,
				path,
				targetEcosystem,
				content: readFileSync(absolutePath, "utf8"),
			});
		} catch (error) {
			const issue = unreadableSurfaceIssue(candidate.surface, path, error);
			issues.push(issue);
			loadedSurfaces.push({
				surface: candidate.surface,
				path,
				targetEcosystem,
				issue,
			});
		}
	}

	return {
		surfaces: sortLoadedPackageSurfaces(loadedSurfaces),
		issues: sortPackageIssues(issues),
	};
};

export const createAgentSurfacePackageChecksum = (content: string): AgentSurfacePackageChecksum => ({
	algorithm: "sha256",
	value: createHash("sha256").update(content).digest("hex"),
});

const commandCatalogStatuses = (): readonly AgentCommandStatus[] =>
	[...new Set(AGENT_COMMAND_CATALOG.map((command) => command.status))].sort((left, right) =>
		left.localeCompare(right),
	);

const commandCatalogStatus = (): AgentSurfacePackageEntry["commandCatalogStatus"] => {
	const statuses = commandCatalogStatuses();
	const firstStatus = statuses[0];

	if (firstStatus === undefined) {
		return "unknown";
	}

	return statuses.length === 1 ? firstStatus : "mixed";
};

const stateForPackageIssues = (issues: readonly AgentSurfacePackageIssue[]): AgentSurfacePackageState => {
	if (issues.length === 0) {
		return "ready";
	}

	if (issues.some((issue) => issue.code === "package.missing-surface")) {
		return "missing-surface";
	}

	if (
		issues.some(
			(issue) => issue.code === "package.unsupported-path" || issue.code === "package.unsupported-output-path",
		)
	) {
		return "unsupported-path";
	}

	if (issues.some((issue) => issue.code === "package.unsafe-content")) {
		return "unsafe-content";
	}

	if (issues.some((issue) => issue.code === "package.stale-catalog")) {
		return "stale-catalog";
	}

	return "blocked";
};

const recoveryDetailsForSurface = (
	loadedSurface: LoadedAgentSurfacePackageSurface,
	issues: readonly AgentSurfacePackageIssue[],
	checksum: AgentSurfacePackageChecksum | undefined,
) => {
	const firstIssue = issues[0];
	return {
		scriptId: AGENT_SURFACE_PACKAGE_SCRIPT_ID,
		surfaceId: loadedSurface.surface.id,
		targetEcosystem: loadedSurface.targetEcosystem,
		path: loadedSurface.path,
		checksum,
		issueCode: firstIssue?.code,
		validationContext:
			firstIssue === undefined
				? "package surface manifest entry validated"
				: "package surface manifest entry blocked by validation issue",
	};
};

const packageEntryForLoadedSurface = (
	loadedSurface: LoadedAgentSurfacePackageSurface,
	issues: readonly AgentSurfacePackageIssue[],
	commandIds: readonly string[],
): AgentSurfacePackageEntry => {
	const checksum =
		loadedSurface.content === undefined ? undefined : createAgentSurfacePackageChecksum(loadedSurface.content);
	const sizeBytes =
		loadedSurface.content === undefined ? undefined : Buffer.byteLength(loadedSurface.content, "utf8");

	return {
		surfaceId: loadedSurface.surface.id,
		label: loadedSurface.surface.label,
		targetEcosystem: loadedSurface.targetEcosystem,
		path: loadedSurface.path,
		required: loadedSurface.surface.required,
		state: stateForPackageIssues(issues),
		commandCatalogStatus: commandCatalogStatus(),
		commandIds,
		checksum,
		sizeBytes,
		issues: sortPackageIssues(issues),
		recovery: recoveryDetailsForSurface(loadedSurface, issues, checksum),
	};
};

export const validateLoadedAgentSurfaceForPackage = (
	loadedSurface: LoadedAgentSurfacePackageSurface,
): PackageSurfaceValidationResult => {
	if (loadedSurface.content === undefined) {
		return {
			path: loadedSurface.path,
			commandIds: [],
			issues: [],
		};
	}

	const report = validateAgentSurfaceMarkdown({
		surface: loadedSurface.surface,
		markdown: loadedSurface.content,
		commands: AGENT_COMMAND_CATALOG,
	});

	return {
		path: loadedSurface.path,
		commandIds: report.commandIds,
		issues: report.issues.map(packageCatalogIssueFromValidationIssue),
	};
};

export const scanLoadedAgentSurfaceFixtureSafetyForPackage = (
	loadedSurface: LoadedAgentSurfacePackageSurface,
): PackageSurfaceValidationResult => {
	if (loadedSurface.content === undefined) {
		return {
			path: loadedSurface.path,
			commandIds: [],
			issues: [],
		};
	}

	const report = scanFixtureSafetyText(loadedSurface.path, loadedSurface.content);

	return {
		path: loadedSurface.path,
		commandIds: [],
		issues: report.issues.map(packageUnsafeIssueFromValidationIssue),
	};
};

const mergePackageIssueResults = (
	loadedSurfaces: readonly LoadedAgentSurfacePackageSurface[],
): readonly PackageSurfaceValidationResult[] => [
	...loadedSurfaces.map(validateLoadedAgentSurfaceForPackage),
	...loadedSurfaces.map(scanLoadedAgentSurfaceFixtureSafetyForPackage),
	...loadedSurfaces.map((loadedSurface) => ({
		path: loadedSurface.path,
		commandIds: [],
		issues:
			loadedSurface.content === undefined
				? []
				: scanAgentSurfacePackageContentSafety(loadedSurface.path, loadedSurface.content),
	})),
];

export const createAgentSurfacePackageManifest = (
	loadedSurfaces: readonly LoadedAgentSurfacePackageSurface[],
	issues: readonly AgentSurfacePackageIssue[],
	now = new Date(),
): AgentSurfacePackageManifest => {
	const validationResults = mergePackageIssueResults(loadedSurfaces);
	const commandIdsByPath = new Map(
		loadedSurfaces.map((loadedSurface) => [
			loadedSurface.path,
			validateLoadedAgentSurfaceForPackage(loadedSurface).commandIds,
		]),
	);
	const allIssues = sortPackageIssues([...issues, ...validationResults.flatMap((result) => result.issues)]);
	const issuesByPath = new Map<string, AgentSurfacePackageIssue[]>();
	for (const issue of allIssues) {
		const path = issue.path ?? "<unknown>";
		issuesByPath.set(path, [...(issuesByPath.get(path) ?? []), issue]);
	}

	const entries = sortLoadedPackageSurfaces(loadedSurfaces).map((loadedSurface) =>
		packageEntryForLoadedSurface(
			loadedSurface,
			issuesByPath.get(loadedSurface.path) ?? [],
			commandIdsByPath.get(loadedSurface.path) ?? [],
		),
	);
	const manifestIssues = allIssues;

	return {
		scriptId: AGENT_SURFACE_PACKAGE_SCRIPT_ID,
		generatedAt: now.toISOString(),
		surfaces: entries,
		commandCatalog: {
			commandCount: AGENT_COMMAND_CATALOG.length,
			statuses: commandCatalogStatuses(),
			checksum: createAgentSurfacePackageChecksum(
				JSON.stringify(
					AGENT_COMMAND_CATALOG.map((command) => ({
						id: command.id,
						status: command.status,
						supportedSurfaces: command.supportedSurfaces,
					})),
				),
			),
		},
		issues: manifestIssues,
	};
};

export const createAgentSurfacePackageDiagnostic = (
	manifest: AgentSurfacePackageManifest,
): AgentSurfacePackageDiagnostic => ({
	scriptId: AGENT_SURFACE_PACKAGE_SCRIPT_ID,
	generatedAt: manifest.generatedAt,
	ready: manifest.issues.length === 0 && manifest.surfaces.every((surface) => surface.state === "ready"),
	surfaceCount: manifest.surfaces.length,
	issues: manifest.issues,
	manifest,
});

export const planAgentSurfacePackage = (
	input: unknown = { repoRoot: process.cwd() },
	surfaces: readonly AgentSurfaceDefinition[] = AGENT_SURFACES,
): AgentSurfacePackagePlanningResult => {
	const validatedInput = validateAgentSurfacePackageInput(input);
	const now = isRecord(input) && input.now instanceof Date ? input.now : new Date();

	if ("code" in validatedInput) {
		const manifest = createAgentSurfacePackageManifest([], [validatedInput], now);
		const diagnostic = createAgentSurfacePackageDiagnostic(manifest);
		return {
			ok: false,
			manifest,
			diagnostic,
			issues: diagnostic.issues,
		};
	}

	const outputPathIssue = validateAgentSurfacePackageOutputPath(validatedInput.outputPath);
	const loadResult = loadAgentSurfacePackageSurfaces(validatedInput, surfaces);
	const manifest = createAgentSurfacePackageManifest(
		loadResult.surfaces,
		outputPathIssue === undefined ? loadResult.issues : [...loadResult.issues, outputPathIssue],
		validatedInput.now ?? now,
	);
	const diagnostic = createAgentSurfacePackageDiagnostic(manifest);

	if (diagnostic.ready) {
		return {
			ok: true,
			manifest,
			diagnostic,
		};
	}

	return {
		ok: false,
		manifest,
		diagnostic,
		issues: diagnostic.issues,
	};
};

import { createHash } from "node:crypto";
import type {
	AgentValidationIssue,
	FrameworkUpdatePreviewAction,
	FrameworkUpdatePreviewActionType,
	FrameworkUpdatePreviewCandidate,
	FrameworkUpdatePreviewConflict,
	FrameworkUpdatePreviewContentHash,
	FrameworkUpdatePreviewCurrentFile,
	FrameworkUpdatePreviewCurrentFileReadFailure,
	FrameworkUpdatePreviewInput,
	FrameworkUpdatePreviewPlan,
	FrameworkUpdatePreviewRecoveryDetails,
} from "../types/agent-commands";
import { redactSensitiveValidationText, sortAgentValidationIssues } from "./agent-validation-reporting";
import { scanFixtureSafetyText } from "./fixture-safety";
import {
	isRepositoryPathWithinRoot,
	normalizeRepositoryPath,
	validateRepositoryScanPath,
} from "./repository-scan-boundary";

export type FrameworkUpdatePreviewCurrentFileReadResult =
	| {
			readonly status: "found";
			readonly content: string;
	  }
	| {
			readonly status: "missing";
	  }
	| {
			readonly status: "failed";
			readonly message: string;
	  };

export type FrameworkUpdatePreviewCurrentFileReader = (
	path: string,
	rootDir: string,
) => Promise<FrameworkUpdatePreviewCurrentFileReadResult> | FrameworkUpdatePreviewCurrentFileReadResult;

export interface FrameworkUpdatePreviewPlannerOptions {
	readonly now?: () => Date;
	readonly beforePlan?: () => Promise<void> | void;
	readonly readCurrentFile?: FrameworkUpdatePreviewCurrentFileReader;
}

export interface FrameworkUpdatePreviewPlanner {
	plan(input: FrameworkUpdatePreviewInput): Promise<FrameworkUpdatePreviewPlan>;
}

interface AcceptedFrameworkUpdatePath {
	readonly ok: true;
	readonly path: string;
}

interface RejectedFrameworkUpdatePath {
	readonly ok: false;
	readonly path: string;
	readonly action: "conflict" | "excluded";
	readonly issue: AgentValidationIssue;
	readonly conflict?: FrameworkUpdatePreviewConflict;
}

export type FrameworkUpdatePathClassification = AcceptedFrameworkUpdatePath | RejectedFrameworkUpdatePath;

const commandId = "voidbrain.preview-framework-update" as const;

const defaultFrameworkPaths = [
	"AGENTS.md",
	"CLAUDE.md",
	"GEMINI.md",
	"README.md",
	"docs/agent-surfaces-commands.md",
	"skills/voidbrain/SKILL.md",
	"src/agent/index.ts",
	"src/types/agent-commands.ts",
] as const;

const allowedFrameworkRoots = ["docs", "scripts", "skills", "src", "test"] as const;

const allowedFrameworkStandalonePaths = [
	"AGENTS.md",
	"CLAUDE.md",
	"GEMINI.md",
	"README.md",
	"biome.json",
	"manifest.json",
	"package.json",
	"svelte.config.ts",
	"tsconfig.json",
	"versions.json",
	"vite.config.ts",
] as const;

const allowedFrameworkExtensions = [
	".css",
	".cjs",
	".js",
	".json",
	".md",
	".mjs",
	".svelte",
	".toml",
	".ts",
	".yaml",
	".yml",
] as const;

const excludedUserContentRoots = [
	"EXAMPLES",
	"vault",
	"sources",
	"entities",
	"concepts",
	"summaries",
	"conversations",
	".voidbrain",
	"test/fixtures/vault",
] as const;

const providerSecretFileNames = new Set([
	".env",
	".env.development",
	".env.local",
	".env.production",
	".npmrc",
	"credentials.json",
	"provider-secrets.json",
	"secrets.json",
	"tokens.json",
]);

const actionOrder: Readonly<Record<FrameworkUpdatePreviewActionType, number>> = {
	excluded: 0,
	conflict: 1,
	create: 2,
	update: 3,
	skip: 4,
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) && value.every((path) => typeof path === "string");

const isPreviewCandidate = (value: unknown): value is FrameworkUpdatePreviewCandidate =>
	isRecord(value) &&
	typeof value.path === "string" &&
	(value.proposedContent === undefined || typeof value.proposedContent === "string") &&
	(value.source === undefined || typeof value.source === "string");

const isCurrentFile = (value: unknown): value is FrameworkUpdatePreviewCurrentFile =>
	isRecord(value) && typeof value.path === "string" && typeof value.content === "string";

const isCurrentFileReadFailure = (value: unknown): value is FrameworkUpdatePreviewCurrentFileReadFailure =>
	isRecord(value) && typeof value.path === "string" && typeof value.message === "string";

const isPreviewInput = (value: unknown): value is FrameworkUpdatePreviewInput =>
	isRecord(value) &&
	typeof value.rootDir === "string" &&
	(value.candidatePaths === undefined || isStringArray(value.candidatePaths)) &&
	(value.candidates === undefined ||
		(Array.isArray(value.candidates) && value.candidates.every(isPreviewCandidate))) &&
	(value.currentFiles === undefined ||
		(Array.isArray(value.currentFiles) && value.currentFiles.every(isCurrentFile))) &&
	(value.currentFileReadFailures === undefined ||
		(Array.isArray(value.currentFileReadFailures) &&
			value.currentFileReadFailures.every(isCurrentFileReadFailure))) &&
	(value.now === undefined || value.now instanceof Date);

const toIsoString = (date: Date): string => date.toISOString();

export const createPreviewContentHash = (content: string): FrameworkUpdatePreviewContentHash => ({
	algorithm: "sha256",
	value: createHash("sha256").update(content).digest("hex"),
});

const fileNameForPath = (path: string): string => path.split("/").pop() ?? path;

const isProviderSecretPath = (path: string): boolean => {
	const fileName = fileNameForPath(path);
	return (
		providerSecretFileNames.has(fileName) ||
		path.includes("/.secrets/") ||
		path.includes("/secrets/") ||
		path.includes("/credentials/")
	);
};

const isPrivateDiagnosticPath = (path: string): boolean =>
	path.endsWith(".log") ||
	isRepositoryPathWithinRoot(path, "diagnostics") ||
	isRepositoryPathWithinRoot(path, "logs") ||
	isRepositoryPathWithinRoot(path, ".voidbrain/reports") ||
	isRepositoryPathWithinRoot(path, ".voidbrain/cache");

const isExcludedUserContentPath = (path: string): boolean =>
	excludedUserContentRoots.some((root) => isRepositoryPathWithinRoot(path, root)) ||
	isProviderSecretPath(path) ||
	isPrivateDiagnosticPath(path);

const makeRecoveryDetails = (
	path: string,
	action: FrameworkUpdatePreviewActionType,
	validationContext: string,
	issueCode?: AgentValidationIssue["code"],
): FrameworkUpdatePreviewRecoveryDetails => ({
	commandId,
	targetPath: path,
	action,
	validationContext,
	...(issueCode === undefined ? {} : { issueCode }),
});

const makeAction = (input: {
	readonly path: string;
	readonly action: FrameworkUpdatePreviewActionType;
	readonly reason: string;
	readonly proposedHash?: FrameworkUpdatePreviewContentHash | undefined;
	readonly currentHash?: FrameworkUpdatePreviewContentHash | undefined;
	readonly conflict?: FrameworkUpdatePreviewConflict | undefined;
	readonly issueCode?: AgentValidationIssue["code"] | undefined;
	readonly validationContext?: string;
}): FrameworkUpdatePreviewAction => ({
	path: input.path,
	action: input.action,
	reason: input.reason,
	...(input.proposedHash === undefined ? {} : { proposedHash: input.proposedHash }),
	...(input.currentHash === undefined ? {} : { currentHash: input.currentHash }),
	...(input.conflict === undefined ? {} : { conflict: input.conflict }),
	recovery: makeRecoveryDetails(
		input.path,
		input.action,
		input.validationContext ?? "Framework update preview was dry-run only; no files were written.",
		input.issueCode,
	),
});

const issueForPath = (
	code: AgentValidationIssue["code"],
	path: string,
	message: string,
	remediation: string,
): AgentValidationIssue => ({
	code,
	message: redactSensitiveValidationText(message),
	path: redactSensitiveValidationText(path),
	remediation,
});

const conflictForIssue = (
	kind: FrameworkUpdatePreviewConflict["kind"],
	issue: AgentValidationIssue,
	message = issue.message,
): FrameworkUpdatePreviewConflict => ({
	kind,
	issueCode: issue.code,
	message: redactSensitiveValidationText(message),
});

export const normalizeFrameworkUpdateCandidatePath = (candidatePath: string): string | undefined =>
	normalizeRepositoryPath(candidatePath);

export const classifyFrameworkUpdateCandidatePath = (candidatePath: string): FrameworkUpdatePathClassification => {
	const normalizedPath = normalizeFrameworkUpdateCandidatePath(candidatePath);

	if (normalizedPath === undefined) {
		const path = redactSensitiveValidationText(candidatePath);
		const issue = issueForPath(
			"framework.invalid-input",
			path,
			`Framework update candidate must be repository-relative and stay inside the repository: ${path}`,
			"Use a repository-relative framework path without absolute segments or parent traversal.",
		);
		return {
			ok: false,
			path,
			action: "conflict",
			issue,
			conflict: conflictForIssue("unsupported-path", issue),
		};
	}

	if (isExcludedUserContentPath(normalizedPath)) {
		const issue = issueForPath(
			"framework.user-content-target",
			normalizedPath,
			`Framework update preview excluded user-owned or private support path ${normalizedPath}.`,
			"Use framework-owned documentation, script, skill, source, or test paths only.",
		);
		return {
			ok: false,
			path: normalizedPath,
			action: "excluded",
			issue,
		};
	}

	const boundary = validateRepositoryScanPath(normalizedPath, {
		allowedRoots: allowedFrameworkRoots,
		allowedStandalonePaths: allowedFrameworkStandalonePaths,
		allowedExtensions: allowedFrameworkExtensions,
		issueCode: "framework.unsupported-path",
		remediation: "Use framework-owned markdown, TypeScript, Svelte, JSON, CSS, YAML, or script paths only.",
	});

	if (!boundary.ok) {
		return {
			ok: false,
			path: normalizedPath,
			action: "conflict",
			issue: boundary.issue,
			conflict: conflictForIssue("unsupported-path", boundary.issue),
		};
	}

	return {
		ok: true,
		path: boundary.path,
	};
};

const candidatePathRecords = (input: FrameworkUpdatePreviewInput): readonly FrameworkUpdatePreviewCandidate[] => {
	const pathCandidates =
		input.candidatePaths?.map((path): FrameworkUpdatePreviewCandidate => ({ path, source: "path-argument" })) ?? [];
	const richCandidates = input.candidates ?? [];
	const candidates = [...pathCandidates, ...richCandidates];

	if (candidates.length > 0) {
		return candidates;
	}

	return defaultFrameworkPaths.map(
		(path): FrameworkUpdatePreviewCandidate => ({
			path,
			source: "default-framework-path",
		}),
	);
};

const currentFileMap = (input: FrameworkUpdatePreviewInput): ReadonlyMap<string, FrameworkUpdatePreviewCurrentFile> => {
	const files = new Map<string, FrameworkUpdatePreviewCurrentFile>();
	for (const file of input.currentFiles ?? []) {
		const normalizedPath = normalizeFrameworkUpdateCandidatePath(file.path);
		if (normalizedPath !== undefined && !files.has(normalizedPath)) {
			files.set(normalizedPath, {
				path: normalizedPath,
				content: file.content,
			});
		}
	}
	return files;
};

const readFailureMap = (
	input: FrameworkUpdatePreviewInput,
): ReadonlyMap<string, FrameworkUpdatePreviewCurrentFileReadFailure> => {
	const failures = new Map<string, FrameworkUpdatePreviewCurrentFileReadFailure>();
	for (const failure of input.currentFileReadFailures ?? []) {
		const normalizedPath = normalizeFrameworkUpdateCandidatePath(failure.path);
		if (normalizedPath !== undefined && !failures.has(normalizedPath)) {
			failures.set(normalizedPath, {
				path: normalizedPath,
				message: redactSensitiveValidationText(failure.message),
			});
		}
	}
	return failures;
};

export const sortFrameworkUpdatePreviewActions = (
	actions: readonly FrameworkUpdatePreviewAction[],
): readonly FrameworkUpdatePreviewAction[] =>
	[...actions].sort((left, right) => {
		const byPath = left.path.localeCompare(right.path);
		if (byPath !== 0) {
			return byPath;
		}

		const byAction = actionOrder[left.action] - actionOrder[right.action];
		if (byAction !== 0) {
			return byAction;
		}

		return left.reason.localeCompare(right.reason);
	});

const sortPaths = (paths: readonly string[]): readonly string[] =>
	[...new Set(paths)].sort((left, right) => left.localeCompare(right));

const unsafeContentIssues = (path: string, proposedContent: string): readonly AgentValidationIssue[] =>
	scanFixtureSafetyText(path, proposedContent).issues.map((issue) => ({
		code: "framework.unsafe-content",
		message: `Framework update candidate content failed safety scan: ${issue.message}.`,
		path,
		line: issue.line,
		heading: issue.heading,
		excerpt: issue.excerpt,
		remediation: "Remove credential-like values and private path hints before previewing framework changes.",
	}));

const buildInvalidInputPlan = (): FrameworkUpdatePreviewPlan => ({
	dryRun: true,
	commandId,
	generatedAt: toIsoString(new Date()),
	actions: [],
	excludedUserContentPaths: [],
	issues: [
		{
			code: "framework.invalid-input",
			message:
				"Framework update preview expects rootDir plus optional repository-relative candidatePaths or candidate records.",
			path: "<input>",
		},
	],
});

const addIssue = (issues: AgentValidationIssue[], issue: AgentValidationIssue): void => {
	issues.push({
		...issue,
		message: redactSensitiveValidationText(issue.message),
		path: issue.path === undefined ? undefined : redactSensitiveValidationText(issue.path),
	});
};

const planAcceptedCandidate = (
	path: string,
	proposedContent: string | undefined,
	currentFile: FrameworkUpdatePreviewCurrentFile | undefined,
	readFailure: FrameworkUpdatePreviewCurrentFileReadFailure | undefined,
): {
	readonly action: FrameworkUpdatePreviewAction;
	readonly issue?: AgentValidationIssue;
} => {
	if (readFailure !== undefined) {
		const issue = issueForPath(
			"framework.current-file-read-failed",
			path,
			`Framework update preview could not read current repository file ${path}: ${readFailure.message}`,
			"Inspect repository permissions and retry the dry-run preview.",
		);
		return {
			action: makeAction({
				path,
				action: "conflict",
				reason: "Current repository file could not be read.",
				conflict: conflictForIssue("current-file-read-failed", issue),
				issueCode: issue.code,
			}),
			issue,
		};
	}

	const currentHash = currentFile === undefined ? undefined : createPreviewContentHash(currentFile.content);
	const proposedHash = proposedContent === undefined ? undefined : createPreviewContentHash(proposedContent);

	if (proposedContent === undefined) {
		if (currentFile === undefined) {
			const issue = issueForPath(
				"framework.invalid-input",
				path,
				`Framework update preview has no proposed content and no current repository file for ${path}.`,
				"Pass proposed content for creates or use an existing framework file path.",
			);
			return {
				action: makeAction({
					path,
					action: "conflict",
					reason: "Missing comparison input for dry-run planning.",
					conflict: conflictForIssue("missing-comparison-input", issue),
					issueCode: issue.code,
				}),
				issue,
			};
		}

		return {
			action: makeAction({
				path,
				action: "skip",
				reason: "No proposed content supplied; current framework file was inspected for dry-run only.",
				currentHash,
			}),
		};
	}

	if (currentFile === undefined) {
		return {
			action: makeAction({
				path,
				action: "create",
				reason: "Proposed framework file does not exist in the repository.",
				proposedHash,
			}),
		};
	}

	if (currentHash?.value === proposedHash?.value) {
		return {
			action: makeAction({
				path,
				action: "skip",
				reason: "Proposed framework content is identical to the current repository file.",
				currentHash,
				proposedHash,
			}),
		};
	}

	return {
		action: makeAction({
			path,
			action: "update",
			reason: "Proposed framework content differs from the current repository file.",
			currentHash,
			proposedHash,
		}),
	};
};

export const planFrameworkUpdatePreview = (input: unknown): FrameworkUpdatePreviewPlan => {
	if (!isPreviewInput(input)) {
		return buildInvalidInputPlan();
	}

	const generatedAt = toIsoString(input.now ?? new Date());
	const actions: FrameworkUpdatePreviewAction[] = [];
	const excludedUserContentPaths: string[] = [];
	const issues: AgentValidationIssue[] = [];
	const currentFiles = currentFileMap(input);
	const readFailures = readFailureMap(input);
	const seenCandidates = new Map<string, FrameworkUpdatePreviewCandidate>();

	for (const candidate of candidatePathRecords(input)) {
		const classification = classifyFrameworkUpdateCandidatePath(candidate.path);

		if (!classification.ok) {
			addIssue(issues, classification.issue);
			if (classification.action === "excluded") {
				excludedUserContentPaths.push(classification.path);
			}
			actions.push(
				makeAction({
					path: classification.path,
					action: classification.action,
					reason:
						classification.action === "excluded"
							? "Candidate path is outside framework update ownership."
							: "Candidate path cannot be previewed safely.",
					conflict: classification.conflict,
					issueCode: classification.issue.code,
				}),
			);
			continue;
		}

		const previousCandidate = seenCandidates.get(classification.path);
		if (previousCandidate !== undefined) {
			const isSameProposedContent = previousCandidate.proposedContent === candidate.proposedContent;
			const issue = issueForPath(
				isSameProposedContent ? "framework.duplicate-candidate" : "framework.path-collision",
				classification.path,
				isSameProposedContent
					? `Framework update preview received duplicate candidate ${classification.path}.`
					: `Framework update preview received conflicting proposed content for ${classification.path}.`,
				"Pass each normalized framework path at most once per preview.",
			);
			addIssue(issues, issue);
			actions.push(
				makeAction({
					path: classification.path,
					action: isSameProposedContent ? "skip" : "conflict",
					reason: isSameProposedContent
						? "Duplicate candidate skipped after the first normalized path."
						: "Path collision has conflicting proposed content.",
					conflict: isSameProposedContent ? undefined : conflictForIssue("path-collision", issue),
					issueCode: issue.code,
				}),
			);
			continue;
		}

		seenCandidates.set(classification.path, candidate);

		if (candidate.proposedContent !== undefined) {
			const contentIssues = unsafeContentIssues(classification.path, candidate.proposedContent);
			if (contentIssues.length > 0) {
				for (const issue of contentIssues) {
					addIssue(issues, issue);
				}
				const firstIssue = contentIssues[0];
				if (firstIssue === undefined) {
					throw new Error("Expected unsafe content issue");
				}
				actions.push(
					makeAction({
						path: classification.path,
						action: "conflict",
						reason: "Candidate content failed safety scanning.",
						conflict: conflictForIssue(
							"unsafe-content",
							firstIssue,
							"Candidate content contains credential-like values or private path hints.",
						),
						issueCode: firstIssue.code,
					}),
				);
				continue;
			}
		}

		const planned = planAcceptedCandidate(
			classification.path,
			candidate.proposedContent,
			currentFiles.get(classification.path),
			readFailures.get(classification.path),
		);
		actions.push(planned.action);
		if (planned.issue !== undefined) {
			addIssue(issues, planned.issue);
		}
	}

	return {
		dryRun: true,
		commandId,
		generatedAt,
		actions: sortFrameworkUpdatePreviewActions(actions),
		excludedUserContentPaths: sortPaths(excludedUserContentPaths),
		issues: sortAgentValidationIssues(issues),
	};
};

const safeReadablePathsForInput = (input: FrameworkUpdatePreviewInput): readonly string[] =>
	sortPaths(
		candidatePathRecords(input)
			.map((candidate) => classifyFrameworkUpdateCandidatePath(candidate.path))
			.filter((classification): classification is AcceptedFrameworkUpdatePath => classification.ok)
			.map((classification) => classification.path),
	);

class DefaultFrameworkUpdatePreviewPlanner implements FrameworkUpdatePreviewPlanner {
	private isPlanning = false;
	private readonly now: () => Date;
	private readonly beforePlan: () => Promise<void> | void;
	private readonly readCurrentFile: FrameworkUpdatePreviewCurrentFileReader | undefined;

	constructor(options: FrameworkUpdatePreviewPlannerOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.beforePlan = options.beforePlan ?? (() => undefined);
		this.readCurrentFile = options.readCurrentFile;
	}

	async plan(input: FrameworkUpdatePreviewInput): Promise<FrameworkUpdatePreviewPlan> {
		if (this.isPlanning) {
			return {
				dryRun: true,
				commandId,
				generatedAt: toIsoString(this.now()),
				actions: [],
				excludedUserContentPaths: [],
				issues: [
					{
						code: "framework.duplicate-preview",
						message: "Framework update preview is already in flight.",
						commandId,
					},
				],
			};
		}

		this.isPlanning = true;
		try {
			await this.beforePlan();
			const currentFiles = [...(input.currentFiles ?? [])];
			const currentFileReadFailures = [...(input.currentFileReadFailures ?? [])];

			if (this.readCurrentFile !== undefined) {
				const alreadyLoaded = new Set(
					currentFiles
						.map((file) => normalizeFrameworkUpdateCandidatePath(file.path))
						.filter((path): path is string => path !== undefined),
				);

				for (const path of safeReadablePathsForInput(input)) {
					if (alreadyLoaded.has(path)) {
						continue;
					}

					const readResult = await this.readCurrentFile(path, input.rootDir);
					if (readResult.status === "found") {
						currentFiles.push({ path, content: readResult.content });
						alreadyLoaded.add(path);
					}
					if (readResult.status === "failed") {
						currentFileReadFailures.push({
							path,
							message: readResult.message,
						});
					}
				}
			}

			return planFrameworkUpdatePreview({
				...input,
				currentFiles,
				currentFileReadFailures,
				now: input.now ?? this.now(),
			});
		} finally {
			this.isPlanning = false;
		}
	}
}

export const createFrameworkUpdatePreviewPlanner = (
	options: FrameworkUpdatePreviewPlannerOptions = {},
): FrameworkUpdatePreviewPlanner => new DefaultFrameworkUpdatePreviewPlanner(options);

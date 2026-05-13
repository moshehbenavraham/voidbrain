import type {
	AgentValidationBoundary,
	AgentValidationBoundaryKind,
	AgentValidationIssue,
} from "../types/agent-commands";

export interface RepositoryScanBoundaryOptions {
	readonly allowedRoots: readonly string[];
	readonly allowedStandalonePaths: readonly string[];
	readonly allowedExtensions?: readonly string[];
	readonly excludedRoots?: readonly string[];
	readonly issueCode?: AgentValidationIssue["code"];
	readonly remediation?: string;
}

export interface RepositoryScanAcceptedPath {
	readonly ok: true;
	readonly path: string;
	readonly boundary: AgentValidationBoundary;
}

export interface RepositoryScanRejectedPath {
	readonly ok: false;
	readonly issue: AgentValidationIssue;
}

export type RepositoryScanBoundaryResult = RepositoryScanAcceptedPath | RepositoryScanRejectedPath;

const defaultIssueCode: AgentValidationIssue["code"] = "fixture.unsupported-scan-path";

const trimDotSlash = (value: string): string => {
	let next = value;
	while (next.startsWith("./")) {
		next = next.slice(2);
	}
	return next;
};

export const normalizeRepositoryPath = (candidatePath: string): string | undefined => {
	const normalized = trimDotSlash(candidatePath.trim().replace(/\\/g, "/").replace(/\/+/g, "/"));

	if (
		normalized.length === 0 ||
		normalized.startsWith("/") ||
		/^[A-Za-z]:\//.test(normalized) ||
		normalized.split("/").includes("..")
	) {
		return undefined;
	}

	return normalized;
};

const normalizeRoot = (root: string): string | undefined => {
	const normalized = normalizeRepositoryPath(root);
	return normalized?.replace(/\/$/, "");
};

export const isRepositoryPathWithinRoot = (path: string, root: string): boolean =>
	path === root || path.startsWith(`${root}/`);

const pathExtension = (path: string): string => {
	const fileName = path.split("/").pop() ?? "";
	const dotIndex = fileName.lastIndexOf(".");
	return dotIndex <= 0 ? "" : fileName.slice(dotIndex);
};

const hasAllowedExtension = (path: string, allowedExtensions?: readonly string[]): boolean =>
	allowedExtensions === undefined || allowedExtensions.includes(pathExtension(path));

const defaultBoundaryKindForPath = (path: string): AgentValidationBoundaryKind => {
	if (isRepositoryPathWithinRoot(path, "test/fixtures")) {
		return "synthetic-fixture";
	}

	if (isRepositoryPathWithinRoot(path, "skills")) {
		return "skill";
	}

	if (isRepositoryPathWithinRoot(path, "scripts")) {
		return "script";
	}

	if (isRepositoryPathWithinRoot(path, "src/types")) {
		return "source-contract";
	}

	if (path === "AGENTS.md" || path === "CLAUDE.md" || path === "GEMINI.md") {
		return "agent-surface";
	}

	if (path === "README.md" || path === "src/README.md" || isRepositoryPathWithinRoot(path, "docs")) {
		return "documentation";
	}

	return "framework";
};

const unsupportedIssue = (
	candidatePath: string,
	normalizedPath: string | undefined,
	options: RepositoryScanBoundaryOptions,
	message: string,
	kind: AgentValidationBoundaryKind = "unsupported",
): AgentValidationIssue => ({
	code: options.issueCode ?? defaultIssueCode,
	message,
	path: normalizedPath ?? candidatePath,
	remediation:
		options.remediation ??
		"Use repository-relative framework, documentation, skill, script, or synthetic fixture paths.",
	boundary: {
		kind,
		allowed: false,
		reason: message,
	},
});

export const validateRepositoryScanPath = (
	candidatePath: string,
	options: RepositoryScanBoundaryOptions,
): RepositoryScanBoundaryResult => {
	const normalizedPath = normalizeRepositoryPath(candidatePath);

	if (normalizedPath === undefined) {
		return {
			ok: false,
			issue: unsupportedIssue(
				candidatePath,
				normalizedPath,
				options,
				`Repository scan path must be relative and stay inside the repository: ${candidatePath}`,
			),
		};
	}

	const excludedRoot = options.excludedRoots
		?.map(normalizeRoot)
		.find((root): root is string => root !== undefined && isRepositoryPathWithinRoot(normalizedPath, root));

	if (excludedRoot !== undefined) {
		const message = `Repository scan path targets excluded user content: ${normalizedPath}`;
		return {
			ok: false,
			issue: {
				code: options.issueCode ?? defaultIssueCode,
				message,
				path: normalizedPath,
				remediation: "Move examples into test/fixtures/vault/ or use clearly fake fixture paths.",
				boundary: {
					kind: "excluded-user-content",
					root: excludedRoot,
					allowed: false,
					reason: message,
				},
			},
		};
	}

	if (!hasAllowedExtension(normalizedPath, options.allowedExtensions)) {
		return {
			ok: false,
			issue: unsupportedIssue(
				candidatePath,
				normalizedPath,
				options,
				`Repository scan path has an unsupported extension: ${normalizedPath}`,
			),
		};
	}

	const normalizedRoots = options.allowedRoots
		.map(normalizeRoot)
		.filter((root): root is string => root !== undefined);
	const normalizedStandalonePaths = options.allowedStandalonePaths
		.map(normalizeRepositoryPath)
		.filter((path): path is string => path !== undefined);
	const matchedRoot = normalizedRoots.find((root) => isRepositoryPathWithinRoot(normalizedPath, root));
	const isAllowedStandalone = normalizedStandalonePaths.includes(normalizedPath);

	if (matchedRoot === undefined && !isAllowedStandalone) {
		return {
			ok: false,
			issue: unsupportedIssue(
				candidatePath,
				normalizedPath,
				options,
				`Repository scan path is outside the allowed validation boundaries: ${normalizedPath}`,
			),
		};
	}

	const root = matchedRoot ?? normalizedPath;
	const message = `Repository scan path is allowed under ${root}.`;
	return {
		ok: true,
		path: normalizedPath,
		boundary: {
			kind: defaultBoundaryKindForPath(normalizedPath),
			root,
			allowed: true,
			reason: message,
		},
	};
};

export const uniqueRepositoryPaths = (paths: readonly string[]): readonly string[] =>
	[...new Set(paths)].sort((left, right) => left.localeCompare(right));

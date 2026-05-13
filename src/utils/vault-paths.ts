import {
	type NormalizedVaultPath,
	type ValidationIssue,
	type ValidationResult,
	type VaultArtifactKind,
	type VaultLocationContract,
	makeNormalizedVaultPath,
} from "../types/vault";

export const VAULT_FOLDERS = {
	sources: makeNormalizedVaultPath("sources"),
	entities: makeNormalizedVaultPath("entities"),
	concepts: makeNormalizedVaultPath("concepts"),
	summaries: makeNormalizedVaultPath("summaries"),
	conversations: makeNormalizedVaultPath("conversations"),
	voidbrain: makeNormalizedVaultPath(".voidbrain"),
	manifests: makeNormalizedVaultPath(".voidbrain/manifests"),
	indexes: makeNormalizedVaultPath(".voidbrain/indexes"),
	cache: makeNormalizedVaultPath(".voidbrain/cache"),
	logs: makeNormalizedVaultPath(".voidbrain/logs"),
	stagedChanges: makeNormalizedVaultPath(".voidbrain/staged-changes"),
} as const;

export const RUNTIME_STATE_PATH = makeNormalizedVaultPath(".voidbrain/runtime-state.json");
export const HOT_CACHE_SUPPORT_PATH = makeNormalizedVaultPath(".voidbrain/cache/hot-cache.json");

const success = <TValue>(value: TValue): ValidationResult<TValue> => ({ ok: true, value });

const failure = (issue: ValidationIssue): ValidationResult<never> => ({ ok: false, errors: [issue] });

const normalizeSeparators = (path: string): string => path.replaceAll("\\", "/");

const hasUrlScheme = (path: string): boolean => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path);

const hasWindowsDrive = (path: string): boolean => /^[a-zA-Z]:[\\/]/.test(path);

const hasControlCharacters = (path: string): boolean =>
	Array.from(path).some((character) => {
		const code = character.charCodeAt(0);
		return code <= 31 || code === 127;
	});

const compactPathSegments = (path: string): string =>
	path
		.split("/")
		.filter((segment) => segment.length > 0 && segment !== ".")
		.join("/");

const startsWithFolder = (path: NormalizedVaultPath, folder: NormalizedVaultPath): boolean =>
	path === folder || path.startsWith(`${folder}/`);

export const isVoidbrainSupportPath = (path: NormalizedVaultPath): boolean =>
	startsWithFolder(path, VAULT_FOLDERS.voidbrain);

export const isHotCacheSupportPath = (path: NormalizedVaultPath): boolean =>
	path === HOT_CACHE_SUPPORT_PATH || startsWithFolder(path, VAULT_FOLDERS.cache);

export const normalizeVaultPath = (input: unknown): ValidationResult<NormalizedVaultPath> => {
	if (typeof input !== "string") {
		return failure({
			code: "metadata.invalid-type",
			field: "path",
			message: "Vault path must be a string.",
		});
	}

	const trimmedPath = input.trim();
	if (trimmedPath.length === 0) {
		return failure({
			code: "path.empty",
			field: "path",
			message: "Vault path cannot be empty.",
		});
	}

	if (hasUrlScheme(trimmedPath)) {
		return failure({
			code: "path.url",
			field: "path",
			path: trimmedPath,
			message: "Vault path cannot be a URL.",
		});
	}

	if (hasWindowsDrive(trimmedPath)) {
		return failure({
			code: "path.absolute",
			field: "path",
			path: trimmedPath,
			message: "Vault path cannot be a Windows absolute path.",
		});
	}

	const slashPath = normalizeSeparators(trimmedPath);
	if (slashPath.startsWith("/")) {
		return failure({
			code: "path.absolute",
			field: "path",
			path: trimmedPath,
			message: "Vault path cannot be absolute.",
		});
	}

	if (hasControlCharacters(slashPath)) {
		return failure({
			code: "path.unsupported-location",
			field: "path",
			path: trimmedPath,
			message: "Vault path cannot contain control characters.",
		});
	}

	const segments = slashPath.split("/");
	if (segments.includes("..")) {
		return failure({
			code: "path.traversal",
			field: "path",
			path: trimmedPath,
			message: "Vault path cannot contain parent traversal.",
		});
	}

	const compactPath = compactPathSegments(slashPath);
	if (compactPath.length === 0) {
		return failure({
			code: "path.empty",
			field: "path",
			message: "Vault path cannot resolve to an empty path.",
		});
	}

	return success(makeNormalizedVaultPath(compactPath));
};

export const VAULT_LOCATION_CONTRACTS = {
	source: {
		artifactKind: "source",
		baseFolder: VAULT_FOLDERS.sources,
		fileExtension: ".md",
		isSupportArtifact: false,
	},
	entity: {
		artifactKind: "entity",
		baseFolder: VAULT_FOLDERS.entities,
		fileExtension: ".md",
		isSupportArtifact: false,
	},
	concept: {
		artifactKind: "concept",
		baseFolder: VAULT_FOLDERS.concepts,
		fileExtension: ".md",
		isSupportArtifact: false,
	},
	summary: {
		artifactKind: "summary",
		baseFolder: VAULT_FOLDERS.summaries,
		fileExtension: ".md",
		isSupportArtifact: false,
	},
	conversation: {
		artifactKind: "conversation",
		baseFolder: VAULT_FOLDERS.conversations,
		fileExtension: ".md",
		isSupportArtifact: false,
	},
	"source-manifest": {
		artifactKind: "source-manifest",
		baseFolder: VAULT_FOLDERS.manifests,
		fileExtension: ".json",
		isSupportArtifact: true,
	},
	"index-metadata": {
		artifactKind: "index-metadata",
		baseFolder: VAULT_FOLDERS.indexes,
		fileExtension: ".json",
		isSupportArtifact: true,
	},
	"hot-cache": {
		artifactKind: "hot-cache",
		baseFolder: VAULT_FOLDERS.cache,
		fileExtension: ".json",
		isSupportArtifact: true,
	},
	"operation-log": {
		artifactKind: "operation-log",
		baseFolder: VAULT_FOLDERS.logs,
		fileExtension: ".json",
		isSupportArtifact: true,
	},
	"staged-change": {
		artifactKind: "staged-change",
		baseFolder: VAULT_FOLDERS.stagedChanges,
		fileExtension: ".json",
		isSupportArtifact: true,
	},
} as const satisfies Record<VaultArtifactKind, VaultLocationContract>;

const isRuntimeStateAggregateKind = (artifactKind: VaultArtifactKind): boolean =>
	artifactKind === "index-metadata" ||
	artifactKind === "hot-cache" ||
	artifactKind === "operation-log" ||
	artifactKind === "staged-change";

export const validateArtifactPath = (
	input: unknown,
	artifactKind: VaultArtifactKind,
): ValidationResult<NormalizedVaultPath> => {
	const normalized = normalizeVaultPath(input);
	if (!normalized.ok) {
		return normalized;
	}

	const path = normalized.value;
	const contract = VAULT_LOCATION_CONTRACTS[artifactKind];

	if (!path.endsWith(contract.fileExtension)) {
		return failure({
			code: "path.invalid-extension",
			field: "path",
			path,
			message: `${artifactKind} artifacts must use ${contract.fileExtension} files.`,
		});
	}

	if (isRuntimeStateAggregateKind(artifactKind) && path === RUNTIME_STATE_PATH) {
		return success(path);
	}

	if (!startsWithFolder(path, contract.baseFolder)) {
		return failure({
			code: "path.unsupported-location",
			field: "path",
			path,
			message: `${artifactKind} artifacts must be under ${contract.baseFolder}.`,
		});
	}

	return success(path);
};

export const compareVaultPaths = (left: NormalizedVaultPath, right: NormalizedVaultPath): number =>
	left.localeCompare(right, "en", { sensitivity: "base" });

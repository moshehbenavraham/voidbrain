import {
	INGEST_SOURCE_COMMAND_ID,
	type SourceIngestionIntakeRequest,
	type SourceIngestionPreview,
} from "../types/ingestion";
import type {
	IsoTimestamp,
	NormalizedVaultPath,
	SourceManifest,
	SourceManifestRecord,
	SourceType,
	StagedChangeRecord,
	ValidationIssue,
	ValidationResult,
} from "../types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../types/vault";
import { normalizeVaultPath, validateArtifactPath } from "../utils/vault-paths";
import { createContentSha256 } from "./staged-change-service";

const encoder = new TextEncoder();
const defaultMaxSourceBytes = 100_000;
const activeStagedStatuses = new Set(["proposed", "review-ready", "conflicted", "approved"]);

interface NormalizedSourceInput {
	readonly sourceKind: SourceIngestionPreview["sourceKind"];
	readonly sourceType: SourceType;
	readonly title: string;
	readonly sourcePath: NormalizedVaultPath;
	readonly sourceUrl?: string;
	readonly content: string;
	readonly contentSensitivity: SourceIngestionPreview["contentSensitivity"];
	readonly providerMode: SourceIngestionPreview["extractionPlan"]["providerRequirement"]["mode"];
}

export interface SourceIngestionIntakeServiceOptions {
	readonly now?: () => Date;
	readonly maxSourceBytes?: number;
}

const success = <TValue>(value: TValue): ValidationResult<TValue> => ({ ok: true, value });

const failure = (errors: readonly ValidationIssue[]): ValidationResult<never> => ({ ok: false, errors });

const issue = (
	code: ValidationIssue["code"],
	message: string,
	field?: string,
	path?: NormalizedVaultPath | string,
): ValidationIssue => ({
	code,
	message,
	...(field === undefined ? {} : { field }),
	...(path === undefined ? {} : { path }),
});

const isActiveStagedChange = (change: StagedChangeRecord): boolean => activeStagedStatuses.has(change.status);

const normalizeLineEndings = (content: string): string => content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

const trimTitle = (title: string): string => title.trim().replaceAll(/\s+/g, " ");

export const slugifyIngestionTitle = (title: string): string => {
	const slug = title
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 80);

	return slug.length > 0 ? slug : "untitled-source";
};

const titleFromPath = (path: string): string => {
	const fileName = path.split("/").at(-1) ?? path;
	const withoutExtension = fileName.replace(/\.[^.]+$/u, "");
	return trimTitle(withoutExtension.replaceAll(/[-_]+/g, " "));
};

const titleFromContent = (content: string): string | null => {
	const heading = normalizeLineEndings(content)
		.split("\n")
		.map((line) => line.trim())
		.find((line) => /^#{1,3}\s+\S/.test(line));
	if (heading !== undefined) {
		return trimTitle(heading.replace(/^#{1,3}\s+/, ""));
	}

	const firstTextLine = normalizeLineEndings(content)
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0 && !line.startsWith("---"));

	return firstTextLine === undefined ? null : trimTitle(firstTextLine.slice(0, 80));
};

const candidateNames = (title: string, content: string, prefix: string): readonly string[] => {
	const fromTitle = title
		.split(/\s+/)
		.filter((part) => /^[A-Z][A-Za-z0-9-]{2,}$/.test(part))
		.join(" ");
	const capitalizedPhrases = Array.from(content.matchAll(/\b[A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*){0,2}\b/g))
		.map((match) => trimTitle(match[0]))
		.filter((value) => value.length >= 4 && value.toLowerCase() !== title.toLowerCase());
	const names = [fromTitle, ...capitalizedPhrases]
		.filter((value) => value.length > 0)
		.filter(
			(value, index, values) =>
				values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
		)
		.slice(0, 2);

	return names.length === 0 ? [`${title} ${prefix}`] : names;
};

const conceptNames = (title: string, content: string): readonly string[] => {
	const lowerContent = content.toLowerCase();
	const candidates = [
		lowerContent.includes("local-first") ? "Local First" : null,
		lowerContent.includes("staged") ? "Staged Changes" : null,
		lowerContent.includes("retrieval") ? "Retrieval" : null,
		lowerContent.includes("privacy") ? "Privacy Boundary" : null,
		`${title} Topic`,
	].filter((value): value is string => value !== null);

	return candidates
		.filter(
			(value, index, values) =>
				values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
		)
		.slice(0, 2);
};

const artifactPath = (folder: "sources" | "entities" | "concepts" | "summaries", title: string): NormalizedVaultPath =>
	makeNormalizedVaultPath(`${folder}/${slugifyIngestionTitle(title)}.md`);

const buildTargetPaths = (title: string, content: string): SourceIngestionPreview["targetPaths"] => ({
	source: artifactPath("sources", title),
	entities: candidateNames(title, content, "Entity").map((name) => artifactPath("entities", name)),
	concepts: conceptNames(title, content).map((name) => artifactPath("concepts", name)),
	summary: artifactPath("summaries", `${title} Summary`),
});

const validateHttpUrl = (url: string): boolean => {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:";
	} catch {
		return false;
	}
};

const normalizeProvidedSourcePath = (
	value: string | undefined,
	fallbackTitle: string,
): ValidationResult<NormalizedVaultPath> => {
	if (value === undefined) {
		return success(artifactPath("sources", fallbackTitle));
	}

	const normalized = normalizeVaultPath(value);
	if (!normalized.ok) {
		return normalized;
	}

	if (normalized.value.startsWith(".voidbrain/")) {
		return failure([
			issue(
				"path.unsupported-location",
				"Source ingestion cannot cite Voidbrain support records as user source content.",
				"sourcePath",
				normalized.value,
			),
		]);
	}

	return success(normalized.value);
};

const normalizeFileSourceInput = (request: SourceIngestionIntakeRequest): ValidationResult<NormalizedSourceInput> => {
	const input = request.input;
	if (input.kind !== "markdown-file" && input.kind !== "text-file") {
		return failure([issue("metadata.invalid-type", "Expected file source input.", "kind")]);
	}

	const path = normalizeVaultPath(input.path);
	if (!path.ok) {
		return path;
	}

	const allowedExtension = input.kind === "markdown-file" ? ".md" : ".txt";
	if (!path.value.endsWith(allowedExtension)) {
		return failure([
			issue(
				"path.invalid-extension",
				`${input.kind} inputs must use ${allowedExtension} files.`,
				"path",
				path.value,
			),
		]);
	}

	if (path.value.startsWith(".voidbrain/")) {
		return failure([
			issue(
				"path.unsupported-location",
				"Source ingestion cannot read Voidbrain support records as source content.",
				"path",
				path.value,
			),
		]);
	}

	const content = normalizeLineEndings(input.content ?? "");
	if (content.trim().length === 0) {
		return failure([
			issue("metadata.missing-field", "Source content is required for preview.", "content", path.value),
		]);
	}

	const title = trimTitle(input.title ?? titleFromContent(content) ?? titleFromPath(path.value));
	return success({
		sourceKind: input.kind,
		sourceType: input.kind === "markdown-file" ? "article" : "other",
		title,
		sourcePath: path.value,
		content,
		contentSensitivity: input.contentSensitivity ?? "private-vault",
		providerMode: input.providerMode ?? "none",
	});
};

const normalizePastedSourceInput = (request: SourceIngestionIntakeRequest): ValidationResult<NormalizedSourceInput> => {
	const input = request.input;
	if (input.kind !== "pasted-content") {
		return failure([issue("metadata.invalid-type", "Expected pasted source input.", "kind")]);
	}

	const content = normalizeLineEndings(input.content);
	const title = trimTitle(input.title);
	const path = normalizeProvidedSourcePath(input.sourcePath, title);
	const errors: ValidationIssue[] = [];
	if (content.trim().length === 0) {
		errors.push(issue("metadata.missing-field", "Pasted content cannot be empty.", "content"));
	}
	if (title.length === 0) {
		errors.push(issue("metadata.missing-field", "Pasted content requires a title.", "title"));
	}
	if (!path.ok) {
		errors.push(...path.errors);
	}
	if (errors.length > 0) {
		return failure(errors);
	}
	if (!path.ok) {
		return failure(path.errors);
	}

	return success({
		sourceKind: "pasted-content",
		sourceType: "other",
		title,
		sourcePath: path.value,
		content,
		contentSensitivity: input.contentSensitivity ?? "private-vault",
		providerMode: input.providerMode ?? "none",
	});
};

const normalizeUrlSourceInput = (request: SourceIngestionIntakeRequest): ValidationResult<NormalizedSourceInput> => {
	const input = request.input;
	if (input.kind !== "url-record") {
		return failure([issue("metadata.invalid-type", "Expected URL source input.", "kind")]);
	}

	const content = normalizeLineEndings(input.content);
	const title = trimTitle(input.title);
	const path = normalizeProvidedSourcePath(input.sourcePath, title);
	const errors: ValidationIssue[] = [];
	if (!input.approved) {
		errors.push(issue("record.invalid-state", "URL source records require explicit approval.", "approved"));
	}
	if (!validateHttpUrl(input.sourceUrl)) {
		errors.push(issue("metadata.invalid-type", "URL source records require an http or https URL.", "sourceUrl"));
	}
	if (content.trim().length === 0) {
		errors.push(issue("metadata.missing-field", "URL source record content cannot be empty.", "content"));
	}
	if (title.length === 0) {
		errors.push(issue("metadata.missing-field", "URL source records require a title.", "title"));
	}
	if (!path.ok) {
		errors.push(...path.errors);
	}
	if (errors.length > 0) {
		return failure(errors);
	}
	if (!path.ok) {
		return failure(path.errors);
	}

	return success({
		sourceKind: "url-record",
		sourceType: "web-page",
		title,
		sourcePath: path.value,
		sourceUrl: input.sourceUrl,
		content,
		contentSensitivity: input.contentSensitivity ?? "private-vault",
		providerMode: input.providerMode ?? "none",
	});
};

const normalizeSourceInput = (request: SourceIngestionIntakeRequest): ValidationResult<NormalizedSourceInput> => {
	switch (request.input.kind) {
		case "markdown-file":
		case "text-file":
			return normalizeFileSourceInput(request);
		case "pasted-content":
			return normalizePastedSourceInput(request);
		case "url-record":
			return normalizeUrlSourceInput(request);
		default: {
			const exhaustive: never = request.input;
			return failure([
				issue(
					"metadata.invalid-type",
					`Unsupported source ingestion input: ${JSON.stringify(exhaustive)}.`,
					"kind",
				),
			]);
		}
	}
};

const sortedUniquePaths = (paths: readonly NormalizedVaultPath[]): readonly NormalizedVaultPath[] =>
	[...new Set(paths)].sort((left, right) => left.localeCompare(right));

const sourceManifestMatches = (
	manifest: SourceManifest | undefined,
	sourcePath: NormalizedVaultPath,
	contentSha256: string,
): readonly SourceManifestRecord[] =>
	(manifest?.records ?? []).filter((record) => record.path === sourcePath || record.contentSha256 === contentSha256);

const findTargetPathConflicts = (
	targetPaths: SourceIngestionPreview["targetPaths"],
	existingNotes: SourceIngestionIntakeRequest["existingNotes"],
): readonly NormalizedVaultPath[] => {
	const existingPathSet = new Set((existingNotes ?? []).map((note) => String(note.path)));
	const targetPathList = [targetPaths.source, ...targetPaths.entities, ...targetPaths.concepts, targetPaths.summary];
	return sortedUniquePaths(targetPathList.filter((path) => existingPathSet.has(path)));
};

const findActiveStagedConflicts = (
	targetPaths: SourceIngestionPreview["targetPaths"],
	existingStagedChanges: readonly StagedChangeRecord[] | undefined,
): {
	readonly paths: readonly NormalizedVaultPath[];
	readonly stagedChangeIds: readonly string[];
} => {
	const targetPathSet = new Set([
		targetPaths.source,
		...targetPaths.entities,
		...targetPaths.concepts,
		targetPaths.summary,
	]);
	const matches = (existingStagedChanges ?? [])
		.filter(isActiveStagedChange)
		.filter((change) => targetPathSet.has(change.targetPath));

	return {
		paths: sortedUniquePaths(matches.map((change) => change.targetPath)),
		stagedChangeIds: matches.map((change) => change.changeId).sort((left, right) => left.localeCompare(right)),
	};
};

const buildDuplicateStatus = (input: {
	readonly sourcePath: NormalizedVaultPath;
	readonly contentSha256: string;
	readonly targetPaths: SourceIngestionPreview["targetPaths"];
	readonly existingSourceManifest: SourceManifest | undefined;
	readonly existingNotes: SourceIngestionIntakeRequest["existingNotes"];
	readonly existingStagedChanges: readonly StagedChangeRecord[] | undefined;
}): SourceIngestionPreview["duplicateStatus"] => {
	const manifestMatches = sourceManifestMatches(input.existingSourceManifest, input.sourcePath, input.contentSha256);
	if (manifestMatches.length > 0) {
		const contentHashMatches = manifestMatches.filter((record) => record.contentSha256 === input.contentSha256);
		const sourcePathMatches = manifestMatches.filter((record) => record.path === input.sourcePath);
		const paths = sortedUniquePaths(manifestMatches.map((record) => record.path));
		if (contentHashMatches.length > 0) {
			return {
				kind: "content-hash",
				isBlocking: true,
				matchedPaths: paths,
				matchedStagedChangeIds: [],
				message: "Source content already exists in the source manifest.",
			};
		}
		if (sourcePathMatches.length > 0) {
			return {
				kind: "source-path",
				isBlocking: true,
				matchedPaths: paths,
				matchedStagedChangeIds: [],
				message: "Source path already exists in the source manifest.",
			};
		}
	}

	const stagedConflicts = findActiveStagedConflicts(input.targetPaths, input.existingStagedChanges);
	if (stagedConflicts.paths.length > 0) {
		return {
			kind: "active-staged-change",
			isBlocking: true,
			matchedPaths: stagedConflicts.paths,
			matchedStagedChangeIds: stagedConflicts.stagedChangeIds,
			message: "An active staged change already targets generated ingestion paths.",
		};
	}

	const targetConflicts = findTargetPathConflicts(input.targetPaths, input.existingNotes);
	if (targetConflicts.length > 0) {
		return {
			kind: "target-path",
			isBlocking: true,
			matchedPaths: targetConflicts,
			matchedStagedChangeIds: [],
			message: "One or more generated target paths already exists.",
		};
	}

	return {
		kind: "none",
		isBlocking: false,
		matchedPaths: [],
		matchedStagedChangeIds: [],
		message: "No duplicate source or target-path conflict was detected.",
	};
};

const validateTargets = (targetPaths: SourceIngestionPreview["targetPaths"]): readonly ValidationIssue[] => {
	const checks = [
		validateArtifactPath(targetPaths.source, "source"),
		...targetPaths.entities.map((path) => validateArtifactPath(path, "entity")),
		...targetPaths.concepts.map((path) => validateArtifactPath(path, "concept")),
		validateArtifactPath(targetPaths.summary, "summary"),
	];

	return checks.flatMap((check) => (check.ok ? [] : check.errors));
};

export class SourceIngestionIntakeService {
	private readonly now: () => Date;
	private readonly maxSourceBytes: number;

	public constructor(options: SourceIngestionIntakeServiceOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.maxSourceBytes = Math.max(1, options.maxSourceBytes ?? defaultMaxSourceBytes);
	}

	public async createPreview(
		request: SourceIngestionIntakeRequest,
	): Promise<ValidationResult<SourceIngestionPreview>> {
		const source = normalizeSourceInput(request);
		if (!source.ok) {
			return source;
		}

		const contentBytes = encoder.encode(source.value.content).byteLength;
		if (contentBytes > this.maxSourceBytes) {
			return failure([
				issue(
					"record.invalid-state",
					`Source content is ${contentBytes} bytes; maximum is ${this.maxSourceBytes} bytes.`,
					"content",
					source.value.sourcePath,
				),
			]);
		}

		const contentSha256 = await createContentSha256(source.value.content);
		const targetPaths = buildTargetPaths(source.value.title, source.value.content);
		const targetErrors = validateTargets(targetPaths);
		if (targetErrors.length > 0) {
			return failure(targetErrors);
		}

		const duplicateStatus = buildDuplicateStatus({
			sourcePath: source.value.sourcePath,
			contentSha256,
			targetPaths,
			existingSourceManifest: request.existingSourceManifest,
			existingNotes: request.existingNotes,
			existingStagedChanges: request.existingStagedChanges,
		});
		const createdAt = makeIsoTimestamp(this.now().toISOString());
		const sourceCitationId = `source:${slugifyIngestionTitle(source.value.title)}`;
		const providerRequirement = {
			mode: source.value.providerMode,
			isRequired: false,
			role: "chat" as const,
			requiredCapability: "chat" as const,
			contentSensitivity: source.value.contentSensitivity,
			sourcePaths: [source.value.sourcePath],
			purpose: "Optionally assist source ingestion summaries after explicit provider review.",
		};

		return success({
			commandId: INGEST_SOURCE_COMMAND_ID,
			sourceKind: source.value.sourceKind,
			sourceType: source.value.sourceType,
			title: source.value.title,
			sourcePath: source.value.sourcePath,
			...(source.value.sourceUrl === undefined ? {} : { sourceUrl: source.value.sourceUrl }),
			contentSha256,
			contentBytes,
			contentSensitivity: source.value.contentSensitivity,
			duplicateStatus,
			targetPaths,
			extractionPlan: {
				planId: `plan-${contentSha256.slice(0, 12)}`,
				providerRequirement,
				expectedArtifacts: ["source", "entity", "concept", "summary"],
				citationExpectations: [
					"Every generated note must include at least one source path.",
					"Summary artifacts must include source citation IDs.",
					"Entity and concept artifacts must link back to the source record.",
				],
				targetPaths,
			},
			citationEvidence: [
				{
					citationId: sourceCitationId,
					sourcePath: source.value.sourcePath,
					sourceRecordId: `source-record-${contentSha256.slice(0, 12)}`,
				},
			],
			createdAt,
		});
	}
}

export const createSourceIngestionPreview = (
	request: SourceIngestionIntakeRequest,
	options?: SourceIngestionIntakeServiceOptions,
): Promise<ValidationResult<SourceIngestionPreview>> =>
	new SourceIngestionIntakeService(options).createPreview(request);

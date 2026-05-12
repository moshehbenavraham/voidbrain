import type {
	IsoTimestamp,
	NormalizedVaultPath,
	StagedChangeConflict,
	StagedChangeDiffContext,
	StagedChangeDiffLine,
	StagedChangeOperationKind,
	StagedChangeRecord,
	StagedFrontmatterPatchEntry,
	ValidationIssue,
	ValidationResult,
} from "../types/vault";
import { makeIsoTimestamp, makeNormalizedVaultPath } from "../types/vault";
import { normalizeVaultPath } from "../utils/vault-paths";
import { validateStagedChangeRecord } from "../utils/vault-validation";

const encoder = new TextEncoder();

const normalizeLineEndings = (content: string): string => content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const safeIdSegment = (value: string): string =>
	value
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 80);

export interface StagedChangeIdInput {
	readonly operationKind: StagedChangeOperationKind;
	readonly targetPath: NormalizedVaultPath;
	readonly commandId: string;
	readonly createdAt: IsoTimestamp;
	readonly afterSha256?: string;
	readonly destinationPath?: NormalizedVaultPath;
}

export const createContentSha256 = async (content: string): Promise<string> => {
	const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(normalizeLineEndings(content)));
	return toHex(new Uint8Array(digest));
};

export const createStagedChangeId = (input: StagedChangeIdInput): string => {
	const pathSegment = safeIdSegment(input.targetPath);
	const commandSegment = safeIdSegment(input.commandId);
	const destinationSegment =
		input.destinationPath === undefined ? "" : `-${safeIdSegment(input.destinationPath).slice(0, 24)}`;
	const hashSegment = (input.afterSha256 ?? input.createdAt).replaceAll(/[^a-fA-F0-9]/g, "").slice(0, 12);

	return `stage-${input.operationKind}-${pathSegment}${destinationSegment}-${commandSegment}-${hashSegment}`;
};

const commonPrefixLength = (left: readonly string[], right: readonly string[]): number => {
	const maxLength = Math.min(left.length, right.length);
	for (let index = 0; index < maxLength; index += 1) {
		if (left[index] !== right[index]) {
			return index;
		}
	}

	return maxLength;
};

const commonSuffixLength = (left: readonly string[], right: readonly string[], prefixLength: number): number => {
	const maxLength = Math.min(left.length, right.length) - prefixLength;
	for (let offset = 0; offset < maxLength; offset += 1) {
		const leftLine = left[left.length - 1 - offset];
		const rightLine = right[right.length - 1 - offset];
		if (leftLine !== rightLine) {
			return offset;
		}
	}

	return maxLength;
};

export const createLineDiff = (beforeContent = "", afterContent = ""): readonly StagedChangeDiffLine[] => {
	const beforeLines = normalizeLineEndings(beforeContent).split("\n");
	const afterLines = normalizeLineEndings(afterContent).split("\n");
	const prefixLength = commonPrefixLength(beforeLines, afterLines);
	const suffixLength = commonSuffixLength(beforeLines, afterLines, prefixLength);
	const lines: StagedChangeDiffLine[] = [];

	for (let index = 0; index < prefixLength; index += 1) {
		lines.push({
			kind: "context",
			oldLineNumber: index + 1,
			newLineNumber: index + 1,
			content: beforeLines[index] ?? "",
		});
	}

	const beforeMiddleEnd = beforeLines.length - suffixLength;
	for (let index = prefixLength; index < beforeMiddleEnd; index += 1) {
		lines.push({
			kind: "removed",
			oldLineNumber: index + 1,
			content: beforeLines[index] ?? "",
		});
	}

	const afterMiddleEnd = afterLines.length - suffixLength;
	for (let index = prefixLength; index < afterMiddleEnd; index += 1) {
		lines.push({
			kind: "added",
			newLineNumber: index + 1,
			content: afterLines[index] ?? "",
		});
	}

	for (let index = suffixLength; index > 0; index -= 1) {
		const beforeIndex = beforeLines.length - index;
		const afterIndex = afterLines.length - index;
		lines.push({
			kind: "context",
			oldLineNumber: beforeIndex + 1,
			newLineNumber: afterIndex + 1,
			content: beforeLines[beforeIndex] ?? "",
		});
	}

	return lines;
};

export const createDiffContext = async (
	beforeContent: string | undefined,
	afterContent: string | undefined,
): Promise<StagedChangeDiffContext> => {
	const beforeSha256 = beforeContent === undefined ? undefined : await createContentSha256(beforeContent);
	const afterSha256 = afterContent === undefined ? undefined : await createContentSha256(afterContent);
	const lineDiff = createLineDiff(beforeContent ?? "", afterContent ?? "");

	return {
		...(beforeContent === undefined ? {} : { beforeContent }),
		...(afterContent === undefined ? {} : { afterContent }),
		...(beforeSha256 === undefined ? {} : { beforeSha256 }),
		...(afterSha256 === undefined ? {} : { afterSha256 }),
		lineDiff,
		hasTextChanges: beforeSha256 !== afterSha256,
	};
};

export interface ExistingVaultNote {
	readonly path: NormalizedVaultPath | string;
	readonly content: string;
}

export interface BaseStageChangeInput {
	readonly commandId: string;
	readonly targetPath: NormalizedVaultPath | string;
	readonly sourcePaths: readonly (NormalizedVaultPath | string)[];
	readonly rationale: string;
	readonly existingNotes?: readonly ExistingVaultNote[];
	readonly existingStagedChanges?: readonly StagedChangeRecord[];
	readonly expectedBeforeSha256?: string;
	readonly validationOutput?: readonly ValidationIssue[];
}

export interface StageCreateNoteInput extends BaseStageChangeInput {
	readonly afterContent: string;
}

export interface StageUpdateNoteInput extends BaseStageChangeInput {
	readonly afterContent: string;
}

export interface StageDeleteNoteInput extends BaseStageChangeInput {}

export interface StageMoveNoteInput extends BaseStageChangeInput {
	readonly destinationPath: NormalizedVaultPath | string;
}

export interface StageFrontmatterEditInput extends BaseStageChangeInput {
	readonly afterContent: string;
	readonly frontmatterPatch: readonly StagedFrontmatterPatchEntry[];
}

export interface StagedChangeServiceHooks {
	readonly beforeBuild?: (
		operationKind: StagedChangeOperationKind,
		targetPath: NormalizedVaultPath,
	) => void | Promise<void>;
}

export interface StagedChangeServiceOptions {
	readonly now?: () => Date;
	readonly hooks?: StagedChangeServiceHooks;
}

interface NormalizedExistingNote {
	readonly path: NormalizedVaultPath;
	readonly content: string;
}

interface BuildStageChangeInput extends BaseStageChangeInput {
	readonly operationKind: StagedChangeOperationKind;
	readonly afterContent?: string;
	readonly destinationPath?: NormalizedVaultPath | string;
	readonly frontmatterPatch?: readonly StagedFrontmatterPatchEntry[];
}

const success = <TValue>(value: TValue): ValidationResult<TValue> => ({ ok: true, value });

const failure = (errors: readonly ValidationIssue[]): ValidationResult<never> => ({ ok: false, errors });

const validationIssue = (
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

const normalizeStagedTargetPath = (
	path: NormalizedVaultPath | string,
	field: string,
): ValidationResult<NormalizedVaultPath> => {
	const normalized = normalizeVaultPath(path);
	if (!normalized.ok) {
		return normalized;
	}

	if (!normalized.value.endsWith(".md")) {
		return failure([
			validationIssue(
				"path.invalid-extension",
				"Staged-change target paths must reference markdown notes.",
				field,
				normalized.value,
			),
		]);
	}

	if (normalized.value.startsWith(".voidbrain/")) {
		return failure([
			validationIssue(
				"path.unsupported-location",
				"Staged-change target paths cannot mutate Voidbrain support records.",
				field,
				normalized.value,
			),
		]);
	}

	return success(normalized.value);
};

const normalizeSourcePaths = (
	sourcePaths: readonly (NormalizedVaultPath | string)[],
): ValidationResult<readonly NormalizedVaultPath[]> => {
	if (sourcePaths.length === 0) {
		return failure([
			validationIssue(
				"metadata.missing-source-trace",
				"Staged changes must include at least one source path.",
				"sourcePaths",
			),
		]);
	}

	const normalizedPaths: NormalizedVaultPath[] = [];
	const errors: ValidationIssue[] = [];
	for (const [index, path] of sourcePaths.entries()) {
		const normalized = normalizeVaultPath(path);
		if (normalized.ok) {
			normalizedPaths.push(normalized.value);
		} else {
			errors.push(...normalized.errors.map((error) => ({ ...error, field: `sourcePaths[${index}]` })));
		}
	}

	if (errors.length > 0) {
		return failure(errors);
	}

	return success([...new Set(normalizedPaths)].sort((left, right) => left.localeCompare(right)));
};

const normalizeExistingNotes = (
	existingNotes: readonly ExistingVaultNote[] = [],
): ValidationResult<readonly NormalizedExistingNote[]> => {
	const normalizedNotes: NormalizedExistingNote[] = [];
	const errors: ValidationIssue[] = [];

	for (const [index, note] of existingNotes.entries()) {
		const normalized = normalizeStagedTargetPath(note.path, `existingNotes[${index}].path`);
		if (normalized.ok) {
			normalizedNotes.push({ path: normalized.value, content: note.content });
		} else {
			errors.push(...normalized.errors);
		}
	}

	if (errors.length > 0) {
		return failure(errors);
	}

	return success(normalizedNotes);
};

const findExistingContent = (
	existingNotes: readonly NormalizedExistingNote[],
	path: NormalizedVaultPath,
): string | undefined => existingNotes.find((note) => note.path === path)?.content;

const activeStatuses = new Set(["proposed", "review-ready", "conflicted", "approved"]);

const hasActiveDuplicate = (
	existingStagedChanges: readonly StagedChangeRecord[] | undefined,
	targetPath: NormalizedVaultPath,
	destinationPath?: NormalizedVaultPath,
): boolean =>
	(existingStagedChanges ?? []).some((change) => {
		if (!activeStatuses.has(change.status)) {
			return false;
		}

		return (
			change.targetPath === targetPath ||
			change.operationMetadata?.destinationPath === targetPath ||
			change.targetPath === destinationPath
		);
	});

const conflictIssue = (conflict: StagedChangeConflict): ValidationIssue =>
	validationIssue("record.invalid-state", conflict.message, "targetPath", conflict.paths[0]);

const reviewReasonsForOperation = (operationKind: StagedChangeOperationKind): readonly string[] => {
	switch (operationKind) {
		case "create-note":
			return ["new-note"];
		case "update-note":
			return ["existing-note-edit"];
		case "delete-note":
			return ["destructive-delete"];
		case "move-note":
			return ["destructive-move"];
		case "update-frontmatter":
			return ["frontmatter-edit"];
		default: {
			const exhaustive: never = operationKind;
			throw new Error(`Unhandled staged-change operation: ${String(exhaustive)}`);
		}
	}
};

const isDestructiveOperation = (operationKind: StagedChangeOperationKind): boolean =>
	operationKind === "delete-note" || operationKind === "move-note";

const backupIntentFor = (
	changeId: string,
	operationKind: StagedChangeOperationKind,
): NormalizedVaultPath | undefined =>
	isDestructiveOperation(operationKind)
		? makeNormalizedVaultPath(`.voidbrain/staged-changes/${changeId}.backup.md`)
		: undefined;

const createOperationMetadata = (input: BuildStageChangeInput, destinationPath: NormalizedVaultPath | undefined) => {
	if (input.operationKind === "move-note") {
		return destinationPath === undefined ? undefined : { destinationPath };
	}

	if (input.operationKind === "update-frontmatter") {
		return { frontmatterPatch: input.frontmatterPatch ?? [] };
	}

	return undefined;
};

export class StagedChangeService {
	private readonly inFlightTargets = new Set<string>();

	public constructor(private readonly options: StagedChangeServiceOptions = {}) {}

	public async stageCreateNote(input: StageCreateNoteInput): Promise<ValidationResult<StagedChangeRecord>> {
		return this.withInFlight("create-note", input, () =>
			this.buildStagedChange({
				...input,
				operationKind: "create-note",
				afterContent: input.afterContent,
			}),
		);
	}

	public async stageUpdateNote(input: StageUpdateNoteInput): Promise<ValidationResult<StagedChangeRecord>> {
		return this.withInFlight("update-note", input, () =>
			this.buildStagedChange({
				...input,
				operationKind: "update-note",
				afterContent: input.afterContent,
			}),
		);
	}

	public async stageDeleteNote(input: StageDeleteNoteInput): Promise<ValidationResult<StagedChangeRecord>> {
		return this.withInFlight("delete-note", input, () =>
			this.buildStagedChange({
				...input,
				operationKind: "delete-note",
			}),
		);
	}

	public async stageMoveNote(input: StageMoveNoteInput): Promise<ValidationResult<StagedChangeRecord>> {
		return this.withInFlight("move-note", input, () =>
			this.buildStagedChange({
				...input,
				operationKind: "move-note",
				destinationPath: input.destinationPath,
			}),
		);
	}

	public async stageFrontmatterEdit(input: StageFrontmatterEditInput): Promise<ValidationResult<StagedChangeRecord>> {
		return this.withInFlight("update-frontmatter", input, () =>
			this.buildStagedChange({
				...input,
				operationKind: "update-frontmatter",
				afterContent: input.afterContent,
				frontmatterPatch: input.frontmatterPatch,
			}),
		);
	}

	private async withInFlight(
		operationKind: StagedChangeOperationKind,
		input: BaseStageChangeInput,
		build: () => Promise<ValidationResult<StagedChangeRecord>>,
	): Promise<ValidationResult<StagedChangeRecord>> {
		const targetPath = normalizeStagedTargetPath(input.targetPath, "targetPath");
		if (!targetPath.ok) {
			return targetPath;
		}

		const key = `${operationKind}:${targetPath.value}`;
		if (this.inFlightTargets.has(key)) {
			return failure([
				validationIssue(
					"record.invalid-operation",
					`A staged-change build is already in flight for ${targetPath.value}.`,
					"targetPath",
					targetPath.value,
				),
			]);
		}

		this.inFlightTargets.add(key);
		try {
			await this.options.hooks?.beforeBuild?.(operationKind, targetPath.value);
			return await build();
		} finally {
			this.inFlightTargets.delete(key);
		}
	}

	private async buildStagedChange(input: BuildStageChangeInput): Promise<ValidationResult<StagedChangeRecord>> {
		const targetPath = normalizeStagedTargetPath(input.targetPath, "targetPath");
		const sourcePaths = normalizeSourcePaths(input.sourcePaths);
		const existingNotes = normalizeExistingNotes(input.existingNotes);
		const destinationPath =
			input.destinationPath === undefined
				? undefined
				: normalizeStagedTargetPath(input.destinationPath, "destinationPath");

		const preflightErrors = [
			...(targetPath.ok ? [] : targetPath.errors),
			...(sourcePaths.ok ? [] : sourcePaths.errors),
			...(existingNotes.ok ? [] : existingNotes.errors),
			...(destinationPath === undefined || destinationPath.ok ? [] : destinationPath.errors),
		];
		if (preflightErrors.length > 0) {
			return failure(preflightErrors);
		}
		if (!targetPath.ok) {
			return failure(targetPath.errors);
		}
		if (!sourcePaths.ok) {
			return failure(sourcePaths.errors);
		}
		if (!existingNotes.ok) {
			return failure(existingNotes.errors);
		}
		if (destinationPath !== undefined && !destinationPath.ok) {
			return failure(destinationPath.errors);
		}

		const normalizedTargetPath = targetPath.value;
		const normalizedDestinationPath = destinationPath?.value;
		const normalizedExistingNotes = existingNotes.value;
		const beforeContent = findExistingContent(normalizedExistingNotes, normalizedTargetPath);
		const destinationContent =
			normalizedDestinationPath === undefined
				? undefined
				: findExistingContent(normalizedExistingNotes, normalizedDestinationPath);
		const afterContent =
			input.operationKind === "delete-note"
				? undefined
				: input.operationKind === "move-note"
					? beforeContent
					: input.afterContent;
		const diff = await createDiffContext(beforeContent, afterContent);
		const conflicts: StagedChangeConflict[] = [];

		if (input.operationKind === "create-note" && beforeContent !== undefined) {
			conflicts.push({
				kind: "target-exists",
				severity: "blocking",
				message: `Cannot create ${normalizedTargetPath} because a note already exists at that path.`,
				paths: [normalizedTargetPath],
				...(diff.beforeSha256 === undefined ? {} : { actualSha256: diff.beforeSha256 }),
			});
		}

		if (input.operationKind !== "create-note" && beforeContent === undefined) {
			conflicts.push({
				kind: "target-missing",
				severity: "blocking",
				message: `Cannot stage ${input.operationKind} because ${normalizedTargetPath} is missing.`,
				paths: [normalizedTargetPath],
			});
		}

		if (
			input.expectedBeforeSha256 !== undefined &&
			diff.beforeSha256 !== undefined &&
			input.expectedBeforeSha256 !== diff.beforeSha256
		) {
			conflicts.push({
				kind: "target-changed",
				severity: "blocking",
				message: `Cannot stage ${normalizedTargetPath} because the before hash no longer matches.`,
				paths: [normalizedTargetPath],
				expectedSha256: input.expectedBeforeSha256,
				actualSha256: diff.beforeSha256,
			});
		}

		if (normalizedDestinationPath !== undefined && destinationContent !== undefined) {
			conflicts.push({
				kind: "destination-exists",
				severity: "blocking",
				message: `Cannot move ${normalizedTargetPath} because ${normalizedDestinationPath} already exists.`,
				paths: [normalizedTargetPath, normalizedDestinationPath],
				actualSha256: await createContentSha256(destinationContent),
			});
		}

		if (hasActiveDuplicate(input.existingStagedChanges, normalizedTargetPath, normalizedDestinationPath)) {
			conflicts.push({
				kind: "duplicate-in-flight",
				severity: "blocking",
				message: `An active staged change already targets ${normalizedTargetPath}.`,
				paths: [normalizedTargetPath],
			});
		}

		const createdAt = makeIsoTimestamp((this.options.now?.() ?? new Date()).toISOString());
		const changeId = createStagedChangeId({
			operationKind: input.operationKind,
			targetPath: normalizedTargetPath,
			commandId: input.commandId,
			createdAt,
			...(diff.afterSha256 === undefined ? {} : { afterSha256: diff.afterSha256 }),
			...(normalizedDestinationPath === undefined ? {} : { destinationPath: normalizedDestinationPath }),
		});
		const validationOutput = [...(input.validationOutput ?? []), ...conflicts.map(conflictIssue)];
		const reviewReasons = [
			...reviewReasonsForOperation(input.operationKind),
			...(conflicts.length > 0 ? ["conflict"] : []),
		];
		const backupPathIntent = backupIntentFor(changeId, input.operationKind);
		const operationMetadata = createOperationMetadata(input, normalizedDestinationPath);
		const record: StagedChangeRecord = {
			artifactKind: "staged-change",
			schemaVersion: 1,
			changeId,
			operationKind: input.operationKind,
			status: conflicts.some((conflict) => conflict.severity === "blocking") ? "conflicted" : "review-ready",
			targetPath: normalizedTargetPath,
			createdAt,
			updatedAt: createdAt,
			rationale: input.rationale,
			sourcePaths: sourcePaths.value,
			...(diff.beforeSha256 === undefined ? {} : { beforeSha256: diff.beforeSha256 }),
			...(diff.afterSha256 === undefined ? {} : { afterSha256: diff.afterSha256 }),
			diff,
			conflicts,
			review: {
				requiresExplicitReview: true,
				destructive: isDestructiveOperation(input.operationKind),
				reasons: reviewReasons,
			},
			recovery: {
				commandId: input.commandId,
				stagedChangeId: changeId,
				targetPath: normalizedTargetPath,
				status: conflicts.length > 0 ? "retryable" : "pending-review",
				...(backupPathIntent === undefined ? {} : { backupPathIntent }),
				validationOutput,
			},
			...(operationMetadata === undefined ? {} : { operationMetadata }),
		};

		return validateStagedChangeRecord(record);
	}
}

export const stageCreateNote = (
	input: StageCreateNoteInput,
	options?: StagedChangeServiceOptions,
): Promise<ValidationResult<StagedChangeRecord>> => new StagedChangeService(options).stageCreateNote(input);

export const stageUpdateNote = (
	input: StageUpdateNoteInput,
	options?: StagedChangeServiceOptions,
): Promise<ValidationResult<StagedChangeRecord>> => new StagedChangeService(options).stageUpdateNote(input);

export const stageDeleteNote = (
	input: StageDeleteNoteInput,
	options?: StagedChangeServiceOptions,
): Promise<ValidationResult<StagedChangeRecord>> => new StagedChangeService(options).stageDeleteNote(input);

export const stageMoveNote = (
	input: StageMoveNoteInput,
	options?: StagedChangeServiceOptions,
): Promise<ValidationResult<StagedChangeRecord>> => new StagedChangeService(options).stageMoveNote(input);

export const stageFrontmatterEdit = (
	input: StageFrontmatterEditInput,
	options?: StagedChangeServiceOptions,
): Promise<ValidationResult<StagedChangeRecord>> => new StagedChangeService(options).stageFrontmatterEdit(input);

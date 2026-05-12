import {
	type DurableJsonRecord,
	type GeneratedMarkdownNote,
	type GeneratedNoteFrontmatter,
	type HotCacheState,
	type IndexMetadata,
	type IsoTimestamp,
	MARKDOWN_ARTIFACT_KINDS,
	type MarkdownArtifactKind,
	type OperationLog,
	type RuntimeState,
	STAGED_CHANGE_CONFLICT_KINDS,
	STAGED_CHANGE_OPERATION_KINDS,
	STAGED_CHANGE_RECOVERY_STATUSES,
	STAGED_CHANGE_STATUSES,
	type SourceManifest,
	type SourceManifestRecord,
	type StagedChangeRecord,
	type ValidationIssue,
	type ValidationResult,
	makeIsoTimestamp,
	makeWikilink,
} from "../types/vault";
import { RUNTIME_STATE_PATH, compareVaultPaths, normalizeVaultPath, validateArtifactPath } from "./vault-paths";

type UnknownRecord = Record<string, unknown>;

const MARKDOWN_ARTIFACT_KIND_SET: ReadonlySet<string> = new Set(MARKDOWN_ARTIFACT_KINDS);
const SOURCE_TYPE_SET: ReadonlySet<string> = new Set([
	"article",
	"book",
	"web-page",
	"user-note",
	"conversation",
	"other",
]);
const ENTITY_TYPE_SET: ReadonlySet<string> = new Set(["person", "organization", "project", "place", "tool", "other"]);
const CONCEPT_TYPE_SET: ReadonlySet<string> = new Set(["principle", "workflow", "claim", "topic", "question", "other"]);
const SUMMARY_TYPE_SET: ReadonlySet<string> = new Set([
	"source-summary",
	"entity-summary",
	"concept-summary",
	"conversation-summary",
]);
const INDEX_KIND_SET: ReadonlySet<string> = new Set(["lexical", "semantic"]);
const INDEX_STATUS_SET: ReadonlySet<string> = new Set(["ready", "building", "stale", "error"]);
const OPERATION_KIND_SET: ReadonlySet<string> = new Set([
	"source-imported",
	"note-indexed",
	"summary-generated",
	"staged-change-created",
]);
const STAGED_CHANGE_OPERATION_SET: ReadonlySet<string> = new Set(STAGED_CHANGE_OPERATION_KINDS);
const STAGED_CHANGE_STATUS_SET: ReadonlySet<string> = new Set(STAGED_CHANGE_STATUSES);
const STAGED_CHANGE_CONFLICT_SET: ReadonlySet<string> = new Set(STAGED_CHANGE_CONFLICT_KINDS);
const STAGED_CHANGE_RECOVERY_STATUS_SET: ReadonlySet<string> = new Set(STAGED_CHANGE_RECOVERY_STATUSES);
const STAGED_CHANGE_CONFLICT_SEVERITY_SET: ReadonlySet<string> = new Set(["warning", "blocking"]);
const STAGED_CHANGE_DIFF_LINE_KIND_SET: ReadonlySet<string> = new Set(["context", "added", "removed"]);

const SECRET_FIELD_NAMES: ReadonlySet<string> = new Set([
	"api-key",
	"apikey",
	"api_key",
	"authorization",
	"bearer",
	"client-secret",
	"clientsecret",
	"client_secret",
	"password",
	"refresh-token",
	"refresh_token",
	"secret",
	"token",
]);

const success = <TValue>(value: TValue): ValidationResult<TValue> => ({ ok: true, value });

const failure = (errors: readonly ValidationIssue[]): ValidationResult<never> => ({ ok: false, errors });

const issue = (code: ValidationIssue["code"], message: string, field?: string): ValidationIssue => {
	if (field === undefined) {
		return { code, message };
	}

	return { code, message, field };
};

const prefixIssueField = (validationIssue: ValidationIssue, prefix: string): ValidationIssue => ({
	...validationIssue,
	field:
		validationIssue.field === undefined || validationIssue.field.length === 0
			? prefix
			: `${prefix}.${validationIssue.field}`,
});

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeFieldName = (field: string): string => field.replaceAll(/[\s_]/g, "-").toLowerCase();

const findSecretLikeFields = (value: unknown, prefix = ""): string[] => {
	if (Array.isArray(value)) {
		return value.flatMap((item, index) => findSecretLikeFields(item, `${prefix}[${index}]`));
	}

	if (!isRecord(value)) {
		return [];
	}

	const found: string[] = [];
	for (const [key, childValue] of Object.entries(value)) {
		const fieldPath = prefix.length > 0 ? `${prefix}.${key}` : key;
		if (SECRET_FIELD_NAMES.has(normalizeFieldName(key))) {
			found.push(fieldPath);
		}
		found.push(...findSecretLikeFields(childValue, fieldPath));
	}

	return found;
};

const validateNoSecretFields = (value: unknown): ValidationIssue[] =>
	findSecretLikeFields(value).map((field) =>
		issue("metadata.secret-field", `Secret-like field is not allowed in durable vault records: ${field}.`, field),
	);

const validateObject = (value: unknown): ValidationResult<UnknownRecord> => {
	if (!isRecord(value)) {
		return failure([issue("metadata.not-object", "Vault metadata must be an object.")]);
	}

	return success(value);
};

const validateRequiredString = (record: UnknownRecord, field: string): ValidationIssue[] => {
	const value = record[field];
	if (typeof value !== "string" || value.trim().length === 0) {
		return [issue("metadata.invalid-type", `${field} must be a non-empty string.`, field)];
	}

	return [];
};

const validateOptionalString = (record: UnknownRecord, field: string): ValidationIssue[] => {
	const value = record[field];
	if (value !== undefined && typeof value !== "string") {
		return [issue("metadata.invalid-type", `${field} must be a string when present.`, field)];
	}

	return [];
};

const validateRequiredNumber = (record: UnknownRecord, field: string): ValidationIssue[] => {
	const value = record[field];
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		return [issue("metadata.invalid-type", `${field} must be a non-negative integer.`, field)];
	}

	return [];
};

const validateOptionalNumber = (record: UnknownRecord, field: string): ValidationIssue[] => {
	const value = record[field];
	if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 0)) {
		return [issue("metadata.invalid-type", `${field} must be a non-negative integer when present.`, field)];
	}

	return [];
};

const validateRequiredBoolean = (record: UnknownRecord, field: string): ValidationIssue[] => {
	if (typeof record[field] !== "boolean") {
		return [issue("metadata.invalid-type", `${field} must be a boolean.`, field)];
	}

	return [];
};

const validateStringArray = (
	record: UnknownRecord,
	field: string,
	options?: { requireNonEmpty?: boolean },
): ValidationIssue[] => {
	const value = record[field];
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
		return [issue("metadata.invalid-type", `${field} must be an array of non-empty strings.`, field)];
	}

	if (options?.requireNonEmpty === true && value.length === 0) {
		return [issue("metadata.missing-source-trace", `${field} must include at least one traceable source.`, field)];
	}

	return [];
};

const validateEnum = (record: UnknownRecord, field: string, allowedValues: ReadonlySet<string>): ValidationIssue[] => {
	const value = record[field];
	if (typeof value !== "string" || !allowedValues.has(value)) {
		return [issue("metadata.invalid-type", `${field} has an unsupported value.`, field)];
	}

	return [];
};

const validateSchemaVersion = (record: UnknownRecord): ValidationIssue[] => {
	if (record.schemaVersion !== 1) {
		return [issue("metadata.invalid-type", "schemaVersion must be 1.", "schemaVersion")];
	}

	return [];
};

const validateIsoTimestamp = (value: unknown, field: string): ValidationIssue[] => {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
		return [issue("metadata.invalid-type", `${field} must be an ISO UTC timestamp.`, field)];
	}

	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp)) {
		return [issue("metadata.invalid-type", `${field} must be a valid timestamp.`, field)];
	}

	return [];
};

const validatePathArray = (
	record: UnknownRecord,
	field: string,
	options?: { requireNonEmpty?: boolean },
): ValidationIssue[] => {
	const value = record[field];
	if (!Array.isArray(value)) {
		return [issue("metadata.invalid-type", `${field} must be an array of vault-relative paths.`, field)];
	}

	if (options?.requireNonEmpty === true && value.length === 0) {
		return [issue("metadata.missing-source-trace", `${field} must include at least one traceable source.`, field)];
	}

	return value.flatMap((path, index) => {
		const normalized = normalizeVaultPath(path);
		if (normalized.ok) {
			return [];
		}

		return normalized.errors.map((error) => ({
			...error,
			field: `${field}[${index}]`,
		}));
	});
};

const validateArtifactPathField = (
	record: UnknownRecord,
	field: string,
	artifactKind: Parameters<typeof validateArtifactPath>[1],
): ValidationIssue[] => {
	const path = validateArtifactPath(record[field], artifactKind);
	if (path.ok) {
		return [];
	}

	return path.errors.map((error) => ({ ...error, field }));
};

const validateStagedTargetPath = (input: unknown, field: string): ValidationIssue[] => {
	const normalized = normalizeVaultPath(input);
	if (!normalized.ok) {
		return normalized.errors.map((error) => ({ ...error, field }));
	}

	if (!normalized.value.endsWith(".md")) {
		return [issue("path.invalid-extension", "Staged-change target paths must reference markdown notes.", field)];
	}

	if (normalized.value.startsWith(".voidbrain/")) {
		return [
			issue(
				"path.unsupported-location",
				"Staged-change target paths cannot mutate Voidbrain support records.",
				field,
			),
		];
	}

	return [];
};

const validateOptionalStagedTargetPath = (record: UnknownRecord, field: string): ValidationIssue[] =>
	record[field] === undefined ? [] : validateStagedTargetPath(record[field], field);

const validateCommonFrontmatter = (record: UnknownRecord, requireSourceTrace: boolean): ValidationIssue[] => [
	...validateRequiredString(record, "voidbrain-id"),
	...validateIsoTimestamp(record["created-at"], "created-at"),
	...validateIsoTimestamp(record["updated-at"], "updated-at"),
	...validatePathArray(record, "source-paths", { requireNonEmpty: requireSourceTrace }),
	...validateStringArray(record, "tags"),
];

const validateSourceFrontmatter = (record: UnknownRecord): ValidationIssue[] => [
	...validateCommonFrontmatter(record, false),
	...validateRequiredString(record, "title"),
	...validateEnum(record, "source-type", SOURCE_TYPE_SET),
	...validateOptionalString(record, "source-url"),
	...validateOptionalString(record, "external-id"),
];

const validateEntityFrontmatter = (record: UnknownRecord): ValidationIssue[] => [
	...validateCommonFrontmatter(record, true),
	...validateRequiredString(record, "title"),
	...validateEnum(record, "entity-type", ENTITY_TYPE_SET),
	...validateStringArray(record, "aliases"),
];

const validateConceptFrontmatter = (record: UnknownRecord): ValidationIssue[] => [
	...validateCommonFrontmatter(record, true),
	...validateRequiredString(record, "title"),
	...validateEnum(record, "concept-type", CONCEPT_TYPE_SET),
	...validateStringArray(record, "aliases"),
	...validatePathArray(record, "related-notes"),
];

const validateSummaryFrontmatter = (record: UnknownRecord): ValidationIssue[] => [
	...validateCommonFrontmatter(record, true),
	...validateRequiredString(record, "title"),
	...validateEnum(record, "summary-type", SUMMARY_TYPE_SET),
	...validateArtifactPathField(record, "summary-of", "source"),
	...validateStringArray(record, "citations", { requireNonEmpty: true }),
];

const validateConversationFrontmatter = (record: UnknownRecord): ValidationIssue[] => [
	...validateCommonFrontmatter(record, true),
	...validateRequiredString(record, "title"),
	...validateRequiredString(record, "thread-id"),
	...validateRequiredNumber(record, "message-count"),
	...validateStringArray(record, "participants", { requireNonEmpty: true }),
];

export const validateGeneratedFrontmatter = (
	input: unknown,
	path?: string,
): ValidationResult<GeneratedNoteFrontmatter> => {
	const objectResult = validateObject(input);
	if (!objectResult.ok) {
		return objectResult;
	}

	const record = objectResult.value;
	const errors: ValidationIssue[] = [...validateNoSecretFields(record)];
	const artifactKind = record["artifact-kind"];

	if (typeof artifactKind !== "string" || !MARKDOWN_ARTIFACT_KIND_SET.has(artifactKind)) {
		return failure([
			...errors,
			issue(
				"metadata.unsupported-artifact-kind",
				"artifact-kind is not a supported markdown artifact.",
				"artifact-kind",
			),
		]);
	}

	const validatedArtifactKind = artifactKind as MarkdownArtifactKind;

	if (path !== undefined) {
		const pathResult = validateArtifactPath(path, validatedArtifactKind);
		if (!pathResult.ok) {
			errors.push(...pathResult.errors);
		}
	}

	switch (validatedArtifactKind) {
		case "source":
			errors.push(...validateSourceFrontmatter(record));
			break;
		case "entity":
			errors.push(...validateEntityFrontmatter(record));
			break;
		case "concept":
			errors.push(...validateConceptFrontmatter(record));
			break;
		case "summary":
			errors.push(...validateSummaryFrontmatter(record));
			break;
		case "conversation":
			errors.push(...validateConversationFrontmatter(record));
			break;
		default: {
			const exhaustive: never = validatedArtifactKind;
			errors.push(
				issue(
					"metadata.unsupported-artifact-kind",
					`Unsupported markdown artifact kind reached validator: ${exhaustive}.`,
					"artifact-kind",
				),
			);
		}
	}

	if (errors.length > 0) {
		return failure(errors);
	}

	return success(record as unknown as GeneratedNoteFrontmatter);
};

const validateSourceManifestRecord = (record: UnknownRecord): ValidationIssue[] => [
	...validateRequiredString(record, "id"),
	...validateArtifactPathField(record, "path", "source"),
	...validateRequiredString(record, "title"),
	...validateEnum(record, "sourceType", SOURCE_TYPE_SET),
	...validateOptionalString(record, "sourceUrl"),
	...validateRequiredString(record, "contentSha256"),
	...validateIsoTimestamp(record.createdAt, "createdAt"),
	...validateIsoTimestamp(record.updatedAt, "updatedAt"),
	...validateStringArray(record, "tags"),
];

const validateRecordArray = (
	record: UnknownRecord,
	field: string,
	validateItem: (item: UnknownRecord) => ValidationIssue[],
): ValidationIssue[] => {
	const value = record[field];
	if (!Array.isArray(value)) {
		return [issue("metadata.invalid-type", `${field} must be an array.`, field)];
	}

	return value.flatMap((item, index) => {
		if (!isRecord(item)) {
			return [issue("metadata.not-object", `${field}[${index}] must be an object.`, `${field}[${index}]`)];
		}

		return validateItem(item).map((error) => ({
			...error,
			field: error.field === undefined ? `${field}[${index}]` : `${field}[${index}].${error.field}`,
		}));
	});
};

const validateDeterministicSourceOrdering = (records: readonly SourceManifestRecord[]): ValidationIssue[] => {
	for (let index = 1; index < records.length; index += 1) {
		const previous = records[index - 1];
		const current = records[index];
		if (previous !== undefined && current !== undefined && compareVaultPaths(previous.path, current.path) > 0) {
			return [issue("record.unsorted", "Source manifest records must be sorted by path.", "records")];
		}
	}

	return [];
};

export const validateSourceManifest = (input: unknown): ValidationResult<SourceManifest> => {
	const objectResult = validateObject(input);
	if (!objectResult.ok) {
		return objectResult;
	}

	const record = objectResult.value;
	const errors: ValidationIssue[] = [
		...validateNoSecretFields(record),
		...validateSchemaVersion(record),
		...validateIsoTimestamp(record.generatedAt, "generatedAt"),
		...validateRecordArray(record, "records", validateSourceManifestRecord),
	];

	if (record.artifactKind !== "source-manifest") {
		errors.push(
			issue("metadata.unsupported-artifact-kind", "artifactKind must be source-manifest.", "artifactKind"),
		);
	}

	if (errors.length === 0) {
		errors.push(...validateDeterministicSourceOrdering(record.records as SourceManifestRecord[]));
	}

	if (errors.length > 0) {
		return failure(errors);
	}

	return success(record as unknown as SourceManifest);
};

const validateIndexMetadataRecord = (record: UnknownRecord): ValidationIssue[] => [
	...validateSchemaVersion(record),
	...validateRequiredString(record, "indexId"),
	...validateEnum(record, "indexKind", INDEX_KIND_SET),
	...validateEnum(record, "status", INDEX_STATUS_SET),
	...validateIsoTimestamp(record.updatedAt, "updatedAt"),
	...validatePathArray(record, "sourcePaths"),
	...validateOptionalString(record, "embeddingModelFamily"),
];

const validateHotCacheEntry = (record: UnknownRecord): ValidationIssue[] => [
	...validateRequiredString(record, "key"),
	...validateArtifactPathField(record, "path", "source"),
	...validateIsoTimestamp(record.lastAccessedAt, "lastAccessedAt"),
	...validateRequiredString(record, "summary"),
];

const validateHotCacheRecord = (record: UnknownRecord): ValidationIssue[] => [
	...validateSchemaVersion(record),
	...validateRequiredString(record, "cacheId"),
	...validateIsoTimestamp(record.updatedAt, "updatedAt"),
	...validateRecordArray(record, "entries", validateHotCacheEntry),
];

const validateOperationLogEntry = (record: UnknownRecord): ValidationIssue[] => [
	...validateRequiredString(record, "id"),
	...validateEnum(record, "operationKind", OPERATION_KIND_SET),
	...validateIsoTimestamp(record.occurredAt, "occurredAt"),
	...validateEnum(record, "status", new Set(["succeeded", "failed"])),
	...validateRequiredString(record, "summary"),
	...validatePathArray(record, "paths"),
];

const validateOperationLogRecord = (record: UnknownRecord): ValidationIssue[] => [
	...validateSchemaVersion(record),
	...validateRequiredString(record, "logId"),
	...validateRecordArray(record, "entries", validateOperationLogEntry),
];

const validateDiffLine = (record: UnknownRecord): ValidationIssue[] => [
	...validateEnum(record, "kind", STAGED_CHANGE_DIFF_LINE_KIND_SET),
	...validateOptionalNumber(record, "oldLineNumber"),
	...validateOptionalNumber(record, "newLineNumber"),
	...(typeof record.content === "string"
		? []
		: [issue("metadata.invalid-type", "content must be a string.", "content")]),
];

const validateStagedChangeDiff = (record: UnknownRecord): ValidationIssue[] => {
	const diff = record.diff;
	if (!isRecord(diff)) {
		return [issue("metadata.not-object", "diff must be an object.", "diff")];
	}

	return [
		...validateOptionalString(diff, "beforeContent"),
		...validateOptionalString(diff, "afterContent"),
		...validateOptionalString(diff, "beforeSha256"),
		...validateOptionalString(diff, "afterSha256"),
		...validateRequiredBoolean(diff, "hasTextChanges"),
		...validateRecordArray(diff, "lineDiff", validateDiffLine),
	].map((error) => prefixIssueField(error, "diff"));
};

const validateStagedChangeConflict = (record: UnknownRecord): ValidationIssue[] => [
	...validateEnum(record, "kind", STAGED_CHANGE_CONFLICT_SET),
	...validateEnum(record, "severity", STAGED_CHANGE_CONFLICT_SEVERITY_SET),
	...validateRequiredString(record, "message"),
	...validatePathArray(record, "paths"),
	...validateOptionalString(record, "expectedSha256"),
	...validateOptionalString(record, "actualSha256"),
];

const validateStagedChangeReview = (record: UnknownRecord): ValidationIssue[] => {
	const review = record.review;
	if (!isRecord(review)) {
		return [issue("metadata.not-object", "review must be an object.", "review")];
	}

	return [
		...validateRequiredBoolean(review, "requiresExplicitReview"),
		...validateRequiredBoolean(review, "destructive"),
		...validateStringArray(review, "reasons", { requireNonEmpty: true }),
	].map((error) => prefixIssueField(error, "review"));
};

const validateStoredValidationIssue = (record: UnknownRecord): ValidationIssue[] => [
	...validateRequiredString(record, "code"),
	...validateRequiredString(record, "message"),
	...validateOptionalString(record, "path"),
	...validateOptionalString(record, "field"),
];

const validateStagedChangeRecovery = (record: UnknownRecord): ValidationIssue[] => {
	const recovery = record.recovery;
	if (!isRecord(recovery)) {
		return [issue("metadata.not-object", "recovery must be an object.", "recovery")];
	}

	return [
		...validateRequiredString(recovery, "commandId"),
		...validateRequiredString(recovery, "stagedChangeId"),
		...validateStagedTargetPath(recovery.targetPath, "targetPath"),
		...validateEnum(recovery, "status", STAGED_CHANGE_RECOVERY_STATUS_SET),
		...(recovery.backupPathIntent === undefined
			? []
			: normalizeVaultPath(recovery.backupPathIntent).ok
				? []
				: [issue("path.unsupported-location", "backupPathIntent must be vault-relative.", "backupPathIntent")]),
		...validateRecordArray(recovery, "validationOutput", validateStoredValidationIssue),
		...(recovery.rejectedAt === undefined ? [] : validateIsoTimestamp(recovery.rejectedAt, "rejectedAt")),
		...(recovery.failedAt === undefined ? [] : validateIsoTimestamp(recovery.failedAt, "failedAt")),
		...validateOptionalString(recovery, "lastFailureMessage"),
	].map((error) => prefixIssueField(error, "recovery"));
};

const isStagedFrontmatterValue = (value: unknown): boolean => {
	if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
		return true;
	}

	return Array.isArray(value) && value.every((item) => isStagedFrontmatterValue(item) && !Array.isArray(item));
};

const validateFrontmatterPatchEntry = (record: UnknownRecord): ValidationIssue[] => [
	...validateRequiredString(record, "key"),
	...(record.before === undefined || isStagedFrontmatterValue(record.before)
		? []
		: [issue("metadata.invalid-type", "before must be a frontmatter primitive or array.", "before")]),
	...(record.after === undefined || isStagedFrontmatterValue(record.after)
		? []
		: [issue("metadata.invalid-type", "after must be a frontmatter primitive or array.", "after")]),
];

const validateStagedOperationMetadata = (record: UnknownRecord): ValidationIssue[] => {
	const operationKind = record.operationKind;
	const metadata = record.operationMetadata;
	if (metadata === undefined) {
		return operationKind === "move-note" || operationKind === "update-frontmatter"
			? [
					issue(
						"metadata.missing-field",
						"operationMetadata is required for move-note and update-frontmatter.",
						"operationMetadata",
					),
				]
			: [];
	}

	if (!isRecord(metadata)) {
		return [issue("metadata.not-object", "operationMetadata must be an object.", "operationMetadata")];
	}

	const errors = [
		...validateOptionalStagedTargetPath(metadata, "destinationPath"),
		...(metadata.frontmatterPatch === undefined
			? []
			: validateRecordArray(metadata, "frontmatterPatch", validateFrontmatterPatchEntry)),
	].map((error) => prefixIssueField(error, "operationMetadata"));

	if (operationKind === "move-note" && metadata.destinationPath === undefined) {
		errors.push(
			issue(
				"metadata.missing-field",
				"move-note staged changes require operationMetadata.destinationPath.",
				"operationMetadata.destinationPath",
			),
		);
	}

	if (operationKind === "update-frontmatter" && metadata.frontmatterPatch === undefined) {
		errors.push(
			issue(
				"metadata.missing-field",
				"update-frontmatter staged changes require operationMetadata.frontmatterPatch.",
				"operationMetadata.frontmatterPatch",
			),
		);
	}

	return errors;
};

const validateStagedChangeRecordShape = (record: UnknownRecord): ValidationIssue[] => [
	...validateSchemaVersion(record),
	...validateRequiredString(record, "changeId"),
	...validateEnum(record, "operationKind", STAGED_CHANGE_OPERATION_SET),
	...validateEnum(record, "status", STAGED_CHANGE_STATUS_SET),
	...validateStagedTargetPath(record.targetPath, "targetPath"),
	...validateIsoTimestamp(record.createdAt, "createdAt"),
	...validateIsoTimestamp(record.updatedAt, "updatedAt"),
	...validateRequiredString(record, "rationale"),
	...validatePathArray(record, "sourcePaths", { requireNonEmpty: true }),
	...validateOptionalString(record, "beforeSha256"),
	...validateOptionalString(record, "afterSha256"),
	...validateStagedChangeDiff(record),
	...validateRecordArray(record, "conflicts", validateStagedChangeConflict),
	...validateStagedChangeReview(record),
	...validateStagedChangeRecovery(record),
	...validateStagedOperationMetadata(record),
	...(Array.isArray(record.conflicts) &&
	record.conflicts.some((conflict) => isRecord(conflict) && conflict.severity === "blocking") &&
	record.status !== "conflicted"
		? [issue("record.invalid-state", "Blocking staged-change conflicts require conflicted status.", "status")]
		: []),
	...(Array.isArray(record.conflicts) && record.conflicts.length === 0 && record.status === "conflicted"
		? [issue("record.invalid-state", "Conflicted staged-change status requires at least one conflict.", "status")]
		: []),
];

const validateRuntimeStagedChangeRecord = (record: UnknownRecord): ValidationIssue[] => {
	const errors = validateStagedChangeRecordShape(record);
	if (record.artifactKind !== "staged-change") {
		errors.push(issue("metadata.unsupported-artifact-kind", "artifactKind must be staged-change.", "artifactKind"));
	}

	return errors;
};

const validateSupportRecord = <TValue>(
	input: unknown,
	artifactKind: string,
	validateShape: (record: UnknownRecord) => ValidationIssue[],
): ValidationResult<TValue> => {
	const objectResult = validateObject(input);
	if (!objectResult.ok) {
		return objectResult;
	}

	const record = objectResult.value;
	const errors: ValidationIssue[] = [...validateNoSecretFields(record), ...validateShape(record)];
	if (record.artifactKind !== artifactKind) {
		errors.push(
			issue("metadata.unsupported-artifact-kind", `artifactKind must be ${artifactKind}.`, "artifactKind"),
		);
	}

	if (errors.length > 0) {
		return failure(errors);
	}

	return success(record as unknown as TValue);
};

export const validateIndexMetadata = (input: unknown): ValidationResult<IndexMetadata> =>
	validateSupportRecord(input, "index-metadata", validateIndexMetadataRecord);

export const validateHotCacheState = (input: unknown): ValidationResult<HotCacheState> =>
	validateSupportRecord(input, "hot-cache", validateHotCacheRecord);

export const validateOperationLog = (input: unknown): ValidationResult<OperationLog> =>
	validateSupportRecord(input, "operation-log", validateOperationLogRecord);

export const validateStagedChangeRecord = (input: unknown): ValidationResult<StagedChangeRecord> =>
	validateSupportRecord(input, "staged-change", validateStagedChangeRecordShape);

export const validateRuntimeState = (input: unknown): ValidationResult<RuntimeState> => {
	const objectResult = validateObject(input);
	if (!objectResult.ok) {
		return objectResult;
	}

	const record = objectResult.value;
	const errors: ValidationIssue[] = [...validateNoSecretFields(record), ...validateSchemaVersion(record)];

	const indexMetadata = validateIndexMetadata(record.indexMetadata);
	const hotCache = validateHotCacheState(record.hotCache);
	const operationLog = validateOperationLog(record.operationLog);
	const stagedChanges = validateRecordArray(record, "stagedChanges", validateRuntimeStagedChangeRecord);

	if (!indexMetadata.ok) {
		errors.push(...indexMetadata.errors.map((error) => prefixIssueField(error, "indexMetadata")));
	}
	if (!hotCache.ok) {
		errors.push(...hotCache.errors.map((error) => prefixIssueField(error, "hotCache")));
	}
	if (!operationLog.ok) {
		errors.push(...operationLog.errors.map((error) => prefixIssueField(error, "operationLog")));
	}
	errors.push(...stagedChanges);

	if (errors.length > 0) {
		return failure(errors);
	}

	return success(record as unknown as RuntimeState);
};

export const validateDurableJsonRecord = (input: unknown): ValidationResult<DurableJsonRecord> => {
	const objectResult = validateObject(input);
	if (!objectResult.ok) {
		return objectResult;
	}

	const record = objectResult.value;
	if (record.artifactKind === "source-manifest") {
		return validateSourceManifest(record);
	}
	if (record.artifactKind === "index-metadata") {
		return validateIndexMetadata(record);
	}
	if (record.artifactKind === "hot-cache") {
		return validateHotCacheState(record);
	}
	if (record.artifactKind === "operation-log") {
		return validateOperationLog(record);
	}
	if (record.artifactKind === "staged-change") {
		return validateStagedChangeRecord(record);
	}
	if (record.schemaVersion === 1 && "indexMetadata" in record && "hotCache" in record && "operationLog" in record) {
		return validateRuntimeState(record);
	}

	return failure([
		issue("metadata.unsupported-artifact-kind", "Unsupported durable JSON artifact kind.", "artifactKind"),
	]);
};

export interface ParsedMarkdownFrontmatter {
	readonly frontmatter: UnknownRecord;
	readonly body: string;
}

const parseInlineArray = (value: string): string[] =>
	value
		.slice(1, -1)
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);

const parseFrontmatterValue = (value: string): string | number | string[] => {
	const trimmedValue = value.trim();
	if (trimmedValue === "[]") {
		return [];
	}

	if (trimmedValue.startsWith("[") && trimmedValue.endsWith("]")) {
		return parseInlineArray(trimmedValue);
	}

	if (/^\d+$/.test(trimmedValue)) {
		return Number(trimmedValue);
	}

	return trimmedValue;
};

export const parseMarkdownFrontmatter = (markdown: string): ValidationResult<ParsedMarkdownFrontmatter> => {
	if (!markdown.startsWith("---\n")) {
		return failure([
			issue("metadata.missing-field", "Markdown fixture must start with frontmatter.", "frontmatter"),
		]);
	}

	const endMarker = "\n---\n";
	const endIndex = markdown.indexOf(endMarker, 4);
	if (endIndex === -1) {
		return failure([
			issue("metadata.missing-field", "Markdown fixture frontmatter must have a closing marker.", "frontmatter"),
		]);
	}

	const frontmatterBlock = markdown.slice(4, endIndex);
	const body = markdown.slice(endIndex + endMarker.length);
	const frontmatter: UnknownRecord = {};
	const errors: ValidationIssue[] = [];

	for (const [index, line] of frontmatterBlock.split("\n").entries()) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf(":");
		if (separatorIndex === -1) {
			errors.push(
				issue("metadata.invalid-type", `Invalid frontmatter line ${index + 1}.`, `frontmatter.${index + 1}`),
			);
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const rawValue = trimmedLine.slice(separatorIndex + 1);
		if (key.length === 0) {
			errors.push(
				issue(
					"metadata.missing-field",
					`Frontmatter line ${index + 1} has no key.`,
					`frontmatter.${index + 1}`,
				),
			);
			continue;
		}

		frontmatter[key] = parseFrontmatterValue(rawValue);
	}

	if (errors.length > 0) {
		return failure(errors);
	}

	return success({ frontmatter, body });
};

const extractWikilinks = (body: string) =>
	Array.from(body.matchAll(/\[\[([^\]]+)]]/g), (match) => makeWikilink(match[1] ?? ""));

export const validateMarkdownArtifactFixture = (
	path: string,
	markdown: string,
): ValidationResult<GeneratedMarkdownNote> => {
	const parsed = parseMarkdownFrontmatter(markdown);
	if (!parsed.ok) {
		return parsed;
	}

	const frontmatter = validateGeneratedFrontmatter(parsed.value.frontmatter, path);
	if (!frontmatter.ok) {
		return frontmatter;
	}

	const normalizedPath = validateArtifactPath(path, frontmatter.value["artifact-kind"]);
	if (!normalizedPath.ok) {
		return normalizedPath;
	}

	return success({
		path: normalizedPath.value,
		frontmatter: frontmatter.value,
		body: parsed.value.body,
		wikilinks: extractWikilinks(parsed.value.body),
	});
};

export const validateJsonArtifactFixture = (path: string, value: unknown): ValidationResult<DurableJsonRecord> => {
	const durableRecord = validateDurableJsonRecord(value);
	if (!durableRecord.ok) {
		return durableRecord;
	}

	const normalizedPath = normalizeVaultPath(path);
	if (!normalizedPath.ok) {
		return normalizedPath;
	}

	if (normalizedPath.value === RUNTIME_STATE_PATH) {
		const runtimePath = validateArtifactPath(path, "index-metadata");
		if (!runtimePath.ok) {
			return runtimePath;
		}

		return durableRecord;
	}

	if ("artifactKind" in durableRecord.value) {
		const pathResult = validateArtifactPath(path, durableRecord.value.artifactKind);
		if (!pathResult.ok) {
			return pathResult;
		}

		return durableRecord;
	}

	return failure([
		issue("path.unsupported-location", "Runtime state must be stored at .voidbrain/runtime-state.json.", "path"),
	]);
};

export const coerceIsoTimestamp = (timestamp: string): ValidationResult<IsoTimestamp> => {
	const errors = validateIsoTimestamp(timestamp, "timestamp");
	if (errors.length > 0) {
		return failure(errors);
	}

	return success(makeIsoTimestamp(timestamp));
};

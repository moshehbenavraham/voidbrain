import {
	ECOSYSTEM_HANDOFF_ISSUE_CODES,
	ECOSYSTEM_HANDOFF_LOCAL_MODES,
	ECOSYSTEM_HANDOFF_MODES,
	ECOSYSTEM_HANDOFF_OUTPUT_KINDS,
	ECOSYSTEM_HANDOFF_REVIEW_MODES,
	ECOSYSTEM_HANDOFF_UNSUPPORTED_MODES,
	type EcosystemHandoffChecksum,
	type EcosystemHandoffCitationEvidence,
	type EcosystemHandoffDiagnostic,
	type EcosystemHandoffDisclosureState,
	type EcosystemHandoffIssue,
	type EcosystemHandoffIssueCode,
	type EcosystemHandoffMode,
	type EcosystemHandoffOutcome,
	type EcosystemHandoffOutputKind,
	type EcosystemHandoffPlan,
	type EcosystemHandoffPlanAction,
	type EcosystemHandoffPlanningInput,
	type EcosystemHandoffPlanningResult,
	type EcosystemHandoffRecoveryRecord,
	type EcosystemHandoffSelectedOutput,
} from "../types/ecosystem-handoff";
import { createRedactedLineExcerpt, redactSensitiveValidationText } from "./agent-validation-reporting";

interface NormalizedHandoffInput {
	readonly input: EcosystemHandoffPlanningInput & {
		readonly mode: EcosystemHandoffMode;
		readonly selectedOutputs: readonly EcosystemHandoffSelectedOutput[];
		readonly disclosure?: EcosystemHandoffDisclosureState | undefined;
	};
	readonly issues: readonly EcosystemHandoffIssue[];
}

interface TextSafetyCandidate {
	readonly outputId?: string | undefined;
	readonly path?: string | undefined;
	readonly field: string;
	readonly value: string;
}

const defaultMode: EcosystemHandoffMode = "filesystem";
const defaultGeneratedAt = "2026-05-13T00:00:00.000Z";
const checksumPattern = /^[a-f0-9]{64}$/i;
const secretLikeKeyPattern = /\b(api[_-]?key|access[_-]?key|secret|token|password)\b\s*[:=]/i;
const authorizationHeaderPattern = /\bauthorization\s*:|\bBearer\s+[A-Za-z0-9._-]{12,}\b/i;
const credentialLikeValuePattern =
	/\b(sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/;
const privatePathHintPattern =
	/(^|[\s"'(])((\/Users\/[A-Za-z0-9._-]+)|(\/home\/[A-Za-z0-9._-]+)|([A-Za-z]:\\Users\\[^\\\s]+))/;
const promptBodyPattern = /\b(system|developer|user|assistant)\s+prompt\s+(body|text|content)\s*[:=]/i;
const hiddenProviderStatePattern = /\b(raw\s+hidden\s+provider\s+state|hidden[_ -]?provider[_ -]?state)\s*[:=]/i;
const rawNoteBodyPattern = /\b(raw\s+note\s+body|note\s+body|beforeContent|afterContent)\s*[:=]/i;
const unsupportedPublishingTargetPattern =
	/\b(confluence|notion|slack|hosted\s+sync|team\s+knowledge|knowledge-base|publish(?:ing)?|external\s+service)\b|^https?:\/\//i;

const rawPayloadKeys = new Set([
	"authorizationheader",
	"beforecontent",
	"aftercontent",
	"body",
	"content",
	"hiddenproviderstate",
	"prompt",
	"promptbody",
	"rawbody",
	"rawnotebody",
]);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string");

export const isEcosystemHandoffMode = (value: unknown): value is EcosystemHandoffMode =>
	typeof value === "string" && (ECOSYSTEM_HANDOFF_MODES as readonly string[]).includes(value);

export const isEcosystemHandoffOutputKind = (value: unknown): value is EcosystemHandoffOutputKind =>
	typeof value === "string" && (ECOSYSTEM_HANDOFF_OUTPUT_KINDS as readonly string[]).includes(value);

export const isLocalEcosystemHandoffMode = (value: EcosystemHandoffMode): boolean =>
	(ECOSYSTEM_HANDOFF_LOCAL_MODES as readonly string[]).includes(value);

export const isReviewEcosystemHandoffMode = (value: EcosystemHandoffMode): boolean =>
	(ECOSYSTEM_HANDOFF_REVIEW_MODES as readonly string[]).includes(value);

export const isUnsupportedEcosystemHandoffMode = (value: EcosystemHandoffMode): boolean =>
	(ECOSYSTEM_HANDOFF_UNSUPPORTED_MODES as readonly string[]).includes(value);

const asNonEmptyString = (value: unknown): string | undefined =>
	typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const normalizeHandoffPath = (path: string): string =>
	path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/\/$/, "");

const sanitizeText = (value: string): string => redactSensitiveValidationText(value);

const sanitizePath = (path: string | undefined): string | undefined =>
	path === undefined ? undefined : sanitizeText(path);

const uniqueSortedStrings = (values: readonly string[]): readonly string[] =>
	[...new Set(values)].sort((left, right) => left.localeCompare(right));

const isFullVaultSelectionPath = (path: string): boolean => {
	const normalized = normalizeHandoffPath(path).toLowerCase();
	return (
		normalized === "" ||
		normalized === "." ||
		normalized === "/" ||
		normalized === "*" ||
		normalized === "**" ||
		normalized === "vault" ||
		normalized === "fixtures/demo-vault" ||
		normalized === "test/fixtures/vault" ||
		normalized.endsWith("/**")
	);
};

const createIssue = (input: {
	readonly code: EcosystemHandoffIssueCode;
	readonly message: string;
	readonly remediation: string;
	readonly path?: string | undefined;
	readonly outputId?: string | undefined;
	readonly mode?: string | undefined;
	readonly target?: string | undefined;
	readonly excerpt?: string | undefined;
	readonly recovery?: EcosystemHandoffRecoveryRecord | undefined;
}): EcosystemHandoffIssue => ({
	code: input.code,
	message: sanitizeText(input.message),
	remediation: sanitizeText(input.remediation),
	path: sanitizePath(input.path),
	outputId: input.outputId,
	mode: input.mode,
	target: sanitizePath(input.target),
	excerpt: input.excerpt === undefined ? undefined : createRedactedLineExcerpt(input.excerpt),
	recovery: input.recovery,
});

export const sortEcosystemHandoffIssues = (
	issues: readonly EcosystemHandoffIssue[],
): readonly EcosystemHandoffIssue[] =>
	[
		...new Map(
			issues.map((issue) => [
				[
					issue.path ?? "",
					issue.outputId ?? "",
					issue.mode ?? "",
					issue.target ?? "",
					issue.code,
					issue.message,
				].join(":"),
				issue,
			]),
		).values(),
	].sort((left, right) => {
		const leftKey = `${left.path ?? ""}:${left.outputId ?? ""}:${left.code}:${left.message}`;
		const rightKey = `${right.path ?? ""}:${right.outputId ?? ""}:${right.code}:${right.message}`;
		return leftKey.localeCompare(rightKey);
	});

const sortCitations = (
	citations: readonly EcosystemHandoffCitationEvidence[] | undefined,
): readonly EcosystemHandoffCitationEvidence[] | undefined => {
	if (citations === undefined) {
		return undefined;
	}

	return [...citations].sort((left, right) => {
		const leftKey = `${left.vaultPath}:${left.heading}:${left.citationId}:${left.sourceRecordId ?? ""}`;
		const rightKey = `${right.vaultPath}:${right.heading}:${right.citationId}:${right.sourceRecordId ?? ""}`;
		return leftKey.localeCompare(rightKey);
	});
};

const sortSelectedOutputs = (
	outputs: readonly EcosystemHandoffSelectedOutput[],
): readonly EcosystemHandoffSelectedOutput[] =>
	[...outputs]
		.map((output) => ({
			...output,
			citations: sortCitations(output.citations),
			validationOutput:
				output.validationOutput === undefined ? undefined : uniqueSortedStrings(output.validationOutput),
		}))
		.sort((left, right) => {
			const leftKey = `${left.path}:${left.kind}:${left.id}`;
			const rightKey = `${right.path}:${right.kind}:${right.id}`;
			return leftKey.localeCompare(rightKey);
		});

const normalizeChecksum = (value: unknown): EcosystemHandoffChecksum | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}

	const algorithm = value.algorithm === "sha256" ? "sha256" : undefined;
	const checksumValue = asNonEmptyString(value.value);
	if (algorithm === undefined || checksumValue === undefined) {
		return undefined;
	}

	return {
		algorithm,
		value: checksumValue,
	};
};

const normalizeCitation = (
	value: unknown,
	outputId: string,
	outputPath: string,
): EcosystemHandoffCitationEvidence | EcosystemHandoffIssue => {
	if (!isRecord(value)) {
		return createIssue({
			code: "handoff.invalid-input",
			message: "Citation evidence must be an object.",
			remediation: "Pass citation evidence with vaultPath, heading, citationId, and optional sourceRecordId.",
			path: outputPath,
			outputId,
		});
	}

	const vaultPath = asNonEmptyString(value.vaultPath);
	const heading = asNonEmptyString(value.heading);
	const citationId = asNonEmptyString(value.citationId);

	if (vaultPath === undefined || heading === undefined || citationId === undefined) {
		return createIssue({
			code: "handoff.missing-citation",
			message: "Citation evidence must include vault path, heading, and citation ID.",
			remediation: "Preserve vaultPath, heading, and citationId for grounded handoff output.",
			path: outputPath,
			outputId,
		});
	}

	return {
		vaultPath: normalizeHandoffPath(vaultPath),
		heading,
		citationId,
		sourceRecordId: asNonEmptyString(value.sourceRecordId),
	};
};

const normalizeRecovery = (value: unknown): EcosystemHandoffRecoveryRecord | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}

	const validationOutput = isStringArray(value.validationOutput)
		? uniqueSortedStrings(value.validationOutput)
		: undefined;

	return {
		commandId: asNonEmptyString(value.commandId),
		targetPath:
			typeof value.targetPath === "string" ? sanitizeText(normalizeHandoffPath(value.targetPath)) : undefined,
		cachePath:
			typeof value.cachePath === "string" ? sanitizeText(normalizeHandoffPath(value.cachePath)) : undefined,
		stagedChangeId: asNonEmptyString(value.stagedChangeId),
		reportId: asNonEmptyString(value.reportId),
		artifactPath:
			typeof value.artifactPath === "string" ? sanitizeText(normalizeHandoffPath(value.artifactPath)) : undefined,
		validationOutput,
		issueCode:
			typeof value.issueCode === "string" &&
			(ECOSYSTEM_HANDOFF_ISSUE_CODES as readonly string[]).includes(value.issueCode)
				? (value.issueCode as EcosystemHandoffIssueCode)
				: undefined,
		retryGuidance: asNonEmptyString(value.retryGuidance),
	};
};

const rawPayloadIssuesForRecord = (
	record: Readonly<Record<string, unknown>>,
	outputId: string,
	outputPath: string,
): readonly EcosystemHandoffIssue[] => {
	const issues: EcosystemHandoffIssue[] = [];

	for (const key of Object.keys(record)) {
		if (!rawPayloadKeys.has(key.toLowerCase())) {
			continue;
		}

		issues.push(
			createIssue({
				code: key.toLowerCase().includes("prompt")
					? "handoff.prompt-body"
					: key.toLowerCase().includes("provider")
						? "handoff.hidden-provider-state"
						: key.toLowerCase().includes("authorization")
							? "handoff.authorization-header"
							: "handoff.raw-note-body",
				message: `Selected output includes unsafe raw payload field: ${key}.`,
				remediation:
					"Remove raw note bodies, prompt bodies, authorization headers, and hidden provider state from handoff inputs.",
				path: outputPath,
				outputId,
				excerpt: key,
			}),
		);
	}

	return issues;
};

const normalizeSelectedOutput = (
	value: unknown,
	index: number,
): {
	readonly output?: EcosystemHandoffSelectedOutput | undefined;
	readonly issues: readonly EcosystemHandoffIssue[];
} => {
	if (!isRecord(value)) {
		return {
			issues: [
				createIssue({
					code: "handoff.invalid-input",
					message: "Selected output must be an object.",
					remediation: "Pass selected output records with id, kind, path, evidence, and recovery fields.",
					outputId: `selected-output-${index}`,
				}),
			],
		};
	}

	const id = asNonEmptyString(value.id) ?? `selected-output-${index}`;
	const kind = isEcosystemHandoffOutputKind(value.kind) ? value.kind : undefined;
	const path = asNonEmptyString(value.path);
	const issues: EcosystemHandoffIssue[] = [];

	if (kind === undefined) {
		issues.push(
			createIssue({
				code: "handoff.invalid-input",
				message: "Selected output kind is unsupported.",
				remediation: `Use one of: ${ECOSYSTEM_HANDOFF_OUTPUT_KINDS.join(", ")}.`,
				outputId: id,
				excerpt: typeof value.kind === "string" ? value.kind : undefined,
			}),
		);
	}

	if (path === undefined) {
		issues.push(
			createIssue({
				code: "handoff.invalid-input",
				message: "Selected output path is required.",
				remediation: "Pass the selected vault-relative or repository-relative markdown path.",
				outputId: id,
			}),
		);
	}

	const outputPath = path === undefined ? undefined : normalizeHandoffPath(path);
	if (outputPath !== undefined && isFullVaultSelectionPath(outputPath)) {
		issues.push(
			createIssue({
				code: "handoff.full-vault-selection",
				message: "Selected output points at a full vault or wildcard path.",
				remediation:
					"Select specific markdown outputs instead of a vault root, wildcard, or fixture vault root.",
				path: outputPath,
				outputId: id,
			}),
		);
	}

	if (kind === undefined || outputPath === undefined) {
		return {
			issues,
		};
	}

	issues.push(...rawPayloadIssuesForRecord(value, id, outputPath));

	const citations: EcosystemHandoffCitationEvidence[] = [];
	if (Array.isArray(value.citations)) {
		for (const citationValue of value.citations) {
			const citation = normalizeCitation(citationValue, id, outputPath);
			if ("code" in citation) {
				issues.push(citation);
			} else {
				citations.push(citation);
			}
		}
	}

	const validationOutput = isStringArray(value.validationOutput)
		? uniqueSortedStrings(value.validationOutput)
		: undefined;

	const output: EcosystemHandoffSelectedOutput = {
		id,
		kind,
		path: outputPath,
		title: asNonEmptyString(value.title),
		heading: asNonEmptyString(value.heading),
		grounded: typeof value.grounded === "boolean" ? value.grounded : undefined,
		summary: asNonEmptyString(value.summary),
		citations: citations.length > 0 ? sortCitations(citations) : undefined,
		sourceRecordId: asNonEmptyString(value.sourceRecordId),
		stagedChangeId: asNonEmptyString(value.stagedChangeId),
		reportId: asNonEmptyString(value.reportId),
		artifactPath: typeof value.artifactPath === "string" ? normalizeHandoffPath(value.artifactPath) : undefined,
		checksum: normalizeChecksum(value.checksum),
		validationOutput,
		recovery: normalizeRecovery(value.recovery),
	};

	return {
		output,
		issues,
	};
};

export const normalizeEcosystemHandoffSelectedOutputs = (
	value: unknown,
): {
	readonly selectedOutputs: readonly EcosystemHandoffSelectedOutput[];
	readonly issues: readonly EcosystemHandoffIssue[];
} => {
	if (!Array.isArray(value) || value.length === 0) {
		return {
			selectedOutputs: [],
			issues: [
				createIssue({
					code: "handoff.missing-selection",
					message: "Ecosystem handoff requires at least one explicitly selected output.",
					remediation:
						"Pass selected markdown reports, source records, staged-change summaries, release evidence, or package surfaces.",
				}),
			],
		};
	}

	const selectedOutputs: EcosystemHandoffSelectedOutput[] = [];
	const issues: EcosystemHandoffIssue[] = [];

	for (const [index, candidate] of value.entries()) {
		const normalized = normalizeSelectedOutput(candidate, index);
		if (normalized.output !== undefined) {
			selectedOutputs.push(normalized.output);
		}
		issues.push(...normalized.issues);
	}

	return {
		selectedOutputs: sortSelectedOutputs(selectedOutputs),
		issues: sortEcosystemHandoffIssues(issues),
	};
};

const normalizeDisclosure = (value: unknown): EcosystemHandoffDisclosureState | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}

	return {
		providerReviewed: value.providerReviewed === true,
		providerTrusted: value.providerTrusted === true,
		authReady: value.authReady === true,
		capabilityConfirmed: value.capabilityConfirmed === true,
		disclosureApproved: value.disclosureApproved === true,
		providerId: asNonEmptyString(value.providerId),
		target: asNonEmptyString(value.target),
	};
};

export const validateEcosystemHandoffInput = (input: unknown): NormalizedHandoffInput => {
	if (!isRecord(input)) {
		const issues = [
			createIssue({
				code: "handoff.invalid-input",
				message: "Ecosystem handoff planning input must be an object.",
				remediation: "Call handoff planning with { mode, selectedOutputs, target, disclosure, now }.",
			}),
		];

		return {
			input: {
				mode: defaultMode,
				selectedOutputs: [],
				now: new Date(defaultGeneratedAt),
			},
			issues,
		};
	}

	const modeValue = asNonEmptyString(input.mode);
	const mode = isEcosystemHandoffMode(modeValue) ? modeValue : defaultMode;
	const issues: EcosystemHandoffIssue[] = [];

	if (!isEcosystemHandoffMode(modeValue)) {
		issues.push(
			createIssue({
				code: "handoff.unsupported-mode",
				message: "Handoff mode is unsupported.",
				remediation: `Use one of: ${ECOSYSTEM_HANDOFF_MODES.join(", ")}.`,
				mode: modeValue,
				excerpt: modeValue,
			}),
		);
	}

	const normalizedOutputs = normalizeEcosystemHandoffSelectedOutputs(input.selectedOutputs);
	const target = asNonEmptyString(input.target);

	return {
		input: {
			mode,
			selectedOutputs: normalizedOutputs.selectedOutputs,
			target: target === undefined ? undefined : normalizeHandoffPath(target),
			disclosure: normalizeDisclosure(input.disclosure),
			requestId: asNonEmptyString(input.requestId),
			now: input.now instanceof Date ? input.now : undefined,
		},
		issues: sortEcosystemHandoffIssues([...issues, ...normalizedOutputs.issues]),
	};
};

const hasValidationOutput = (output: EcosystemHandoffSelectedOutput): boolean =>
	(output.validationOutput?.length ?? 0) > 0 || (output.recovery?.validationOutput?.length ?? 0) > 0;

const hasSourceRecord = (output: EcosystemHandoffSelectedOutput): boolean =>
	output.sourceRecordId !== undefined ||
	(output.citations ?? []).some((citation) => citation.sourceRecordId !== undefined);

const hasCitationEvidence = (output: EcosystemHandoffSelectedOutput): boolean =>
	(output.citations ?? []).some(
		(citation) =>
			citation.vaultPath.trim().length > 0 &&
			citation.heading.trim().length > 0 &&
			citation.citationId.trim().length > 0,
	);

const evidenceIssuesForOutput = (output: EcosystemHandoffSelectedOutput): readonly EcosystemHandoffIssue[] => {
	const issues: EcosystemHandoffIssue[] = [];
	const needsCitation =
		output.grounded === true || output.kind === "retrieval-summary" || output.kind === "source-record";

	if (needsCitation && !hasCitationEvidence(output)) {
		issues.push(
			createIssue({
				code: "handoff.missing-citation",
				message: "Grounded selected output is missing citation evidence.",
				remediation: "Preserve vault path, heading, and citation ID for every grounded handoff summary.",
				path: output.path,
				outputId: output.id,
				recovery: recoveryRecordForOutput(output, "handoff.missing-citation"),
			}),
		);
	}

	if ((output.kind === "retrieval-summary" || output.kind === "source-record") && !hasSourceRecord(output)) {
		issues.push(
			createIssue({
				code: "handoff.missing-source-record",
				message: "Selected output is missing source record evidence.",
				remediation: "Include sourceRecordId on the output or on its citation evidence.",
				path: output.path,
				outputId: output.id,
				recovery: recoveryRecordForOutput(output, "handoff.missing-source-record"),
			}),
		);
	}

	if (output.kind === "staged-change-summary" && output.stagedChangeId === undefined) {
		issues.push(
			createIssue({
				code: "handoff.missing-staged-change-id",
				message: "Staged-change summary is missing staged-change ID.",
				remediation: "Preserve stagedChangeId so the user can inspect or retry the staged change.",
				path: output.path,
				outputId: output.id,
				recovery: recoveryRecordForOutput(output, "handoff.missing-staged-change-id"),
			}),
		);
	}

	if (output.kind === "health-report" && output.reportId === undefined) {
		issues.push(
			createIssue({
				code: "handoff.missing-report-id",
				message: "Health report handoff is missing report ID.",
				remediation: "Preserve reportId so the redacted report can be inspected or regenerated.",
				path: output.path,
				outputId: output.id,
				recovery: recoveryRecordForOutput(output, "handoff.missing-report-id"),
			}),
		);
	}

	if (
		(output.kind === "release-evidence" || output.kind === "agent-surface-package") &&
		output.artifactPath === undefined
	) {
		issues.push(
			createIssue({
				code: "handoff.missing-artifact-path",
				message: "Artifact handoff evidence is missing artifact path.",
				remediation: "Preserve repository-relative artifactPath for release or package evidence.",
				path: output.path,
				outputId: output.id,
				recovery: recoveryRecordForOutput(output, "handoff.missing-artifact-path"),
			}),
		);
	}

	if (
		(output.kind === "release-evidence" || output.kind === "agent-surface-package") &&
		(output.checksum === undefined || !checksumPattern.test(output.checksum.value))
	) {
		issues.push(
			createIssue({
				code: "handoff.missing-checksum",
				message: "Artifact handoff evidence is missing a SHA-256 checksum.",
				remediation: "Include a sha256 checksum for release artifacts and package manifests.",
				path: output.path,
				outputId: output.id,
				recovery: recoveryRecordForOutput(output, "handoff.missing-checksum"),
			}),
		);
	}

	if (!hasValidationOutput(output)) {
		issues.push(
			createIssue({
				code: "handoff.missing-validation-output",
				message: "Selected output is missing validation output.",
				remediation: "Keep bounded validation output so handoff can be inspected or retried.",
				path: output.path,
				outputId: output.id,
				recovery: recoveryRecordForOutput(output, "handoff.missing-validation-output"),
			}),
		);
	}

	return sortEcosystemHandoffIssues(issues);
};

const collectSafetyCandidates = (output: EcosystemHandoffSelectedOutput): readonly TextSafetyCandidate[] => {
	const values: TextSafetyCandidate[] = [
		{ outputId: output.id, path: output.path, field: "path", value: output.path },
	];

	const add = (field: string, value: string | undefined): void => {
		if (value !== undefined) {
			values.push({ outputId: output.id, path: output.path, field, value });
		}
	};

	add("title", output.title);
	add("heading", output.heading);
	add("summary", output.summary);
	add("sourceRecordId", output.sourceRecordId);
	add("stagedChangeId", output.stagedChangeId);
	add("reportId", output.reportId);
	add("artifactPath", output.artifactPath);
	for (const value of output.validationOutput ?? []) {
		add("validationOutput", value);
	}

	for (const citation of output.citations ?? []) {
		add("citation.vaultPath", citation.vaultPath);
		add("citation.heading", citation.heading);
		add("citation.citationId", citation.citationId);
		add("citation.sourceRecordId", citation.sourceRecordId);
	}

	const recovery = output.recovery;
	if (recovery !== undefined) {
		add("recovery.commandId", recovery.commandId);
		add("recovery.targetPath", recovery.targetPath);
		add("recovery.cachePath", recovery.cachePath);
		add("recovery.stagedChangeId", recovery.stagedChangeId);
		add("recovery.reportId", recovery.reportId);
		add("recovery.artifactPath", recovery.artifactPath);
		add("recovery.retryGuidance", recovery.retryGuidance);
		for (const value of recovery.validationOutput ?? []) {
			add("recovery.validationOutput", value);
		}
	}

	return values;
};

const safetyIssuesForCandidate = (candidate: TextSafetyCandidate): readonly EcosystemHandoffIssue[] => {
	const issues: EcosystemHandoffIssue[] = [];
	const common = {
		path: candidate.path,
		outputId: candidate.outputId,
		excerpt: candidate.value,
	};

	if (secretLikeKeyPattern.test(candidate.value) || credentialLikeValuePattern.test(candidate.value)) {
		issues.push(
			createIssue({
				...common,
				code: "handoff.secret-like-value",
				message: `Unsafe secret-like value found in ${candidate.field}.`,
				remediation:
					"Remove provider secrets, tokens, passwords, and credential-like values from handoff diagnostics.",
			}),
		);
	}

	if (authorizationHeaderPattern.test(candidate.value)) {
		issues.push(
			createIssue({
				...common,
				code: "handoff.authorization-header",
				message: `Authorization header or bearer value found in ${candidate.field}.`,
				remediation: "Remove authorization headers and bearer values from handoff diagnostics.",
			}),
		);
	}

	if (privatePathHintPattern.test(candidate.value)) {
		issues.push(
			createIssue({
				...common,
				code: "handoff.private-path-hint",
				message: `Private absolute path found in ${candidate.field}.`,
				remediation: "Use vault-relative, repository-relative, or fixture-safe paths.",
			}),
		);
	}

	if (promptBodyPattern.test(candidate.value)) {
		issues.push(
			createIssue({
				...common,
				code: "handoff.prompt-body",
				message: `Prompt body marker found in ${candidate.field}.`,
				remediation: "Remove raw prompt bodies from handoff diagnostics and examples.",
			}),
		);
	}

	if (hiddenProviderStatePattern.test(candidate.value)) {
		issues.push(
			createIssue({
				...common,
				code: "handoff.hidden-provider-state",
				message: `Hidden provider state marker found in ${candidate.field}.`,
				remediation: "Expose only bounded provider IDs, readiness codes, and validation output.",
			}),
		);
	}

	if (rawNoteBodyPattern.test(candidate.value)) {
		issues.push(
			createIssue({
				...common,
				code: "handoff.raw-note-body",
				message: `Raw note body marker found in ${candidate.field}.`,
				remediation: "Replace raw note bodies with cited summaries and bounded evidence.",
			}),
		);
	}

	return issues;
};

const safetyIssuesForOutput = (output: EcosystemHandoffSelectedOutput): readonly EcosystemHandoffIssue[] =>
	sortEcosystemHandoffIssues(collectSafetyCandidates(output).flatMap(safetyIssuesForCandidate));

const safetyIssuesForInputMetadata = (input: NormalizedHandoffInput["input"]): readonly EcosystemHandoffIssue[] => {
	const candidates: TextSafetyCandidate[] = [];
	const add = (field: string, value: string | undefined): void => {
		if (value !== undefined) {
			candidates.push({ field, value, path: value });
		}
	};

	add("target", input.target);
	add("disclosure.providerId", input.disclosure?.providerId);
	add("disclosure.target", input.disclosure?.target);

	return sortEcosystemHandoffIssues(candidates.flatMap(safetyIssuesForCandidate));
};

const disclosureIssuesForInput = (input: NormalizedHandoffInput["input"]): readonly EcosystemHandoffIssue[] => {
	if (!isReviewEcosystemHandoffMode(input.mode)) {
		return [];
	}

	const disclosure = input.disclosure;
	const checks: readonly {
		readonly ok: boolean;
		readonly code: EcosystemHandoffIssueCode;
		readonly message: string;
		readonly remediation: string;
	}[] = [
		{
			ok: disclosure?.providerReviewed === true,
			code: "handoff.provider-review-required",
			message: "Remote or cloud handoff is missing provider review.",
			remediation: "Review the provider boundary before private vault content can leave the machine.",
		},
		{
			ok: disclosure?.providerTrusted === true,
			code: "handoff.provider-trust-required",
			message: "Remote or cloud handoff is missing provider trust.",
			remediation: "Use a trusted provider profile or keep handoff local.",
		},
		{
			ok: disclosure?.authReady === true,
			code: "handoff.provider-auth-required",
			message: "Remote or cloud handoff is missing auth readiness.",
			remediation: "Confirm provider auth readiness without exposing credentials.",
		},
		{
			ok: disclosure?.capabilityConfirmed === true,
			code: "handoff.provider-capability-required",
			message: "Remote or cloud handoff is missing capability confirmation.",
			remediation: "Confirm the provider supports the intended handoff capability.",
		},
		{
			ok: disclosure?.disclosureApproved === true,
			code: "handoff.disclosure-required",
			message: "Remote or cloud handoff is missing explicit disclosure approval.",
			remediation:
				"Ask the user to approve the disclosure path before any private vault content leaves the machine.",
		},
	];

	return sortEcosystemHandoffIssues(
		checks
			.filter((check) => !check.ok)
			.map((check) =>
				createIssue({
					code: check.code,
					message: check.message,
					remediation: check.remediation,
					mode: input.mode,
					target: input.target ?? input.disclosure?.target,
				}),
			),
	);
};

const unsupportedTargetIssuesForInput = (input: NormalizedHandoffInput["input"]): readonly EcosystemHandoffIssue[] => {
	const issues: EcosystemHandoffIssue[] = [];

	if (isUnsupportedEcosystemHandoffMode(input.mode)) {
		issues.push(
			createIssue({
				code: "handoff.unsupported-target",
				message: "Requested handoff mode is outside MVP scope.",
				remediation:
					"Use local Git, filesystem, copy, or markdown-bundle handoff. Direct publishing, hosted sync, and team knowledge-base pushes require a future provider-gated workflow.",
				mode: input.mode,
				target: input.target,
			}),
		);
	}

	if (
		input.target !== undefined &&
		isLocalEcosystemHandoffMode(input.mode) &&
		unsupportedPublishingTargetPattern.test(input.target)
	) {
		issues.push(
			createIssue({
				code: "handoff.unsupported-target",
				message: "Local handoff target looks like an external publishing or hosted sync destination.",
				remediation:
					"Keep local modes on Git, filesystem, copy, or markdown-bundle targets. Route remote or cloud paths through provider review gates.",
				mode: input.mode,
				target: input.target,
				excerpt: input.target,
			}),
		);
	}

	return sortEcosystemHandoffIssues(issues);
};

function recoveryRecordForOutput(
	output: EcosystemHandoffSelectedOutput,
	issueCode?: EcosystemHandoffIssueCode,
): EcosystemHandoffRecoveryRecord {
	const validationOutput =
		output.recovery?.validationOutput ?? output.validationOutput ?? (issueCode === undefined ? undefined : []);

	return {
		commandId: output.recovery?.commandId,
		targetPath: sanitizePath(output.recovery?.targetPath ?? output.path),
		cachePath: sanitizePath(output.recovery?.cachePath),
		stagedChangeId: output.recovery?.stagedChangeId ?? output.stagedChangeId,
		reportId: output.recovery?.reportId ?? output.reportId,
		artifactPath: sanitizePath(output.recovery?.artifactPath ?? output.artifactPath),
		validationOutput,
		issueCode,
		retryGuidance:
			output.recovery?.retryGuidance ??
			(issueCode === undefined
				? "Inspect selected output evidence before retrying handoff."
				: "Fix handoff validation issue and retry."),
	};
}

const recoveryRecordsForOutputs = (
	outputs: readonly EcosystemHandoffSelectedOutput[],
	issues: readonly EcosystemHandoffIssue[],
): readonly EcosystemHandoffRecoveryRecord[] => {
	const issueByOutput = new Map<string, EcosystemHandoffIssueCode>();
	for (const issue of issues) {
		if (issue.outputId !== undefined && !issueByOutput.has(issue.outputId)) {
			issueByOutput.set(issue.outputId, issue.code);
		}
	}

	return outputs
		.map((output) => recoveryRecordForOutput(output, issueByOutput.get(output.id)))
		.sort((left, right) => {
			const leftKey = `${left.targetPath ?? ""}:${left.reportId ?? ""}:${left.stagedChangeId ?? ""}:${left.artifactPath ?? ""}`;
			const rightKey = `${right.targetPath ?? ""}:${right.reportId ?? ""}:${right.stagedChangeId ?? ""}:${right.artifactPath ?? ""}`;
			return leftKey.localeCompare(rightKey);
		});
};

const createDiagnostic = (input: {
	readonly generatedAt: string;
	readonly outcome: EcosystemHandoffOutcome;
	readonly mode?: string | undefined;
	readonly selectedOutputs: readonly EcosystemHandoffSelectedOutput[];
	readonly issues: readonly EcosystemHandoffIssue[];
	readonly recovery: readonly EcosystemHandoffRecoveryRecord[];
}): EcosystemHandoffDiagnostic => ({
	generatedAt: input.generatedAt,
	outcome: input.outcome,
	mode: input.mode,
	selectedOutputCount: input.selectedOutputs.length,
	issueCount: input.issues.length,
	issues: input.issues,
	recovery: input.recovery,
});

const actionLabelForMode = (mode: EcosystemHandoffMode): string => {
	switch (mode) {
		case "git":
			return "Stage selected repository-safe markdown evidence in Git.";
		case "filesystem":
			return "Copy selected markdown outputs to a local filesystem target.";
		case "copy":
			return "Copy cited summary text with citation and recovery fields.";
		case "markdown-bundle":
			return "Create a local markdown bundle manifest for selected outputs.";
		case "remote-provider":
			return "Prepare a provider-reviewed remote handoff request without sending content.";
		case "cloud-provider":
			return "Prepare a provider-reviewed cloud handoff request without sending content.";
		case "direct-publishing":
		case "hosted-sync":
		case "external-service":
		case "team-knowledge-base":
			return "Block unsupported external publishing or sync target.";
	}
};

const createPlanActions = (
	input: NormalizedHandoffInput["input"],
	outcome: EcosystemHandoffOutcome,
): readonly EcosystemHandoffPlanAction[] => {
	if (outcome === "blocked") {
		return [];
	}

	return [
		{
			mode: input.mode,
			label: actionLabelForMode(input.mode),
			selectedPaths: input.selectedOutputs.map((output) => output.path),
			target: input.target,
			requiresProviderReview: isReviewEcosystemHandoffMode(input.mode),
		},
	];
};

const createPlan = (input: {
	readonly normalized: NormalizedHandoffInput["input"];
	readonly outcome: EcosystemHandoffOutcome;
	readonly issues: readonly EcosystemHandoffIssue[];
}): EcosystemHandoffPlan => {
	const generatedAt = (input.normalized.now ?? new Date(defaultGeneratedAt)).toISOString();
	const recovery = recoveryRecordsForOutputs(input.normalized.selectedOutputs, input.issues);

	const plan: EcosystemHandoffPlan = {
		generatedAt,
		outcome: input.outcome,
		mode: input.normalized.mode,
		target: input.normalized.target,
		selectedOutputs: input.normalized.selectedOutputs,
		actions: createPlanActions(input.normalized, input.outcome),
		issues: input.issues,
		recovery,
		disclosure: input.normalized.disclosure,
		diagnostic: createDiagnostic({
			generatedAt,
			outcome: input.outcome,
			mode: input.normalized.mode,
			selectedOutputs: input.normalized.selectedOutputs,
			issues: input.issues,
			recovery,
		}),
	};

	return plan;
};

const resultForPlan = (plan: EcosystemHandoffPlan): EcosystemHandoffPlanningResult => {
	if (plan.outcome === "allowed") {
		return {
			ok: true,
			plan: plan as EcosystemHandoffPlan & { readonly outcome: "allowed" },
		};
	}

	if (plan.outcome === "review-required") {
		return {
			ok: true,
			plan: plan as EcosystemHandoffPlan & { readonly outcome: "review-required" },
		};
	}

	return {
		ok: false,
		plan: plan as EcosystemHandoffPlan & { readonly outcome: "blocked" },
		issues: plan.issues,
	};
};

const determineOutcome = (
	input: NormalizedHandoffInput["input"],
	issues: readonly EcosystemHandoffIssue[],
): EcosystemHandoffOutcome => {
	if (issues.length > 0) {
		return "blocked";
	}

	if (isReviewEcosystemHandoffMode(input.mode)) {
		return "review-required";
	}

	return "allowed";
};

export const planEcosystemHandoff = (input: unknown): EcosystemHandoffPlanningResult => {
	const normalized = validateEcosystemHandoffInput(input);
	const evidenceIssues = normalized.input.selectedOutputs.flatMap(evidenceIssuesForOutput);
	const safetyIssues = [
		...normalized.input.selectedOutputs.flatMap(safetyIssuesForOutput),
		...safetyIssuesForInputMetadata(normalized.input),
	];
	const disclosureIssues = disclosureIssuesForInput(normalized.input);
	const unsupportedTargetIssues = unsupportedTargetIssuesForInput(normalized.input);
	const issues = sortEcosystemHandoffIssues([
		...normalized.issues,
		...evidenceIssues,
		...safetyIssues,
		...disclosureIssues,
		...unsupportedTargetIssues,
	]);
	const outcome = determineOutcome(normalized.input, issues);

	return resultForPlan(
		createPlan({
			normalized: normalized.input,
			outcome,
			issues,
		}),
	);
};

const requestKeyForInput = (input: EcosystemHandoffPlanningInput): string => {
	const selectedPaths = (input.selectedOutputs ?? [])
		.map((output) => `${output.kind}:${output.path}:${output.id}`)
		.sort((left, right) => left.localeCompare(right))
		.join("|");

	return input.requestId ?? `${input.mode}:${input.target ?? ""}:${selectedPaths}`;
};

const duplicateResultForInput = (input: EcosystemHandoffPlanningInput): EcosystemHandoffPlanningResult => {
	const normalized = validateEcosystemHandoffInput(input);
	const issue = createIssue({
		code: "handoff.duplicate-in-flight",
		message: "Duplicate handoff plan request is already in flight.",
		remediation: "Wait for the current handoff planning request to finish before retrying the same request.",
		mode: normalized.input.mode,
		target: normalized.input.target,
	});
	const issues = sortEcosystemHandoffIssues([issue, ...normalized.issues]);
	const plan = createPlan({
		normalized: normalized.input,
		outcome: "blocked",
		issues,
	});

	return resultForPlan(plan);
};

export class EcosystemHandoffPlanBuilder {
	private readonly inFlightRequestKeys = new Set<string>();

	buildPlan(input: unknown): EcosystemHandoffPlanningResult {
		return planEcosystemHandoff(input);
	}

	async buildPlanOnce(input: EcosystemHandoffPlanningInput): Promise<EcosystemHandoffPlanningResult> {
		const requestKey = requestKeyForInput(input);
		if (this.inFlightRequestKeys.has(requestKey)) {
			return duplicateResultForInput(input);
		}

		this.inFlightRequestKeys.add(requestKey);
		try {
			await Promise.resolve();
			return planEcosystemHandoff(input);
		} finally {
			this.inFlightRequestKeys.delete(requestKey);
		}
	}
}

export const createEcosystemHandoffPlanBuilder = (): EcosystemHandoffPlanBuilder => new EcosystemHandoffPlanBuilder();

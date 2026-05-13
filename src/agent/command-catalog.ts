import {
	AGENT_COMMAND_IDS,
	type AgentCommand,
	type AgentCommandId,
	type AgentCommandStatus,
	type AgentSurfaceDefinition,
	type AgentValidationIssue,
	type AgentValidationResult,
	isAgentCommandId,
	isAgentCommandStatus,
	isAgentPrivacyLevel,
	isAgentSurfaceId,
	isAgentWritePolicy,
} from "../types/agent-commands";

export const REQUIRED_AGENT_SURFACE_PHRASES = [
	"local-first",
	"staged changes",
	"provider secrets",
	"synthetic fixtures",
	"citations",
	"dry-run",
	"recovery",
] as const;

const allRequiredSurfacePhrases = [...REQUIRED_AGENT_SURFACE_PHRASES];

export const AGENT_SURFACES: readonly AgentSurfaceDefinition[] = [
	{
		id: "agents-md",
		label: "Codex repository instructions",
		path: "AGENTS.md",
		required: true,
		requiredSafetyPhrases: allRequiredSurfacePhrases,
	},
	{
		id: "claude-md",
		label: "Claude Code instructions",
		path: "CLAUDE.md",
		required: true,
		requiredSafetyPhrases: allRequiredSurfacePhrases,
	},
	{
		id: "gemini-md",
		label: "Gemini CLI instructions",
		path: "GEMINI.md",
		required: true,
		requiredSafetyPhrases: allRequiredSurfacePhrases,
	},
	{
		id: "voidbrain-skill",
		label: "Voidbrain skill instructions",
		path: "skills/voidbrain/SKILL.md",
		required: true,
		requiredSafetyPhrases: allRequiredSurfacePhrases,
	},
	{
		id: "human-docs",
		label: "Human command reference",
		path: "docs/agent-surfaces-commands.md",
		required: true,
		requiredSafetyPhrases: allRequiredSurfacePhrases,
	},
];

export const AGENT_COMMAND_CATALOG: readonly AgentCommand[] = [
	{
		id: "voidbrain.ingest-source",
		name: "Ingest source",
		intent: "Preview and stage approved source content or a bounded batch queue as source, entity, concept, and summary notes without mutating user notes directly.",
		status: "implemented",
		privacyLevel: "local-first",
		writePolicy: "staged-changes",
		prerequisites: [
			"Source path is vault-relative and validated, or pasted content is explicitly supplied.",
			"URL source records are explicitly approved before preview or staging.",
			"Provider-assisted extraction is optional and gated by provider review and preflight per source item.",
			"Generated notes link back to source paths, source records, and citation IDs.",
			"Batch queue summaries omit raw source bodies, provider secrets, auth headers, and hidden provider state.",
		],
		inputs: [
			{
				name: "sourcePath",
				description: "Vault-relative path to approved markdown or text source content.",
				required: false,
			},
			{
				name: "pastedContent",
				description: "Approved source text supplied by the user for staging.",
				required: false,
			},
			{
				name: "urlRecord",
				description: "Explicitly approved URL metadata and user-supplied source record content.",
				required: false,
			},
			{
				name: "batchQueue",
				description: "Bounded list of approved markdown, text, pasted, or URL source records.",
				required: false,
			},
		],
		outputs: [
			{
				name: "stagedChanges",
				description: "Reviewable staged-change IDs for generated source, entity, concept, and summary notes.",
				required: true,
			},
			{
				name: "queueSummary",
				description:
					"Per-item queued, running, staged, failed, canceled, skipped, provider-blocked, citation-blocked, and retryable status.",
				required: false,
			},
		],
		requiredEvidence: [
			"queue ID",
			"item IDs",
			"source path",
			"source record",
			"citation IDs",
			"generated note paths",
			"provider decision",
			"validation output",
			"staged-change IDs",
		],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: [
			"local-first",
			"staged changes",
			"synthetic fixtures",
			"provider secrets",
			"citations",
			"recovery",
		],
		recoveryBehavior:
			"Leave command ID, queue ID, item IDs, source paths, target paths, provider decisions, validation output, cache path, and staged-change IDs for retry or discard.",
		notes: [
			"Runtime behavior stages generated notes only; apply and review UI behavior remain separate staged-change workflows.",
			"Batch processing uses bounded concurrency, deterministic ordering, cancellation, retry, and redacted hot cache summaries.",
			"Tests and examples use synthetic fixtures and do not fetch live URLs or call live providers.",
		],
	},
	{
		id: "voidbrain.chat-with-vault",
		name: "Chat with vault",
		intent: "Answer from indexed vault evidence with citations and explicit provider review before cloud use.",
		status: "implemented",
		privacyLevel: "explicit-provider-review",
		writePolicy: "no-direct-writes",
		prerequisites: [
			"Retrieval index is fresh enough for the query.",
			"Cloud provider use is disclosed and allowed before private vault content leaves the device.",
			"Retrieved evidence includes traceable vault paths and headings.",
		],
		inputs: [
			{
				name: "question",
				description: "User question that can be answered from indexed vault evidence.",
				required: true,
			},
		],
		outputs: [
			{
				name: "answer",
				description: "Cited answer with retrieval paths, headings, and source records.",
				required: true,
			},
		],
		requiredEvidence: ["cited retrieval paths", "headings", "source records"],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: ["local-first", "provider secrets", "citations", "recovery"],
		recoveryBehavior:
			"Return visible provider or retrieval failure context without exposing secrets or stack traces.",
		notes: [
			"Runtime chat view, lexical retrieval preview, provider preflight, cited synthesis boundary, retry, branch, and recovery state are implemented.",
			"Generated note edits remain deferred to staged-change workflows.",
		],
	},
	{
		id: "voidbrain.health-check",
		name: "Health check",
		intent: "Scan local vault notes and index freshness, show grouped health findings, export a redacted markdown report, and stage only deterministic safe repairs.",
		status: "implemented",
		privacyLevel: "local-first",
		writePolicy: "staged-changes",
		prerequisites: [
			"Health scans read local markdown notes and index freshness through Obsidian-owned runtime paths.",
			"Markdown report export writes only redacted support records under .voidbrain/reports/.",
			"Safe repairs become staged changes and require review before apply.",
		],
		inputs: [
			{
				name: "vaultNotes",
				description: "Local markdown notes collected from the active Obsidian vault.",
				required: false,
			},
		],
		outputs: [
			{
				name: "healthReport",
				description:
					"Grouped report with severity, kind, affected paths, evidence, remediation, and report ID.",
				required: true,
			},
			{
				name: "stagedRepairs",
				description: "Reviewable staged-change IDs for deterministic low-risk repairs when requested.",
				required: false,
			},
		],
		requiredEvidence: ["report ID", "affected paths", "finding evidence", "validation output", "staged-change IDs"],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: [
			"local-first",
			"staged changes",
			"synthetic fixtures",
			"provider secrets",
			"citations",
			"recovery",
		],
		recoveryBehavior:
			"Preserve command ID, report ID, export path, target path, staged-change ID, and validation output for retry or inspection.",
		notes: [
			"Runtime health checks are local-only and never call providers.",
			"Broken links, broad orphans, stale indexes, and content gaps stay report-only because the correct repair can be ambiguous.",
			"Deterministic missing-citation repairs can be staged, but never applied directly.",
		],
	},
	{
		id: "voidbrain.stage-change",
		name: "Stage change",
		intent: "Review, confirm, apply, reject, retry, or dismiss staged note mutations with backups, audit records, and recovery details.",
		status: "implemented",
		privacyLevel: "local-first",
		writePolicy: "staged-changes",
		prerequisites: [
			"Staged-change records include target paths, before and after diffs, validation output, and recovery metadata.",
			"Apply uses Obsidian vault APIs after explicit confirmation and final preflight revalidation.",
			"Delete, move, overwrite, and batch apply require stronger confirmation and backup support records.",
		],
		inputs: [
			{
				name: "stagedChangeId",
				description:
					"One or more staged-change IDs selected for review, confirmation, apply, reject, retry, or dismiss.",
				required: true,
			},
			{
				name: "confirmationText",
				description: "Exact confirmation text for destructive, overwrite, or batch apply.",
				required: false,
			},
		],
		outputs: [
			{
				name: "reviewOutcome",
				description:
					"Per-record apply, reject, retry, dismiss, conflict, or failed outcome with audit and recovery details.",
				required: true,
			},
		],
		requiredEvidence: [
			"target path",
			"before/after diff",
			"staged-change ID",
			"backup path intent",
			"validation output",
		],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: ["local-first", "staged changes", "provider secrets", "synthetic fixtures", "recovery"],
		recoveryBehavior:
			"Keep command ID, target path, staged-change ID, backup path intent, validation output, and audit entry IDs so the user can retry or inspect later.",
		notes: [
			"Review UI groups active, conflicted, failed, rejected, dismissed, and applied records by command, operation, status, destructive flag, and target path.",
			"Apply behavior never calls providers and only mutates vault notes after explicit confirmation, conflict checks, and backup support writes for destructive changes.",
		],
	},
	{
		id: "voidbrain.recover-session",
		name: "Recover session",
		intent: "Reconstruct recoverable command context from hot cache, staged changes, health reports, operation logs, and generated support records.",
		status: "implemented",
		privacyLevel: "local-first",
		writePolicy: "read-only",
		prerequisites: [
			"Recovery reads only local Voidbrain support records and in-memory runtime recovery state.",
			"Recovery output redacts provider secrets, authorization headers, hidden provider state, private diagnostics, and raw note bodies.",
			"Recovery never applies note edits, rewrites support records, or replays provider calls.",
		],
		inputs: [
			{
				name: "sessionId",
				description: "Optional recoverable command, cache, report, target path, or staged-change identifier.",
				required: false,
			},
		],
		outputs: [
			{
				name: "recoverySummary",
				description: "Recoverable paths, staged-change IDs, and retry or discard options.",
				required: true,
			},
		],
		requiredEvidence: [
			"command ID",
			"cache path",
			"target paths",
			"report IDs",
			"staged-change IDs",
			"backup path intent",
			"validation output",
		],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: ["local-first", "staged changes", "provider secrets", "synthetic fixtures", "recovery"],
		recoveryBehavior:
			"Summarize command ID, cache path, target path, report ID, staged-change ID, backup path intent, validation output, and retry or discard actions without mutating vault files.",
		notes: [
			"Runtime recovery is read-only and notice-based; richer UI remains out of scope.",
			"Missing, malformed, stale, unsupported, and read-failed support records return diagnostics instead of throwing.",
		],
	},
	{
		id: "voidbrain.validate-agent-surfaces",
		name: "Validate agent surfaces",
		intent: "Fail closed on stale command IDs, command status drift, missing safety phrases, unsafe examples, and unsupported validation scan paths.",
		status: "implemented",
		privacyLevel: "local-first",
		writePolicy: "read-only",
		prerequisites: [
			"Run from the repository root.",
			"Markdown surfaces are loaded from known repository paths.",
			"Fixture safety scans are bounded to synthetic fixture and documentation paths.",
		],
		inputs: [
			{
				name: "surfacePaths",
				description: "Known repository markdown surfaces to validate.",
				required: false,
			},
		],
		outputs: [
			{
				name: "validationIssues",
				description: "Explicit validation failures with paths, commands, and safety phrases.",
				required: true,
			},
		],
		requiredEvidence: ["validation result list"],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: [
			"local-first",
			"staged changes",
			"synthetic fixtures",
			"provider secrets",
			"citations",
			"dry-run",
			"recovery",
		],
		recoveryBehavior: "Return nonzero failures with deterministic issue text and no repository mutations.",
		notes: [
			"Validation scripts are read-only and bounded to framework documentation, scripts, source contracts, and synthetic fixtures.",
			"Issues include stable path, heading, line, command ID, redacted excerpt, and remediation metadata.",
		],
	},
	{
		id: "voidbrain.preview-framework-update",
		name: "Preview framework update",
		intent: "Produce deterministic dry-run framework-file update plans with create, update, skip, conflict, excluded, hash, issue, and recovery details while excluding user vault content and generated knowledge notes.",
		status: "implemented",
		privacyLevel: "local-first",
		writePolicy: "dry-run",
		prerequisites: [
			"Run from the repository root.",
			"Candidate paths are repository-relative and normalized before any repository read.",
			"User vault content, generated knowledge notes, support records, provider secret files, diagnostics, and unsafe traversal are excluded or conflicted before planning.",
			"Proposed content is scanned for credential-like values and private path hints before create or update actions are reported.",
		],
		inputs: [
			{
				name: "candidatePaths",
				description: "Optional repository-relative framework paths proposed for dry-run preview.",
				required: false,
			},
			{
				name: "candidates",
				description: "Optional candidate records with repository-relative paths and proposed content.",
				required: false,
			},
		],
		outputs: [
			{
				name: "previewPlan",
				description:
					"Deterministic dry-run action list with create, update, skip, conflict, excluded, hashes, issues, and recovery details.",
				required: true,
			},
		],
		requiredEvidence: [
			"command ID",
			"target path",
			"planned framework file actions",
			"excluded user-content paths",
			"conflict issue codes",
			"content hashes",
			"validation context",
		],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: ["local-first", "dry-run", "synthetic fixtures", "provider secrets", "recovery"],
		recoveryBehavior:
			"Return command ID, target path, action, issue code, hashes, and validation context for retry or discard decisions; reject duplicate in-flight preview requests.",
		notes: [
			"Planner and CLI behavior are implemented as preview-only dry-runs.",
			"Apply behavior remains intentionally out of scope and must be implemented through a later explicit workflow.",
		],
	},
];

const commandOrder = new Map<AgentCommandId, number>(AGENT_COMMAND_IDS.map((id, index) => [id, index]));

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);

const commandSortIndex = (command: AgentCommand): number => commandOrder.get(command.id) ?? Number.MAX_SAFE_INTEGER;

export const sortAgentCommandsDeterministically = (
	commands: readonly AgentCommand[] = AGENT_COMMAND_CATALOG,
): readonly AgentCommand[] =>
	[...commands].sort((left, right) => {
		const byCatalogOrder = commandSortIndex(left) - commandSortIndex(right);
		if (byCatalogOrder !== 0) {
			return byCatalogOrder;
		}

		return left.id.localeCompare(right.id);
	});

export const getAgentCommandById = (
	commandId: unknown,
	commands: readonly AgentCommand[] = AGENT_COMMAND_CATALOG,
): AgentCommand | undefined => {
	if (!isAgentCommandId(commandId)) {
		return undefined;
	}

	return sortAgentCommandsDeterministically(commands).find((command) => command.id === commandId);
};

export const getAgentCommandsByStatus = (
	status: unknown,
	commands: readonly AgentCommand[] = AGENT_COMMAND_CATALOG,
): readonly AgentCommand[] => {
	if (!isAgentCommandStatus(status)) {
		return [];
	}

	return sortAgentCommandsDeterministically(commands).filter((command) => command.status === status);
};

export const getSupportedAgentSurfaces = (commandId?: unknown): readonly AgentSurfaceDefinition[] => {
	if (commandId === undefined) {
		return [...AGENT_SURFACES].sort((left, right) => left.path.localeCompare(right.path));
	}

	const command = getAgentCommandById(commandId);
	if (command === undefined) {
		return [];
	}

	const surfaceIds = new Set(command.supportedSurfaces);
	return AGENT_SURFACES.filter((surface) => surfaceIds.has(surface.id)).sort((left, right) =>
		left.path.localeCompare(right.path),
	);
};

const validateCommandShape = (command: unknown, index: number): readonly AgentValidationIssue[] => {
	if (!isRecord(command)) {
		return [
			{
				code: "catalog.invalid-command-id",
				message: `Catalog entry ${index} must be an object.`,
				field: String(index),
			},
		];
	}

	const issues: AgentValidationIssue[] = [];
	const commandIdField = typeof command.id === "string" ? { commandId: command.id } : {};

	if (!isAgentCommandId(command.id)) {
		issues.push({
			code: "catalog.invalid-command-id",
			message: `Catalog entry ${index} has an unknown command ID.`,
			...commandIdField,
			field: "id",
		});
	}

	if (!isAgentCommandStatus(command.status)) {
		issues.push({
			code: "catalog.invalid-status",
			message: `Catalog entry ${index} has an invalid status.`,
			...commandIdField,
			field: "status",
		});
	}

	if (!isAgentPrivacyLevel(command.privacyLevel)) {
		issues.push({
			code: "catalog.invalid-status",
			message: `Catalog entry ${index} has an invalid privacy level.`,
			...commandIdField,
			field: "privacyLevel",
		});
	}

	if (!isAgentWritePolicy(command.writePolicy)) {
		issues.push({
			code: "catalog.invalid-status",
			message: `Catalog entry ${index} has an invalid write policy.`,
			...commandIdField,
			field: "writePolicy",
		});
	}

	if (!Array.isArray(command.supportedSurfaces) || !command.supportedSurfaces.every(isAgentSurfaceId)) {
		issues.push({
			code: "catalog.invalid-surface",
			message: `Catalog entry ${index} references an unknown surface.`,
			...commandIdField,
			field: "supportedSurfaces",
		});
	}

	if (!isStringArray(command.requiredSafetyPhrases)) {
		issues.push({
			code: "catalog.missing-safety-phrase",
			message: `Catalog entry ${index} must define required safety phrases.`,
			...commandIdField,
			field: "requiredSafetyPhrases",
			remediation:
				"Add local-first, staged-change, provider-secret, synthetic-fixture, citation, dry-run, or recovery language as required.",
		});
	}

	return issues;
};

const validateCommandRequiredText = (command: AgentCommand, index: number): readonly AgentValidationIssue[] => {
	const requiredStringFields = ["name", "intent", "recoveryBehavior"] as const;
	const issues: AgentValidationIssue[] = [];

	for (const field of requiredStringFields) {
		if (command[field].trim().length === 0) {
			issues.push({
				code: "catalog.invalid-command-id",
				message: `Catalog entry ${index} has an empty ${field} field.`,
				commandId: command.id,
				field,
				remediation: "Fill in the command catalog text so generated surfaces remain inspectable.",
			});
		}
	}

	if (command.supportedSurfaces.length === 0) {
		issues.push({
			code: "catalog.invalid-surface",
			message: `Catalog entry ${index} must support at least one agent surface.`,
			commandId: command.id,
			field: "supportedSurfaces",
			remediation: "Add the repository surfaces that must mention this command.",
		});
	}

	if (command.requiredEvidence.length === 0) {
		issues.push({
			code: "catalog.invalid-command-id",
			message: `Catalog entry ${index} must define required evidence.`,
			commandId: command.id,
			field: "requiredEvidence",
			remediation:
				"Add the durable IDs, paths, reports, validation output, or citation records needed for recovery.",
		});
	}

	return issues;
};

const validateDuplicateCommandIds = (commands: readonly AgentCommand[]): readonly AgentValidationIssue[] => {
	const seen = new Set<AgentCommandId>();
	const issues: AgentValidationIssue[] = [];

	for (const command of commands) {
		if (seen.has(command.id)) {
			issues.push({
				code: "catalog.duplicate-command-id",
				message: `Duplicate agent command ID: ${command.id}`,
				commandId: command.id,
				field: "id",
			});
		}

		seen.add(command.id);
	}

	return issues;
};

const validateCatalogCompleteness = (commands: readonly AgentCommand[]): readonly AgentValidationIssue[] => {
	const commandIds = new Set(commands.map((command) => command.id));
	return AGENT_COMMAND_IDS.filter((commandId) => !commandIds.has(commandId)).map((commandId) => ({
		code: "catalog.invalid-command-id",
		message: `Missing canonical agent command ID: ${commandId}`,
		commandId,
		field: "id",
	}));
};

export const validateAgentCommandCatalog = (input: unknown = AGENT_COMMAND_CATALOG): AgentValidationResult => {
	if (!Array.isArray(input)) {
		return {
			ok: false,
			issues: [
				{
					code: "catalog.invalid-command-id",
					message: "Agent command catalog must be an array.",
					field: "catalog",
				},
			],
		};
	}

	const shapeIssues = input.flatMap((command, index) => validateCommandShape(command, index));
	const validCommands = input.filter(
		(command): command is AgentCommand => validateCommandShape(command, 0).length === 0,
	);
	const duplicateIssues = validateDuplicateCommandIds(validCommands);
	const completenessIssues = validateCatalogCompleteness(validCommands);
	const requiredTextIssues = validCommands.flatMap((command, index) => validateCommandRequiredText(command, index));
	const issues = [...shapeIssues, ...duplicateIssues, ...completenessIssues, ...requiredTextIssues];

	if (issues.length > 0) {
		return {
			ok: false,
			issues,
		};
	}

	return {
		ok: true,
		issues: [],
	};
};

export const agentCommandStatusRank = (status: AgentCommandStatus): number => {
	switch (status) {
		case "implemented":
			return 0;
		case "scaffolded":
			return 1;
		case "planned":
			return 2;
		default:
			return 3;
	}
};

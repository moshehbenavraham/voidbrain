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
		intent: "Preview and stage approved source content as source, entity, concept, and summary notes without mutating user notes directly.",
		status: "implemented",
		privacyLevel: "local-first",
		writePolicy: "staged-changes",
		prerequisites: [
			"Source path is vault-relative and validated, or pasted content is explicitly supplied.",
			"URL source records are explicitly approved before preview or staging.",
			"Provider-assisted extraction is optional and gated by provider review and preflight.",
			"Generated notes link back to source paths, source records, and citation IDs.",
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
		],
		outputs: [
			{
				name: "stagedChanges",
				description: "Reviewable staged-change IDs for generated source, entity, concept, and summary notes.",
				required: true,
			},
		],
		requiredEvidence: ["source path", "source record", "citation IDs", "generated note paths", "staged-change IDs"],
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
			"Leave command ID, source path, target paths, provider decision, validation output, and staged-change IDs for retry or discard.",
		notes: [
			"Runtime behavior stages generated notes only; apply and review UI behavior remain separate staged-change workflows.",
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
		intent: "Report plugin, provider, index, fixture, and documentation safety status.",
		status: "planned",
		privacyLevel: "local-first",
		writePolicy: "read-only",
		prerequisites: [
			"Repository checks run from the project root.",
			"Fixture scans stay inside repository-owned synthetic paths.",
		],
		inputs: [
			{
				name: "scope",
				description: "Optional bounded repository check scope.",
				required: false,
			},
		],
		outputs: [
			{
				name: "status",
				description: "Deterministic pass/fail status with failing checks and paths.",
				required: true,
			},
		],
		requiredEvidence: ["status summary", "failing checks"],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: ["local-first", "synthetic fixtures", "provider secrets", "recovery"],
		recoveryBehavior: "Report failing path and check name so the user can rerun after repairs.",
		notes: [
			"Fixture-safe health report primitives exist for parsed notes and index freshness snapshots.",
			"Full Obsidian command runtime remains planned for a later session.",
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
		intent: "Reconstruct recoverable command context from logs, staged files, and generated support records.",
		status: "planned",
		privacyLevel: "local-first",
		writePolicy: "read-only",
		prerequisites: [
			"Recovery reads only repository or vault-owned support records.",
			"Recovery output redacts provider secrets and private diagnostics.",
		],
		inputs: [
			{
				name: "sessionId",
				description: "Recoverable command or staged-change session identifier.",
				required: true,
			},
		],
		outputs: [
			{
				name: "recoverySummary",
				description: "Recoverable paths, staged-change IDs, and retry or discard options.",
				required: true,
			},
		],
		requiredEvidence: ["recovery log path", "staged-change IDs"],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: ["local-first", "provider secrets", "recovery"],
		recoveryBehavior: "Fail read-only and tell the user which recovery record is missing or malformed.",
		notes: ["Recovery command execution is planned for a later session."],
	},
	{
		id: "voidbrain.validate-agent-surfaces",
		name: "Validate agent surfaces",
		intent: "Validate command IDs, safety phrases, stale references, and fixture-safe examples.",
		status: "scaffolded",
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
		requiredSafetyPhrases: ["local-first", "staged changes", "synthetic fixtures", "provider secrets"],
		recoveryBehavior: "Return nonzero failures with deterministic issue text and no repository mutations.",
		notes: ["Local scripts in this session scaffold the validation behavior."],
	},
	{
		id: "voidbrain.preview-framework-update",
		name: "Preview framework update",
		intent: "Preview planned framework-file changes while excluding user vault content and generated knowledge notes.",
		status: "scaffolded",
		privacyLevel: "local-first",
		writePolicy: "dry-run",
		prerequisites: [
			"Run from the repository root.",
			"Candidate paths are repository-relative and normalized before planning.",
			"User vault content paths are excluded from framework updates.",
		],
		inputs: [
			{
				name: "candidatePaths",
				description: "Repository-relative framework paths proposed for preview.",
				required: false,
			},
		],
		outputs: [
			{
				name: "previewPlan",
				description: "Dry-run action list and excluded user-content paths.",
				required: true,
			},
		],
		requiredEvidence: ["planned framework file actions", "excluded user-content paths"],
		supportedSurfaces: ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"],
		requiredSafetyPhrases: ["local-first", "dry-run", "synthetic fixtures", "recovery"],
		recoveryBehavior: "Reject duplicate in-flight preview requests and return the existing preview status.",
		notes: ["Apply behavior is intentionally out of scope for this session."],
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
	const issues = [...shapeIssues, ...duplicateIssues, ...completenessIssues];

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

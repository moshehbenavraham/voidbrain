export const AGENT_COMMAND_IDS = [
	"voidbrain.ingest-source",
	"voidbrain.chat-with-vault",
	"voidbrain.health-check",
	"voidbrain.stage-change",
	"voidbrain.recover-session",
	"voidbrain.validate-agent-surfaces",
	"voidbrain.preview-framework-update",
] as const;

export const AGENT_SURFACE_IDS = ["agents-md", "claude-md", "gemini-md", "voidbrain-skill", "human-docs"] as const;

export const AGENT_PRIVACY_LEVELS = ["local-first", "explicit-provider-review"] as const;
export const AGENT_WRITE_POLICIES = ["read-only", "no-direct-writes", "staged-changes", "dry-run"] as const;
export const AGENT_COMMAND_STATUSES = ["implemented", "scaffolded", "planned"] as const;

export const AGENT_VALIDATION_ERROR_CODES = [
	"catalog.duplicate-command-id",
	"catalog.invalid-command-id",
	"catalog.invalid-status",
	"catalog.invalid-surface",
	"catalog.missing-safety-phrase",
	"surface.missing-command-id",
	"surface.unknown-command-id",
	"surface.missing-safety-phrase",
	"surface.invalid-input",
	"fixture.secret-like-key",
	"fixture.credential-like-value",
	"fixture.private-path-hint",
	"fixture.invalid-input",
	"framework.user-content-target",
	"framework.duplicate-preview",
	"framework.invalid-input",
] as const;

export type AgentCommandId = (typeof AGENT_COMMAND_IDS)[number];
export type AgentSurfaceId = (typeof AGENT_SURFACE_IDS)[number];
export type AgentPrivacyLevel = (typeof AGENT_PRIVACY_LEVELS)[number];
export type AgentWritePolicy = (typeof AGENT_WRITE_POLICIES)[number];
export type AgentCommandStatus = (typeof AGENT_COMMAND_STATUSES)[number];
export type AgentValidationErrorCode = (typeof AGENT_VALIDATION_ERROR_CODES)[number];

export interface AgentCommandIO {
	readonly name: string;
	readonly description: string;
	readonly required: boolean;
}

export interface AgentCommand {
	readonly id: AgentCommandId;
	readonly name: string;
	readonly intent: string;
	readonly status: AgentCommandStatus;
	readonly privacyLevel: AgentPrivacyLevel;
	readonly writePolicy: AgentWritePolicy;
	readonly prerequisites: readonly string[];
	readonly inputs: readonly AgentCommandIO[];
	readonly outputs: readonly AgentCommandIO[];
	readonly requiredEvidence: readonly string[];
	readonly supportedSurfaces: readonly AgentSurfaceId[];
	readonly requiredSafetyPhrases: readonly string[];
	readonly recoveryBehavior: string;
	readonly notes: readonly string[];
}

export interface AgentSurfaceDefinition {
	readonly id: AgentSurfaceId;
	readonly label: string;
	readonly path: string;
	readonly required: boolean;
	readonly requiredSafetyPhrases: readonly string[];
}

export interface AgentValidationIssue {
	readonly code: AgentValidationErrorCode;
	readonly message: string;
	readonly commandId?: AgentCommandId | string;
	readonly surfaceId?: AgentSurfaceId | string;
	readonly path?: string;
	readonly field?: string;
	readonly line?: number;
}

export interface AgentValidationSuccess {
	readonly ok: true;
	readonly checkedAt?: string;
	readonly issues: readonly [];
}

export interface AgentValidationFailure {
	readonly ok: false;
	readonly checkedAt?: string;
	readonly issues: readonly AgentValidationIssue[];
}

export type AgentValidationResult = AgentValidationSuccess | AgentValidationFailure;

export interface AgentSurfaceValidationRequest {
	readonly surface: AgentSurfaceDefinition;
	readonly markdown: string;
	readonly commands: readonly AgentCommand[];
}

export interface AgentSurfaceValidationReport {
	readonly surface: AgentSurfaceDefinition;
	readonly commandIds: readonly string[];
	readonly requiredSafetyPhrases: readonly string[];
	readonly issues: readonly AgentValidationIssue[];
}

export interface FixtureSafetyEntry {
	readonly path: string;
	readonly content: string;
}

export interface FixtureSafetyReport {
	readonly path: string;
	readonly issues: readonly AgentValidationIssue[];
}

export interface FrameworkUpdatePreviewInput {
	readonly rootDir: string;
	readonly candidatePaths: readonly string[];
	readonly now?: Date;
}

export interface FrameworkUpdatePreviewAction {
	readonly path: string;
	readonly action: "create" | "update" | "skip";
	readonly reason: string;
}

export interface FrameworkUpdatePreviewPlan {
	readonly dryRun: true;
	readonly generatedAt: string;
	readonly actions: readonly FrameworkUpdatePreviewAction[];
	readonly excludedUserContentPaths: readonly string[];
	readonly issues: readonly AgentValidationIssue[];
}

export const assertNeverAgentCommandValue = (value: never): never => {
	throw new Error(`Unhandled agent command contract value: ${String(value)}`);
};

export const isAgentCommandId = (value: unknown): value is AgentCommandId =>
	typeof value === "string" && AGENT_COMMAND_IDS.includes(value as AgentCommandId);

export const isAgentSurfaceId = (value: unknown): value is AgentSurfaceId =>
	typeof value === "string" && AGENT_SURFACE_IDS.includes(value as AgentSurfaceId);

export const isAgentPrivacyLevel = (value: unknown): value is AgentPrivacyLevel =>
	typeof value === "string" && AGENT_PRIVACY_LEVELS.includes(value as AgentPrivacyLevel);

export const isAgentWritePolicy = (value: unknown): value is AgentWritePolicy =>
	typeof value === "string" && AGENT_WRITE_POLICIES.includes(value as AgentWritePolicy);

export const isAgentCommandStatus = (value: unknown): value is AgentCommandStatus =>
	typeof value === "string" && AGENT_COMMAND_STATUSES.includes(value as AgentCommandStatus);

export const agentCommandStatusLabel = (status: AgentCommandStatus): string => {
	switch (status) {
		case "implemented":
			return "Implemented";
		case "scaffolded":
			return "Scaffolded";
		case "planned":
			return "Planned";
		default:
			return assertNeverAgentCommandValue(status);
	}
};

export const agentPrivacyLevelLabel = (level: AgentPrivacyLevel): string => {
	switch (level) {
		case "local-first":
			return "Local-first";
		case "explicit-provider-review":
			return "Explicit provider review";
		default:
			return assertNeverAgentCommandValue(level);
	}
};

export const agentWritePolicyLabel = (policy: AgentWritePolicy): string => {
	switch (policy) {
		case "read-only":
			return "Read-only";
		case "no-direct-writes":
			return "No direct writes";
		case "staged-changes":
			return "Staged changes";
		case "dry-run":
			return "Dry-run";
		default:
			return assertNeverAgentCommandValue(policy);
	}
};

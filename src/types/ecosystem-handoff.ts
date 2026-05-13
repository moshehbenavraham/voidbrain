export const ECOSYSTEM_HANDOFF_LOCAL_MODES = ["git", "filesystem", "copy", "markdown-bundle"] as const;

export const ECOSYSTEM_HANDOFF_REVIEW_MODES = ["remote-provider", "cloud-provider"] as const;

export const ECOSYSTEM_HANDOFF_UNSUPPORTED_MODES = [
	"direct-publishing",
	"hosted-sync",
	"external-service",
	"team-knowledge-base",
] as const;

export const ECOSYSTEM_HANDOFF_MODES = [
	...ECOSYSTEM_HANDOFF_LOCAL_MODES,
	...ECOSYSTEM_HANDOFF_REVIEW_MODES,
	...ECOSYSTEM_HANDOFF_UNSUPPORTED_MODES,
] as const;

export const ECOSYSTEM_HANDOFF_OUTPUT_KINDS = [
	"retrieval-summary",
	"source-record",
	"staged-change-summary",
	"health-report",
	"release-evidence",
	"agent-surface-package",
	"markdown-bundle",
] as const;

export const ECOSYSTEM_HANDOFF_OUTCOMES = ["allowed", "review-required", "blocked"] as const;

export const ECOSYSTEM_HANDOFF_ISSUE_CODES = [
	"handoff.invalid-input",
	"handoff.missing-selection",
	"handoff.full-vault-selection",
	"handoff.unsupported-mode",
	"handoff.unsupported-target",
	"handoff.missing-citation",
	"handoff.missing-source-record",
	"handoff.missing-staged-change-id",
	"handoff.missing-report-id",
	"handoff.missing-artifact-path",
	"handoff.missing-checksum",
	"handoff.missing-validation-output",
	"handoff.provider-review-required",
	"handoff.provider-trust-required",
	"handoff.provider-auth-required",
	"handoff.provider-capability-required",
	"handoff.disclosure-required",
	"handoff.secret-like-value",
	"handoff.authorization-header",
	"handoff.private-path-hint",
	"handoff.prompt-body",
	"handoff.hidden-provider-state",
	"handoff.raw-note-body",
	"handoff.duplicate-in-flight",
] as const;

export type EcosystemHandoffLocalMode = (typeof ECOSYSTEM_HANDOFF_LOCAL_MODES)[number];
export type EcosystemHandoffReviewMode = (typeof ECOSYSTEM_HANDOFF_REVIEW_MODES)[number];
export type EcosystemHandoffUnsupportedMode = (typeof ECOSYSTEM_HANDOFF_UNSUPPORTED_MODES)[number];
export type EcosystemHandoffMode = (typeof ECOSYSTEM_HANDOFF_MODES)[number];
export type EcosystemHandoffOutputKind = (typeof ECOSYSTEM_HANDOFF_OUTPUT_KINDS)[number];
export type EcosystemHandoffOutcome = (typeof ECOSYSTEM_HANDOFF_OUTCOMES)[number];
export type EcosystemHandoffIssueCode = (typeof ECOSYSTEM_HANDOFF_ISSUE_CODES)[number];

export interface EcosystemHandoffChecksum {
	readonly algorithm: "sha256";
	readonly value: string;
}

export interface EcosystemHandoffCitationEvidence {
	readonly vaultPath: string;
	readonly heading: string;
	readonly citationId: string;
	readonly sourceRecordId?: string | undefined;
}

export interface EcosystemHandoffRecoveryRecord {
	readonly commandId?: string | undefined;
	readonly targetPath?: string | undefined;
	readonly cachePath?: string | undefined;
	readonly stagedChangeId?: string | undefined;
	readonly reportId?: string | undefined;
	readonly artifactPath?: string | undefined;
	readonly validationOutput?: readonly string[] | undefined;
	readonly issueCode?: EcosystemHandoffIssueCode | undefined;
	readonly retryGuidance?: string | undefined;
}

export interface EcosystemHandoffSelectedOutput {
	readonly id: string;
	readonly kind: EcosystemHandoffOutputKind;
	readonly path: string;
	readonly title?: string | undefined;
	readonly heading?: string | undefined;
	readonly grounded?: boolean | undefined;
	readonly summary?: string | undefined;
	readonly citations?: readonly EcosystemHandoffCitationEvidence[] | undefined;
	readonly sourceRecordId?: string | undefined;
	readonly stagedChangeId?: string | undefined;
	readonly reportId?: string | undefined;
	readonly artifactPath?: string | undefined;
	readonly checksum?: EcosystemHandoffChecksum | undefined;
	readonly validationOutput?: readonly string[] | undefined;
	readonly recovery?: EcosystemHandoffRecoveryRecord | undefined;
}

export interface EcosystemHandoffDisclosureState {
	readonly providerReviewed: boolean;
	readonly providerTrusted: boolean;
	readonly authReady: boolean;
	readonly capabilityConfirmed: boolean;
	readonly disclosureApproved: boolean;
	readonly providerId?: string | undefined;
	readonly target?: string | undefined;
}

export interface EcosystemHandoffIssue {
	readonly code: EcosystemHandoffIssueCode;
	readonly message: string;
	readonly remediation: string;
	readonly path?: string | undefined;
	readonly outputId?: string | undefined;
	readonly mode?: string | undefined;
	readonly target?: string | undefined;
	readonly excerpt?: string | undefined;
	readonly recovery?: EcosystemHandoffRecoveryRecord | undefined;
}

export interface EcosystemHandoffDiagnostic {
	readonly generatedAt: string;
	readonly outcome: EcosystemHandoffOutcome;
	readonly mode?: string | undefined;
	readonly selectedOutputCount: number;
	readonly issueCount: number;
	readonly issues: readonly EcosystemHandoffIssue[];
	readonly recovery: readonly EcosystemHandoffRecoveryRecord[];
}

export interface EcosystemHandoffPlanAction {
	readonly mode: EcosystemHandoffMode;
	readonly label: string;
	readonly selectedPaths: readonly string[];
	readonly target?: string | undefined;
	readonly requiresProviderReview: boolean;
}

export interface EcosystemHandoffPlan {
	readonly generatedAt: string;
	readonly outcome: EcosystemHandoffOutcome;
	readonly mode: EcosystemHandoffMode;
	readonly target?: string | undefined;
	readonly selectedOutputs: readonly EcosystemHandoffSelectedOutput[];
	readonly actions: readonly EcosystemHandoffPlanAction[];
	readonly issues: readonly EcosystemHandoffIssue[];
	readonly recovery: readonly EcosystemHandoffRecoveryRecord[];
	readonly disclosure?: EcosystemHandoffDisclosureState | undefined;
	readonly diagnostic: EcosystemHandoffDiagnostic;
}

export interface EcosystemHandoffPlanningInput {
	readonly mode: EcosystemHandoffMode | string;
	readonly selectedOutputs?: readonly EcosystemHandoffSelectedOutput[] | undefined;
	readonly target?: string | undefined;
	readonly disclosure?: Partial<EcosystemHandoffDisclosureState> | undefined;
	readonly requestId?: string | undefined;
	readonly now?: Date | undefined;
}

export interface EcosystemHandoffAllowedResult {
	readonly ok: true;
	readonly plan: EcosystemHandoffPlan & { readonly outcome: "allowed" };
}

export interface EcosystemHandoffReviewRequiredResult {
	readonly ok: true;
	readonly plan: EcosystemHandoffPlan & { readonly outcome: "review-required" };
}

export interface EcosystemHandoffBlockedResult {
	readonly ok: false;
	readonly plan: EcosystemHandoffPlan & { readonly outcome: "blocked" };
	readonly issues: readonly EcosystemHandoffIssue[];
}

export type EcosystemHandoffPlanningResult =
	| EcosystemHandoffAllowedResult
	| EcosystemHandoffReviewRequiredResult
	| EcosystemHandoffBlockedResult;

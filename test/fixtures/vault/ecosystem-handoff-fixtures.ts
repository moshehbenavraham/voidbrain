import type {
	EcosystemHandoffCitationEvidence,
	EcosystemHandoffDisclosureState,
	EcosystemHandoffPlanningInput,
	EcosystemHandoffSelectedOutput,
} from "../../../src/types/ecosystem-handoff";

export const ECOSYSTEM_HANDOFF_FIXED_DATE = new Date("2026-05-13T00:00:00.000Z");

export const ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT = ["ecosystem-handoff:synthetic-fixture"] as const;

export const ECOSYSTEM_HANDOFF_CITATION: EcosystemHandoffCitationEvidence = {
	vaultPath: "fixtures/demo-vault/notes/demo-project.md",
	heading: "Handoff Evidence",
	citationId: "citation-demo-project-handoff",
	sourceRecordId: "source-record-demo-project",
};

export const completeHandoffDisclosureState = (): EcosystemHandoffDisclosureState => ({
	providerReviewed: true,
	providerTrusted: true,
	authReady: true,
	capabilityConfirmed: true,
	disclosureApproved: true,
	providerId: "synthetic-trusted-provider",
	target: "provider.example.invalid/handoff",
});

export const missingHandoffDisclosureState = (): Partial<EcosystemHandoffDisclosureState> => ({
	providerReviewed: true,
	providerTrusted: false,
	authReady: false,
	capabilityConfirmed: false,
	disclosureApproved: false,
	providerId: "synthetic-untrusted-provider",
	target: "provider.example.invalid/handoff",
});

export const selectedRetrievalSummary = (
	overrides: Partial<EcosystemHandoffSelectedOutput> = {},
): EcosystemHandoffSelectedOutput => ({
	id: "selected-retrieval-summary",
	kind: "retrieval-summary",
	path: "fixtures/demo-vault/reports/retrieval-summary.md",
	title: "Demo Retrieval Summary",
	heading: "Handoff Evidence",
	grounded: true,
	summary: "Synthetic retrieval summary with citation evidence.",
	citations: [ECOSYSTEM_HANDOFF_CITATION],
	sourceRecordId: "source-record-demo-project",
	validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
	recovery: {
		commandId: "voidbrain.chat-with-vault",
		targetPath: "fixtures/demo-vault/reports/retrieval-summary.md",
		reportId: "chat-summary-report-fixture",
		validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
		retryGuidance: "Rerun the cited chat workflow with the same synthetic fixture query.",
	},
	...overrides,
});

export const selectedSourceRecord = (
	overrides: Partial<EcosystemHandoffSelectedOutput> = {},
): EcosystemHandoffSelectedOutput => ({
	id: "selected-source-record",
	kind: "source-record",
	path: "fixtures/demo-vault/sources/demo-source.md",
	title: "Demo Source Record",
	heading: "Source Record",
	grounded: true,
	summary: "Synthetic source record summary.",
	citations: [ECOSYSTEM_HANDOFF_CITATION],
	sourceRecordId: "source-record-demo-project",
	validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
	recovery: {
		commandId: "voidbrain.ingest-source",
		targetPath: "fixtures/demo-vault/sources/demo-source.md",
		validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
		retryGuidance: "Review the source record and rerun ingestion with the synthetic fixture path.",
	},
	...overrides,
});

export const selectedStagedChangeSummary = (
	overrides: Partial<EcosystemHandoffSelectedOutput> = {},
): EcosystemHandoffSelectedOutput => ({
	id: "selected-staged-change-summary",
	kind: "staged-change-summary",
	path: "fixtures/demo-vault/staged-changes/staged-change-summary.md",
	title: "Demo Staged Change Summary",
	heading: "Staged Change",
	summary: "Synthetic staged-change summary with review-first evidence.",
	stagedChangeId: "stage-demo-handoff-summary",
	validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
	recovery: {
		commandId: "voidbrain.stage-change",
		targetPath: "fixtures/demo-vault/notes/demo-project.md",
		stagedChangeId: "stage-demo-handoff-summary",
		validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
		retryGuidance: "Open staged-change review for the synthetic staged-change ID.",
	},
	...overrides,
});

export const selectedHealthReport = (
	overrides: Partial<EcosystemHandoffSelectedOutput> = {},
): EcosystemHandoffSelectedOutput => ({
	id: "selected-health-report",
	kind: "health-report",
	path: "fixtures/demo-vault/reports/health-summary.md",
	title: "Demo Health Report",
	heading: "Health Report",
	summary: "Synthetic redacted health report.",
	reportId: "health-report-fixture-001",
	stagedChangeId: "stage-demo-health-citation",
	validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
	recovery: {
		commandId: "voidbrain.health-check",
		targetPath: "fixtures/demo-vault/reports/health-summary.md",
		reportId: "health-report-fixture-001",
		stagedChangeId: "stage-demo-health-citation",
		validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
		retryGuidance: "Inspect the redacted health report and rerun the health check.",
	},
	...overrides,
});

export const selectedReleaseEvidence = (
	overrides: Partial<EcosystemHandoffSelectedOutput> = {},
): EcosystemHandoffSelectedOutput => ({
	id: "selected-release-evidence",
	kind: "release-evidence",
	path: "fixtures/demo-vault/release/release-evidence.md",
	title: "Demo Release Evidence",
	heading: "Release Evidence",
	summary: "Synthetic release evidence with checksum and validation output.",
	artifactPath: "build/voidbrain/main.js",
	checksum: {
		algorithm: "sha256",
		value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	},
	validationOutput: ["release-artifacts:synthetic-fixture"],
	recovery: {
		commandId: "voidbrain.validate-release-artifacts",
		artifactPath: "build/voidbrain/main.js",
		validationOutput: ["release-artifacts:synthetic-fixture"],
		retryGuidance: "Run release validation again after rebuilding the synthetic fixture artifact.",
	},
	...overrides,
});

export const selectedAgentSurfacePackage = (
	overrides: Partial<EcosystemHandoffSelectedOutput> = {},
): EcosystemHandoffSelectedOutput => ({
	id: "selected-agent-surface-package",
	kind: "agent-surface-package",
	path: "docs/agent-surface-packaging.md",
	title: "Demo Agent Surface Package",
	heading: "Local Reuse",
	summary: "Synthetic package manifest summary for local framework surfaces.",
	artifactPath: "build/agent-surfaces/manifest.json",
	checksum: {
		algorithm: "sha256",
		value: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	},
	validationOutput: ["agent-surface-package:synthetic-fixture"],
	recovery: {
		commandId: "voidbrain.validate-agent-surfaces",
		artifactPath: "build/agent-surfaces/manifest.json",
		validationOutput: ["agent-surface-package:synthetic-fixture"],
		retryGuidance: "Rerun package validation for the selected framework surface.",
	},
	...overrides,
});

export const selectedMarkdownBundle = (
	overrides: Partial<EcosystemHandoffSelectedOutput> = {},
): EcosystemHandoffSelectedOutput => ({
	id: "selected-markdown-bundle",
	kind: "markdown-bundle",
	path: "fixtures/demo-handoff/bundle/README.md",
	title: "Demo Markdown Bundle",
	heading: "Bundle Manifest",
	summary: "Synthetic bundle manifest with selected paths and recovery fields.",
	citations: [ECOSYSTEM_HANDOFF_CITATION],
	validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
	recovery: {
		commandId: "voidbrain.recover-session",
		targetPath: "fixtures/demo-handoff/bundle/README.md",
		reportId: "bundle-report-fixture",
		validationOutput: ECOSYSTEM_HANDOFF_VALIDATION_OUTPUT,
		retryGuidance: "Inspect the bundle manifest before retrying handoff.",
	},
	...overrides,
});

export const localFilesystemHandoffInput = (
	overrides: Partial<EcosystemHandoffPlanningInput> = {},
): EcosystemHandoffPlanningInput => ({
	mode: "filesystem",
	target: "fixtures/demo-handoff/reports",
	selectedOutputs: [selectedHealthReport(), selectedSourceRecord()],
	now: ECOSYSTEM_HANDOFF_FIXED_DATE,
	...overrides,
});

export const localGitHandoffInput = (
	overrides: Partial<EcosystemHandoffPlanningInput> = {},
): EcosystemHandoffPlanningInput => ({
	mode: "git",
	target: "docs/ecosystem-export-handoff-boundaries.md",
	selectedOutputs: [selectedReleaseEvidence(), selectedAgentSurfacePackage()],
	now: ECOSYSTEM_HANDOFF_FIXED_DATE,
	...overrides,
});

export const localCopyHandoffInput = (
	overrides: Partial<EcosystemHandoffPlanningInput> = {},
): EcosystemHandoffPlanningInput => ({
	mode: "copy",
	target: "clipboard",
	selectedOutputs: [selectedRetrievalSummary()],
	now: ECOSYSTEM_HANDOFF_FIXED_DATE,
	...overrides,
});

export const markdownBundleHandoffInput = (
	overrides: Partial<EcosystemHandoffPlanningInput> = {},
): EcosystemHandoffPlanningInput => ({
	mode: "markdown-bundle",
	target: "fixtures/demo-handoff/bundle",
	selectedOutputs: [selectedMarkdownBundle(), selectedHealthReport(), selectedReleaseEvidence()],
	now: ECOSYSTEM_HANDOFF_FIXED_DATE,
	...overrides,
});

export const cloudHandoffInput = (
	overrides: Partial<EcosystemHandoffPlanningInput> = {},
): EcosystemHandoffPlanningInput => ({
	mode: "cloud-provider",
	target: "provider.example.invalid/handoff",
	selectedOutputs: [selectedRetrievalSummary()],
	disclosure: completeHandoffDisclosureState(),
	now: ECOSYSTEM_HANDOFF_FIXED_DATE,
	...overrides,
});

export const unsafePublishingHandoffInput = (
	overrides: Partial<EcosystemHandoffPlanningInput> = {},
): EcosystemHandoffPlanningInput => ({
	mode: "direct-publishing",
	target: "notion.example.invalid",
	selectedOutputs: [selectedRetrievalSummary()],
	now: ECOSYSTEM_HANDOFF_FIXED_DATE,
	...overrides,
});

export const fullVaultSelection = (): EcosystemHandoffSelectedOutput =>
	selectedRetrievalSummary({
		id: "selected-full-vault",
		path: "fixtures/demo-vault",
		title: "Full Demo Vault",
	});

export const unsafeSecretOutput = (): EcosystemHandoffSelectedOutput =>
	selectedHealthReport({
		id: "selected-secret-like-output",
		summary: ["example ", "api", "_key: fixture-value"].join(""),
	});

export const unsafeAuthorizationOutput = (): EcosystemHandoffSelectedOutput =>
	selectedHealthReport({
		id: "selected-authorization-output",
		summary: ["Authorization", ": Bearer ", "fixturebearertoken1234567890"].join(""),
	});

export const unsafePrivatePathOutput = (): EcosystemHandoffSelectedOutput =>
	selectedHealthReport({
		id: "selected-private-path-output",
		summary: ["private path ", "/Users", "/demo", "/Vault/private.md"].join(""),
	});

export const unsafePromptBodyOutput = (): EcosystemHandoffSelectedOutput =>
	selectedHealthReport({
		id: "selected-prompt-body-output",
		summary: ["system ", "prompt body: raw fixture prompt"].join(""),
	});

export const unsafeHiddenProviderStateOutput = (): EcosystemHandoffSelectedOutput =>
	selectedHealthReport({
		id: "selected-hidden-provider-state-output",
		summary: ["hidden ", "provider state: opaque fixture"].join(""),
	});

export const unsafeRawNoteBodyOutput = (): EcosystemHandoffSelectedOutput =>
	selectedHealthReport({
		id: "selected-raw-note-body-output",
		summary: ["raw ", "note body: private fixture body"].join(""),
	});

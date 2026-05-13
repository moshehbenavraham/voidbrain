import { AGENT_COMMAND_CATALOG, AGENT_SURFACES } from "../../../src/agent/command-catalog";
import type { FixtureSafetyEntry } from "../../../src/types/agent-commands";
import type { EcosystemHandoffIssueCode, EcosystemHandoffSelectedOutput } from "../../../src/types/ecosystem-handoff";
import type { ReleaseArtifactChecksum } from "../../../src/types/release";
import { ECOSYSTEM_HANDOFF_CITATION, selectedReleaseEvidence } from "../vault/ecosystem-handoff-fixtures";

export const PHASE04_DISTRIBUTION_FIXED_DATE = new Date("2026-05-13T00:00:00.000Z");
export const PHASE04_DISTRIBUTION_REPORT_ID = "phase04-distribution-report-fixture";
export const PHASE04_DISTRIBUTION_STAGED_CHANGE_ID = "stage-phase04-distribution-fixture";
export const PHASE04_DISTRIBUTION_CACHE_PATH = ".voidbrain/cache/phase04-distribution-fixture.json";
export const PHASE04_DISTRIBUTION_VALIDATION_OUTPUT = ["phase04-distribution:synthetic-fixture"] as const;

export const PHASE04_DISTRIBUTION_DOC_PATHS = [
	"README.md",
	"docs/release-artifacts.md",
	"docs/obsidian-install-update.md",
	"docs/agent-surface-packaging.md",
	"docs/onboarding.md",
	"docs/provider-readiness-guide.md",
	"docs/ecosystem-export-handoff-boundaries.md",
	"docs/phase04-distribution-integration-validation.md",
] as const;

export const PHASE04_REQUIRED_DOC_PHRASES = [
	"phase 04 distribution integration validation",
	"provider review, trust, auth, capability, and disclosure",
	"selected-output",
	"staged-change id",
	"report id",
	"validation output",
	"dry-run",
	"fixtures/demo-vault",
] as const;

export const PHASE04_REQUIRED_SURFACE_PHRASES = [
	"local-first",
	"staged changes",
	"provider secrets",
	"synthetic fixtures",
	"citations",
	"dry-run",
	"recovery",
	"phase 04 distribution integration validation",
] as const;

export interface Phase04DistributionRecoveryRecord {
	readonly commandId: string;
	readonly targetPath?: string;
	readonly artifactPath?: string;
	readonly cachePath?: string;
	readonly reportId?: string;
	readonly stagedChangeId?: string;
	readonly issueCode?: EcosystemHandoffIssueCode;
	readonly checksum?: ReleaseArtifactChecksum;
	readonly validationOutput: readonly string[];
	readonly retryGuidance: string;
}

export const createPhase04DistributionRecoveryRecords = (): readonly [
	Phase04DistributionRecoveryRecord,
	Phase04DistributionRecoveryRecord,
	Phase04DistributionRecoveryRecord,
] => [
	{
		commandId: "voidbrain.validate-release-artifacts",
		artifactPath: "build/voidbrain/main.js",
		checksum: {
			algorithm: "sha256",
			value: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
		},
		validationOutput: ["release-artifacts:synthetic-fixture"],
		retryGuidance: "Rebuild release artifacts and rerun release validation.",
	},
	{
		commandId: "voidbrain.stage-change",
		targetPath: "fixtures/demo-vault/notes/distribution-summary.md",
		cachePath: PHASE04_DISTRIBUTION_CACHE_PATH,
		reportId: PHASE04_DISTRIBUTION_REPORT_ID,
		stagedChangeId: PHASE04_DISTRIBUTION_STAGED_CHANGE_ID,
		issueCode: "handoff.missing-staged-change-id",
		validationOutput: PHASE04_DISTRIBUTION_VALIDATION_OUTPUT,
		retryGuidance: "Open staged-change review for the synthetic staged-change ID.",
	},
	{
		commandId: "voidbrain.recover-session",
		targetPath: "fixtures/demo-vault/reports/phase04-distribution-closeout.md",
		cachePath: PHASE04_DISTRIBUTION_CACHE_PATH,
		reportId: PHASE04_DISTRIBUTION_REPORT_ID,
		validationOutput: PHASE04_DISTRIBUTION_VALIDATION_OUTPUT,
		retryGuidance: "Inspect the redacted report and retry the failed validation command.",
	},
];

export const createPhase04DistributionSurfaceFixtureSet = (): {
	readonly completeMarkdown: string;
	readonly staleStatusMarkdown: string;
	readonly missingDisclosureMarkdown: string;
	readonly requiredSurfacePhrases: readonly string[];
} => {
	const completeMarkdown = [
		"# Voidbrain Phase 04 Distribution Surface",
		"",
		"## Safety Policy",
		"",
		[
			"local-first staged changes provider secrets synthetic fixtures citations dry-run recovery",
			"phase 04 distribution integration validation",
			"provider review, trust, auth, capability, and disclosure",
			"fixtures/demo-vault selected-output staged-change id report id validation output",
		].join(" "),
		"",
		"## Command Catalog",
		"",
		"| Command ID | Status | Notes |",
		"|------------|--------|-------|",
		...AGENT_COMMAND_CATALOG.map(
			(command) => `| \`${command.id}\` | ${command.status} | Phase 04 fixture entry. |`,
		),
	].join("\n");

	return {
		completeMarkdown,
		staleStatusMarkdown: completeMarkdown.replace(
			"| `voidbrain.validate-agent-surfaces` | implemented |",
			"| `voidbrain.validate-agent-surfaces` | planned |",
		),
		missingDisclosureMarkdown: completeMarkdown
			.replace("provider review, trust, auth, capability, and disclosure", "")
			.replace("dry-run", ""),
		requiredSurfacePhrases: PHASE04_REQUIRED_SURFACE_PHRASES,
	};
};

export const createPhase04AgentSurfaceContentMap = (): ReadonlyMap<string, string> => {
	const { completeMarkdown } = createPhase04DistributionSurfaceFixtureSet();
	return new Map(AGENT_SURFACES.map((surface) => [surface.path, completeMarkdown]));
};

export const createPhase04SelectedDistributionEvidence = (): readonly EcosystemHandoffSelectedOutput[] => [
	selectedReleaseEvidence({
		id: "phase04-selected-release-evidence",
		recovery: createPhase04DistributionRecoveryRecords()[0],
	}),
	{
		id: "phase04-selected-validation-evidence",
		kind: "release-evidence",
		path: "fixtures/demo-vault/reports/phase04-distribution-closeout.md",
		title: "Phase 04 Distribution Closeout",
		heading: "Distribution Validation",
		grounded: true,
		summary: "Synthetic Phase 04 distribution validation with bounded recovery fields.",
		citations: [ECOSYSTEM_HANDOFF_CITATION],
		sourceRecordId: "source-record-demo-project",
		reportId: PHASE04_DISTRIBUTION_REPORT_ID,
		stagedChangeId: PHASE04_DISTRIBUTION_STAGED_CHANGE_ID,
		artifactPath: "build/phase04-distribution/validation-report.json",
		checksum: {
			algorithm: "sha256",
			value: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		},
		validationOutput: PHASE04_DISTRIBUTION_VALIDATION_OUTPUT,
		recovery: createPhase04DistributionRecoveryRecords()[1],
	},
];

export const createPhase04FixtureSafetyEntries = (): readonly FixtureSafetyEntry[] => [
	{
		path: "docs/phase04-safe-distribution-closeout.md",
		content: [
			"# Phase 04 Safe Distribution Closeout",
			"",
			"Use fixtures/demo-vault/ examples, selected-output handoff, citations, report id, staged-change id, and validation output.",
			"Cloud examples require provider review, trust, auth, capability, and disclosure before private vault content can leave the machine.",
		].join("\n"),
	},
	{
		path: "docs/phase04-unsafe-distribution-closeout.md",
		content: [
			"# Phase 04 Unsafe Distribution Closeout",
			"",
			["example ", "api", "_key", ": fixture-value"].join(""),
			["credential ", "sk", "-phase04fixturesecret0000"].join(""),
			["private path ", "/Users", "/demo", "/Vault/private.md"].join(""),
		].join("\n"),
	},
];

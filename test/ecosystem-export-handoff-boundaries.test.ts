import { describe, expect, it } from "vitest";
import {
	createEcosystemHandoffPlanBuilder,
	normalizeEcosystemHandoffSelectedOutputs,
	planEcosystemHandoff,
} from "../src/agent";
import {
	ECOSYSTEM_HANDOFF_CITATION,
	ECOSYSTEM_HANDOFF_FIXED_DATE,
	cloudHandoffInput,
	fullVaultSelection,
	localCopyHandoffInput,
	localFilesystemHandoffInput,
	localGitHandoffInput,
	markdownBundleHandoffInput,
	missingHandoffDisclosureState,
	selectedHealthReport,
	selectedReleaseEvidence,
	selectedRetrievalSummary,
	selectedSourceRecord,
	unsafeAuthorizationOutput,
	unsafeHiddenProviderStateOutput,
	unsafePrivatePathOutput,
	unsafePromptBodyOutput,
	unsafePublishingHandoffInput,
	unsafeRawNoteBodyOutput,
	unsafeSecretOutput,
} from "./fixtures/vault/ecosystem-handoff-fixtures";

describe("ecosystem export and handoff local planning", () => {
	it("normalizes selected outputs and keeps deterministic ordering", () => {
		const normalized = normalizeEcosystemHandoffSelectedOutputs([
			selectedSourceRecord(),
			selectedReleaseEvidence(),
			selectedHealthReport(),
		]);

		expect(normalized.issues).toEqual([]);
		expect(normalized.selectedOutputs.map((output) => output.path)).toEqual([
			"fixtures/demo-vault/release/release-evidence.md",
			"fixtures/demo-vault/reports/health-summary.md",
			"fixtures/demo-vault/sources/demo-source.md",
		]);
		expect(normalized.selectedOutputs[2]?.citations?.map((citation) => citation.citationId)).toEqual([
			"citation-demo-project-handoff",
		]);
	});

	it("allows selected local Git, filesystem, copy, and markdown-bundle handoff plans", () => {
		const inputs = [
			localGitHandoffInput(),
			localFilesystemHandoffInput(),
			localCopyHandoffInput(),
			markdownBundleHandoffInput(),
		];

		for (const input of inputs) {
			const result = planEcosystemHandoff(input);

			expect(result.ok).toBe(true);
			expect(result.plan.outcome).toBe("allowed");
			expect(result.plan.generatedAt).toBe(ECOSYSTEM_HANDOFF_FIXED_DATE.toISOString());
			expect(result.plan.issues).toEqual([]);
			expect(result.plan.actions).toEqual([
				expect.objectContaining({
					mode: input.mode,
					target: input.target,
					requiresProviderReview: false,
				}),
			]);
			expect(result.plan.actions[0]?.selectedPaths).toEqual(
				[...(input.selectedOutputs ?? []).map((output) => output.path)].sort((left, right) =>
					left.localeCompare(right),
				),
			);
		}
	});

	it("preserves recovery records and returns deterministic plans across repeated runs", () => {
		const input = markdownBundleHandoffInput({
			selectedOutputs: [selectedReleaseEvidence(), selectedHealthReport()],
		});
		const first = planEcosystemHandoff(input);
		const second = planEcosystemHandoff(input);

		expect(second).toEqual(first);
		expect(first.plan.recovery).toEqual([
			expect.objectContaining({
				artifactPath: "build/voidbrain/main.js",
				commandId: "voidbrain.validate-release-artifacts",
				validationOutput: ["release-artifacts:synthetic-fixture"],
			}),
			expect.objectContaining({
				commandId: "voidbrain.health-check",
				reportId: "health-report-fixture-001",
				stagedChangeId: "stage-demo-health-citation",
			}),
		]);
		expect(JSON.stringify(first.plan.diagnostic)).not.toContain("Synthetic redacted health report");
	});

	it("blocks duplicate matching requests while a plan request is in flight", async () => {
		const builder = createEcosystemHandoffPlanBuilder();
		const input = localCopyHandoffInput({ requestId: "copy-demo-summary" });
		const first = builder.buildPlanOnce(input);
		const duplicate = await builder.buildPlanOnce(input);
		const completed = await first;

		expect(completed.ok).toBe(true);
		expect(duplicate.ok).toBe(false);
		expect(duplicate.plan.issues).toEqual([
			expect.objectContaining({
				code: "handoff.duplicate-in-flight",
			}),
		]);
	});
});

describe("ecosystem export and handoff failure states", () => {
	it("blocks missing selections, missing citations, and missing source records", () => {
		const missingSelection = planEcosystemHandoff({
			mode: "copy",
			selectedOutputs: [],
			now: ECOSYSTEM_HANDOFF_FIXED_DATE,
		});
		const missingCitation = planEcosystemHandoff(
			localCopyHandoffInput({
				selectedOutputs: [selectedRetrievalSummary({ citations: undefined })],
			}),
		);
		const missingSourceRecord = planEcosystemHandoff(
			localCopyHandoffInput({
				selectedOutputs: [
					selectedRetrievalSummary({
						sourceRecordId: undefined,
						citations: [
							{
								...ECOSYSTEM_HANDOFF_CITATION,
								sourceRecordId: undefined,
							},
						],
					}),
				],
			}),
		);

		expect(missingSelection.ok).toBe(false);
		expect(missingSelection.plan.issues).toEqual([expect.objectContaining({ code: "handoff.missing-selection" })]);
		expect(missingCitation.ok).toBe(false);
		expect(missingCitation.plan.issues).toEqual([expect.objectContaining({ code: "handoff.missing-citation" })]);
		expect(missingSourceRecord.ok).toBe(false);
		expect(missingSourceRecord.plan.issues).toEqual([
			expect.objectContaining({ code: "handoff.missing-source-record" }),
		]);
	});

	it("blocks full-vault defaults and unsupported publishing targets", () => {
		const fullVault = planEcosystemHandoff(
			localFilesystemHandoffInput({
				selectedOutputs: [fullVaultSelection()],
			}),
		);
		const directPublishing = planEcosystemHandoff(unsafePublishingHandoffInput());
		const disguisedPublishing = planEcosystemHandoff(
			localFilesystemHandoffInput({
				target: "https://notion.example.invalid/workspace",
			}),
		);

		expect(fullVault.ok).toBe(false);
		expect(fullVault.plan.issues).toEqual([expect.objectContaining({ code: "handoff.full-vault-selection" })]);
		expect(directPublishing.ok).toBe(false);
		expect(directPublishing.plan.issues).toEqual([
			expect.objectContaining({ code: "handoff.unsupported-target", mode: "direct-publishing" }),
		]);
		expect(disguisedPublishing.ok).toBe(false);
		expect(disguisedPublishing.plan.issues).toEqual([
			expect.objectContaining({ code: "handoff.unsupported-target", mode: "filesystem" }),
		]);
	});

	it("marks complete cloud gates as review-required and blocks missing cloud gates", () => {
		const reviewRequired = planEcosystemHandoff(cloudHandoffInput());
		const blocked = planEcosystemHandoff(
			cloudHandoffInput({
				disclosure: missingHandoffDisclosureState(),
			}),
		);

		expect(reviewRequired.ok).toBe(true);
		expect(reviewRequired.plan.outcome).toBe("review-required");
		expect(reviewRequired.plan.actions).toEqual([
			expect.objectContaining({
				mode: "cloud-provider",
				requiresProviderReview: true,
			}),
		]);
		expect(blocked.ok).toBe(false);
		expect(blocked.plan.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "handoff.provider-trust-required" }),
				expect.objectContaining({ code: "handoff.provider-auth-required" }),
				expect.objectContaining({ code: "handoff.provider-capability-required" }),
				expect.objectContaining({ code: "handoff.disclosure-required" }),
			]),
		);
	});

	it("blocks unsafe diagnostics without leaking raw unsafe values", () => {
		const cases = [
			[unsafeSecretOutput(), "handoff.secret-like-value"],
			[unsafeAuthorizationOutput(), "handoff.authorization-header"],
			[unsafePrivatePathOutput(), "handoff.private-path-hint"],
			[unsafePromptBodyOutput(), "handoff.prompt-body"],
			[unsafeHiddenProviderStateOutput(), "handoff.hidden-provider-state"],
			[unsafeRawNoteBodyOutput(), "handoff.raw-note-body"],
		] as const;

		for (const [selectedOutput, expectedCode] of cases) {
			const result = planEcosystemHandoff(
				localCopyHandoffInput({
					selectedOutputs: [selectedOutput],
				}),
			);
			const diagnosticText = JSON.stringify(result.plan.diagnostic);

			expect(result.ok).toBe(false);
			expect(result.plan.issues).toEqual([expect.objectContaining({ code: expectedCode })]);
			expect(diagnosticText).not.toContain("fixturebearertoken1234567890");
			expect(diagnosticText).not.toContain("/Users/demo");
		}
	});
});

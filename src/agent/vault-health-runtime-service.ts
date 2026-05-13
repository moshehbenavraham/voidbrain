import type {
	VaultHealthActionRecovery,
	VaultHealthExportResult,
	VaultHealthFinding,
	VaultHealthMarkdownExport,
	VaultHealthRepairStageResult,
	VaultHealthReport,
	VaultHealthRuntimeScanResult,
} from "../types/health";
import type { IndexFreshnessSnapshot, MarkdownParseIssue, ParsedMarkdownNote } from "../types/retrieval";
import {
	type IsoTimestamp,
	type NormalizedVaultPath,
	type StagedChangeRecord,
	type StagedFrontmatterValue,
	type ValidationIssue,
	makeIsoTimestamp,
} from "../types/vault";
import { normalizeVaultPath } from "../utils/vault-paths";
import { parseMarkdownNote } from "../vectorstore";
import { StagedChangeService, createContentSha256 } from "./staged-change-service";
import {
	citationIdsForFinding,
	classifyHealthRepairSafety,
	renderVaultHealthMarkdownReport,
	scanVaultHealth,
} from "./vault-health";

export const VAULT_HEALTH_COMMAND_ID = "voidbrain.health-check";
export const VAULT_HEALTH_REPORT_FOLDER = ".voidbrain/reports";

export interface VaultHealthRuntimeMarkdownNote {
	readonly path: NormalizedVaultPath | string;
	readonly content: string;
}

export interface VaultHealthRuntimeScanInput {
	readonly notes: readonly VaultHealthRuntimeMarkdownNote[];
	readonly knownPaths?: readonly NormalizedVaultPath[];
	readonly pathAliases?: Readonly<Record<string, NormalizedVaultPath>>;
	readonly freshnessSnapshots?: readonly IndexFreshnessSnapshot[];
	readonly generatedAt?: Date;
	readonly reportId?: string;
	readonly citationRequiredArtifactKinds?: readonly string[];
}

export interface VaultHealthReportExportAdapter {
	readonly exists?: (path: NormalizedVaultPath) => Promise<boolean> | boolean;
	readonly write: (path: NormalizedVaultPath, content: string) => Promise<void>;
}

export interface VaultHealthReportExportInput {
	readonly report: VaultHealthReport;
	readonly adapter: VaultHealthReportExportAdapter;
	readonly exportPath?: NormalizedVaultPath | string;
}

export interface VaultHealthStageRepairInput {
	readonly report: VaultHealthReport;
	readonly findingId: string;
	readonly existingNotes: readonly VaultHealthRuntimeMarkdownNote[];
	readonly existingStagedChanges?: readonly StagedChangeRecord[];
}

export interface VaultHealthRuntimeServiceOptions {
	readonly now?: () => Date;
	readonly stagedChangeService?: StagedChangeService;
}

const encoder = new TextEncoder();

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

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

const safeErrorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

const safeIdSegment = (value: string): string =>
	value
		.toLowerCase()
		.replaceAll(/[^a-z0-9._-]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 120);

const recovery = (input: {
	readonly reportId?: string;
	readonly findingId?: string;
	readonly targetPath?: NormalizedVaultPath;
	readonly exportPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly validationOutput?: readonly ValidationIssue[];
}): VaultHealthActionRecovery => ({
	commandId: VAULT_HEALTH_COMMAND_ID,
	...(input.reportId === undefined ? {} : { reportId: input.reportId }),
	...(input.findingId === undefined ? {} : { findingId: input.findingId }),
	...(input.targetPath === undefined ? {} : { targetPath: input.targetPath }),
	...(input.exportPath === undefined ? {} : { exportPath: input.exportPath }),
	...(input.stagedChangeId === undefined ? {} : { stagedChangeId: input.stagedChangeId }),
	validationOutput: input.validationOutput ?? [],
});

const parseIssuesToValidation = (
	path: NormalizedVaultPath | string,
	issues: readonly MarkdownParseIssue[],
): readonly ValidationIssue[] =>
	issues.map((issue) =>
		validationIssue(
			"metadata.invalid-type",
			issue.message,
			issue.field ?? issue.code,
			typeof path === "string" ? path : String(path),
		),
	);

const defaultExportPathFor = (reportId: string): NormalizedVaultPath =>
	`${VAULT_HEALTH_REPORT_FOLDER}/${safeIdSegment(reportId)}.md` as NormalizedVaultPath;

const normalizeExportPath = (
	path: NormalizedVaultPath | string,
): readonly [NormalizedVaultPath | null, readonly ValidationIssue[]] => {
	const normalized = normalizeVaultPath(path);
	if (!normalized.ok) {
		return [null, normalized.errors];
	}

	if (!normalized.value.startsWith(`${VAULT_HEALTH_REPORT_FOLDER}/`) || !normalized.value.endsWith(".md")) {
		return [
			null,
			[
				validationIssue(
					"path.unsupported-location",
					"Vault health exports must be markdown files under .voidbrain/reports/.",
					"exportPath",
					normalized.value,
				),
			],
		];
	}

	return [normalized.value, []];
};

const normalizeExistingNotes = (
	notes: readonly VaultHealthRuntimeMarkdownNote[],
): readonly { readonly path: NormalizedVaultPath; readonly content: string }[] =>
	notes.flatMap((note) => {
		const normalized = normalizeVaultPath(note.path);
		return normalized.ok ? [{ path: normalized.value, content: note.content }] : [];
	});

const normalizeLineEndings = (content: string): string => content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
const activeStagedStatuses = new Set(["proposed", "review-ready", "conflicted", "approved"]);

const parseInlineStringArray = (value: string): readonly string[] => {
	const trimmed = value.trim();
	if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
		return trimmed.length === 0 ? [] : [trimmed.replaceAll(/^["']|["']$/g, "")];
	}

	const inner = trimmed.slice(1, -1).trim();
	if (inner.length === 0) {
		return [];
	}

	return inner.split(",").map((item) => item.trim().replaceAll(/^["']|["']$/g, ""));
};

const frontmatterArrayValue = (content: string, key: string): readonly string[] | undefined => {
	const lines = normalizeLineEndings(content).split("\n");
	if (lines[0]?.trim() !== "---") {
		return undefined;
	}

	const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (closingIndex === -1) {
		return undefined;
	}

	const prefix = `${key}:`;
	const line = lines.slice(1, closingIndex).find((candidate) => candidate.trim().startsWith(prefix));
	return line === undefined ? undefined : parseInlineStringArray(line.slice(line.indexOf(":") + 1));
};

const upsertFrontmatterArray = (
	content: string,
	key: string,
	values: readonly string[],
): { readonly afterContent: string; readonly before: StagedFrontmatterValue | undefined } | null => {
	const normalizedContent = normalizeLineEndings(content);
	const lines = normalizedContent.split("\n");
	if (lines[0]?.trim() !== "---") {
		return null;
	}

	const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (closingIndex === -1) {
		return null;
	}

	const before = frontmatterArrayValue(normalizedContent, key);
	const rendered = `${key}: [${values.join(", ")}]`;
	const existingIndex = lines.findIndex(
		(line, index) => index > 0 && index < closingIndex && line.trim().startsWith(`${key}:`),
	);
	if (existingIndex === -1) {
		lines.splice(closingIndex, 0, rendered);
	} else {
		lines[existingIndex] = rendered;
	}

	return {
		afterContent: lines.join("\n"),
		before: before === undefined ? undefined : before,
	};
};

export class VaultHealthRuntimeService {
	private readonly now: () => Date;
	private readonly stagedChangeService: StagedChangeService;
	private readonly inFlightExports = new Set<string>();
	private readonly inFlightRepairs = new Set<string>();

	public constructor(options: VaultHealthRuntimeServiceOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.stagedChangeService = options.stagedChangeService ?? new StagedChangeService({ now: this.now });
	}

	public scanMarkdownNotes(input: VaultHealthRuntimeScanInput): VaultHealthRuntimeScanResult {
		const parsedNotes = this.parseNotes(input);
		if (!parsedNotes.ok) {
			return {
				ok: false,
				message: "Vault health scan could not parse one or more markdown notes.",
				issues: parsedNotes.issues,
				recovery: recovery({ validationOutput: parsedNotes.issues }),
			};
		}

		const scanResult = scanVaultHealth({
			notes: parsedNotes.notes,
			generatedAt: input.generatedAt ?? this.now(),
			...(input.reportId === undefined ? {} : { reportId: input.reportId }),
			...(input.freshnessSnapshots === undefined ? {} : { freshnessSnapshots: input.freshnessSnapshots }),
			...(input.citationRequiredArtifactKinds === undefined
				? {}
				: { citationRequiredArtifactKinds: input.citationRequiredArtifactKinds }),
		});
		if (!scanResult.ok) {
			return {
				ok: false,
				message: "Vault health scan failed validation.",
				issues: scanResult.issues,
				recovery: recovery({ validationOutput: scanResult.issues }),
			};
		}

		return {
			ok: true,
			report: scanResult.report,
			recovery: recovery({ reportId: scanResult.report.reportId }),
		};
	}

	public async exportMarkdownReport(input: VaultHealthReportExportInput): Promise<VaultHealthExportResult> {
		const [exportPath, pathIssues] = normalizeExportPath(
			input.exportPath ?? defaultExportPathFor(input.report.reportId),
		);
		if (exportPath === null) {
			return {
				ok: false,
				message: "Vault health report export path is invalid.",
				recovery: recovery({
					reportId: input.report.reportId,
					validationOutput: pathIssues,
				}),
			};
		}

		const key = `${input.report.reportId}:${exportPath}`;
		if (this.inFlightExports.has(key)) {
			const issues = [
				validationIssue(
					"record.invalid-operation",
					`A vault health report export is already in flight for ${exportPath}.`,
					"exportPath",
					exportPath,
				),
			];
			return {
				ok: false,
				message: "Vault health report export is already in flight.",
				recovery: recovery({
					reportId: input.report.reportId,
					exportPath,
					validationOutput: issues,
				}),
			};
		}

		this.inFlightExports.add(key);
		try {
			if ((await input.adapter.exists?.(exportPath)) === true) {
				const issues = [
					validationIssue(
						"record.invalid-state",
						`Vault health report export already exists at ${exportPath}.`,
						"exportPath",
						exportPath,
					),
				];
				return {
					ok: false,
					message: "Vault health report export already exists; no support record was overwritten.",
					recovery: recovery({
						reportId: input.report.reportId,
						exportPath,
						validationOutput: issues,
					}),
				};
			}

			const content = renderVaultHealthMarkdownReport(input.report);
			await input.adapter.write(exportPath, content);
			const exported: VaultHealthMarkdownExport = {
				reportId: input.report.reportId,
				exportedAt: toIsoTimestamp(this.now()),
				exportPath,
				byteLength: encoder.encode(content).byteLength,
			};

			return {
				ok: true,
				export: exported,
				recovery: recovery({
					reportId: input.report.reportId,
					exportPath,
				}),
			};
		} catch (error) {
			const issues = [
				validationIssue(
					"record.invalid-operation",
					safeErrorMessage(error, `Vault health report export failed for ${exportPath}.`),
					"exportPath",
					exportPath,
				),
			];
			return {
				ok: false,
				message: "Vault health report export failed. No vault notes were changed.",
				recovery: recovery({
					reportId: input.report.reportId,
					exportPath,
					validationOutput: issues,
				}),
			};
		} finally {
			this.inFlightExports.delete(key);
		}
	}

	public async stageSafeRepair(input: VaultHealthStageRepairInput): Promise<VaultHealthRepairStageResult> {
		const finding = input.report.findings.find((candidate) => candidate.id === input.findingId);
		if (finding === undefined) {
			const issues = [
				validationIssue(
					"record.invalid-state",
					`Vault health finding ${input.findingId} is not present in report ${input.report.reportId}.`,
					"findingId",
				),
			];
			return {
				ok: false,
				findingId: input.findingId,
				message: "Vault health repair could not find the requested finding.",
				recovery: recovery({
					reportId: input.report.reportId,
					findingId: input.findingId,
					validationOutput: issues,
				}),
			};
		}

		const safety = classifyHealthRepairSafety(finding);
		if (safety.kind !== "safe-stage-change" || safety.targetPath === undefined) {
			const issues = [
				validationIssue("record.invalid-operation", safety.reason, "findingId", finding.affectedPaths[0]),
			];
			return {
				ok: false,
				findingId: finding.id,
				message: "Vault health finding is report-only and was not staged.",
				safety,
				recovery: recovery({
					reportId: input.report.reportId,
					findingId: finding.id,
					validationOutput: issues,
				}),
			};
		}

		const key = `${input.report.reportId}:${finding.id}`;
		if (this.inFlightRepairs.has(key)) {
			const issues = [
				validationIssue(
					"record.invalid-operation",
					`A vault health repair is already in flight for ${finding.id}.`,
					"findingId",
					safety.targetPath,
				),
			];
			return {
				ok: false,
				findingId: finding.id,
				message: "Vault health repair staging is already in flight.",
				safety,
				recovery: recovery({
					reportId: input.report.reportId,
					findingId: finding.id,
					targetPath: safety.targetPath,
					validationOutput: issues,
				}),
			};
		}

		this.inFlightRepairs.add(key);
		try {
			return await this.stageMissingCitationRepair(input.report.reportId, finding, safety.targetPath, input);
		} finally {
			this.inFlightRepairs.delete(key);
		}
	}

	private parseNotes(
		input: VaultHealthRuntimeScanInput,
	):
		| { readonly ok: true; readonly notes: readonly ParsedMarkdownNote[] }
		| { readonly ok: false; readonly issues: readonly ValidationIssue[] } {
		const notes: ParsedMarkdownNote[] = [];
		const issues: ValidationIssue[] = [];
		for (const note of input.notes) {
			const parsed = parseMarkdownNote(note.path, note.content, {
				...(input.knownPaths === undefined ? {} : { knownPaths: input.knownPaths }),
				...(input.pathAliases === undefined ? {} : { pathAliases: input.pathAliases }),
			});
			if (parsed.ok) {
				notes.push(parsed.value);
			} else {
				issues.push(...parseIssuesToValidation(note.path, parsed.errors));
			}
		}

		if (issues.length > 0) {
			return { ok: false, issues };
		}

		return { ok: true, notes };
	}

	private async stageMissingCitationRepair(
		reportId: string,
		finding: VaultHealthFinding,
		targetPath: NormalizedVaultPath,
		input: VaultHealthStageRepairInput,
	): Promise<VaultHealthRepairStageResult> {
		const existingNotes = normalizeExistingNotes(input.existingNotes);
		const existingNote = existingNotes.find((note) => note.path === targetPath);
		const citationIds = citationIdsForFinding(finding);
		if (existingNote === undefined || citationIds.length === 0) {
			const issues = [
				validationIssue(
					"record.invalid-state",
					"Safe citation repair requires current note content and source-path evidence.",
					"targetPath",
					targetPath,
				),
			];
			return {
				ok: false,
				findingId: finding.id,
				message: "Vault health repair could not be staged because required evidence is missing.",
				recovery: recovery({
					reportId,
					findingId: finding.id,
					targetPath,
					validationOutput: issues,
				}),
			};
		}

		const frontmatterUpdate = upsertFrontmatterArray(existingNote.content, "citations", citationIds);
		if (frontmatterUpdate === null) {
			const issues = [
				validationIssue(
					"metadata.invalid-type",
					"Safe citation repair requires a frontmatter block.",
					"frontmatter",
					targetPath,
				),
			];
			return {
				ok: false,
				findingId: finding.id,
				message: "Vault health repair could not be staged because the target frontmatter is malformed.",
				recovery: recovery({
					reportId,
					findingId: finding.id,
					targetPath,
					validationOutput: issues,
				}),
			};
		}

		const sourcePaths = finding.evidence.flatMap((evidence) =>
			evidence.sourcePath === undefined ? [] : [evidence.sourcePath],
		);
		const duplicate = (input.existingStagedChanges ?? []).find(
			(change) => activeStagedStatuses.has(change.status) && change.targetPath === targetPath,
		);
		if (duplicate !== undefined) {
			const issues = [
				validationIssue(
					"record.invalid-operation",
					`An active staged change already targets ${targetPath}.`,
					"targetPath",
					targetPath,
				),
			];
			return {
				ok: false,
				findingId: finding.id,
				message: "Vault health repair staging failed validation.",
				recovery: recovery({
					reportId,
					findingId: finding.id,
					targetPath,
					stagedChangeId: duplicate.changeId,
					validationOutput: issues,
				}),
			};
		}

		const result = await this.stagedChangeService.stageFrontmatterEdit({
			commandId: VAULT_HEALTH_COMMAND_ID,
			targetPath,
			sourcePaths,
			rationale: `Stage deterministic citation repair for health finding ${finding.id}.`,
			existingNotes,
			expectedBeforeSha256: await createContentSha256(existingNote.content),
			afterContent: frontmatterUpdate.afterContent,
			...(input.existingStagedChanges === undefined
				? {}
				: { existingStagedChanges: input.existingStagedChanges }),
			frontmatterPatch: [
				{
					key: "citations",
					...(frontmatterUpdate.before === undefined ? {} : { before: frontmatterUpdate.before }),
					after: citationIds,
				},
			],
			validationOutput: [
				validationIssue(
					"metadata.missing-field",
					`Citation repair is based on health finding ${finding.id}.`,
					"citations",
					targetPath,
				),
			],
		});

		if (!result.ok) {
			return {
				ok: false,
				findingId: finding.id,
				message: "Vault health repair staging failed validation.",
				recovery: recovery({
					reportId,
					findingId: finding.id,
					targetPath,
					validationOutput: result.errors,
				}),
			};
		}

		return {
			ok: true,
			findingId: finding.id,
			stagedChangeId: result.value.changeId,
			stagedChange: result.value,
			targetPath,
			recovery: recovery({
				reportId,
				findingId: finding.id,
				targetPath,
				stagedChangeId: result.value.changeId,
				validationOutput: result.value.recovery.validationOutput,
			}),
		};
	}
}

export const createVaultHealthRuntimeService = (
	options?: VaultHealthRuntimeServiceOptions,
): VaultHealthRuntimeService => new VaultHealthRuntimeService(options);

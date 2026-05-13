import type {
	VaultHealthEvidence,
	VaultHealthFinding,
	VaultHealthFindingGroup,
	VaultHealthFindingKind,
	VaultHealthRepairSafety,
	VaultHealthReport,
	VaultHealthScanResult,
	VaultHealthSeverity,
	VaultHealthSummary,
} from "../types/health";
import type { IndexFreshnessSnapshot, ParsedMarkdownNote } from "../types/retrieval";
import { type IsoTimestamp, type NormalizedVaultPath, type ValidationIssue, makeIsoTimestamp } from "../types/vault";
import { compareVaultPaths } from "../utils/vault-paths";

export interface VaultHealthScannerInput {
	readonly notes: readonly ParsedMarkdownNote[];
	readonly freshnessSnapshots?: readonly IndexFreshnessSnapshot[];
	readonly generatedAt?: Date;
	readonly reportId?: string;
	readonly citationRequiredArtifactKinds?: readonly string[];
}

const findingKindOrder: Readonly<Record<VaultHealthFindingKind, number>> = {
	"broken-wikilink": 0,
	"missing-citation": 1,
	"orphan-note": 2,
	"stale-index": 3,
	"content-gap": 4,
};

const severityOrder: Readonly<Record<VaultHealthSeverity, number>> = {
	error: 0,
	warning: 1,
	info: 2,
};

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const healthIssue = (message: string, field: string, path?: NormalizedVaultPath): ValidationIssue => ({
	code: "metadata.invalid-type",
	message,
	field,
	...(path === undefined ? {} : { path }),
});

const stableIdPart = (value: string): string =>
	value
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 96);

const boundedText = (value: string, maxLength = 240): string => {
	const normalized = value.replaceAll(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength - 3).trim()}...`;
};

const redactHealthText = (value: string): string =>
	boundedText(value)
		.replaceAll(/authorization\s*:\s*[^\s,;]+/gi, "authorization: [redacted]")
		.replaceAll(/bearer\s+[a-z0-9._~-]+/gi, "bearer [redacted]")
		.replaceAll(/(api[-_ ]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");

const sourcePathCitationId = (sourcePath: NormalizedVaultPath): string =>
	`vault:${sourcePath.replaceAll(/[^a-zA-Z0-9./_-]+/g, "-")}`;

const artifactKindOf = (note: ParsedMarkdownNote): string | undefined => {
	const value = note.frontmatter["artifact-kind"];
	return typeof value === "string" ? value : undefined;
};

const stringArrayFrontmatter = (
	note: ParsedMarkdownNote,
	field: string,
	options?: { required?: boolean },
): { readonly values: readonly string[]; readonly issues: readonly ValidationIssue[] } => {
	const value = note.frontmatter[field];
	if (value === undefined) {
		return options?.required === true
			? { values: [], issues: [healthIssue(`${field} must be present.`, field, note.path)] }
			: { values: [], issues: [] };
	}

	if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
		return { values: [], issues: [healthIssue(`${field} must be an array of strings.`, field, note.path)] };
	}

	return { values: value, issues: [] };
};

export const sortParsedNotesByPath = (notes: readonly ParsedMarkdownNote[]): readonly ParsedMarkdownNote[] =>
	[...notes].sort((left, right) => compareVaultPaths(left.path, right.path));

export const sortHealthFindings = (findings: readonly VaultHealthFinding[]): readonly VaultHealthFinding[] =>
	[...findings].sort((left, right) => {
		const bySeverity = severityOrder[left.severity] - severityOrder[right.severity];
		if (bySeverity !== 0) {
			return bySeverity;
		}

		const byKind = findingKindOrder[left.kind] - findingKindOrder[right.kind];
		if (byKind !== 0) {
			return byKind;
		}

		const leftPath = left.affectedPaths[0] ?? "";
		const rightPath = right.affectedPaths[0] ?? "";
		const byPath = compareVaultPaths(leftPath as NormalizedVaultPath, rightPath as NormalizedVaultPath);
		if (byPath !== 0) {
			return byPath;
		}

		return left.id.localeCompare(right.id);
	});

export const summarizeHealthFindings = (findings: readonly VaultHealthFinding[]): VaultHealthSummary => {
	const findingCounts: Record<VaultHealthFindingKind, number> = {
		"orphan-note": 0,
		"broken-wikilink": 0,
		"stale-index": 0,
		"missing-citation": 0,
		"content-gap": 0,
	};

	let errorCount = 0;
	let warningCount = 0;
	let infoCount = 0;

	for (const finding of findings) {
		findingCounts[finding.kind] += 1;
		switch (finding.severity) {
			case "error":
				errorCount += 1;
				break;
			case "warning":
				warningCount += 1;
				break;
			case "info":
				infoCount += 1;
				break;
			default: {
				const exhaustive: never = finding.severity;
				throw new Error(`Unhandled vault health severity: ${String(exhaustive)}`);
			}
		}
	}

	return {
		totalFindings: findings.length,
		errorCount,
		warningCount,
		infoCount,
		findingCounts,
	};
};

const groupIdFor = (
	severity: VaultHealthSeverity,
	kind: VaultHealthFindingKind,
	affectedPath: NormalizedVaultPath | null,
): string => [severity, kind, affectedPath ?? "vault"].join("__").replaceAll(/[^a-zA-Z0-9._-]+/g, "-");

export const groupHealthFindings = (findings: readonly VaultHealthFinding[]): readonly VaultHealthFindingGroup[] => {
	const grouped = new Map<string, VaultHealthFinding[]>();
	for (const finding of sortHealthFindings(findings)) {
		const affectedPath = finding.affectedPaths[0] ?? null;
		const groupId = groupIdFor(finding.severity, finding.kind, affectedPath);
		const group = grouped.get(groupId) ?? [];
		group.push(finding);
		grouped.set(groupId, group);
	}

	return [...grouped.entries()]
		.map(([groupId, groupFindings]) => {
			const firstFinding = groupFindings[0];
			if (firstFinding === undefined) {
				throw new Error("Vault health finding group cannot be empty.");
			}

			const key = {
				severity: firstFinding.severity,
				kind: firstFinding.kind,
				affectedPath: firstFinding.affectedPaths[0] ?? null,
			};
			const stageableFindings = groupFindings.filter(
				(finding) => finding.remediation.kind === "stage-change",
			).length;

			return {
				groupId,
				key,
				findingIds: groupFindings.map((finding) => finding.id),
				findings: groupFindings,
				totalFindings: groupFindings.length,
				stageableFindings,
				reportOnlyFindings: groupFindings.length - stageableFindings,
			};
		})
		.sort((left, right) => {
			const severityComparison = severityOrder[left.key.severity] - severityOrder[right.key.severity];
			if (severityComparison !== 0) {
				return severityComparison;
			}

			const kindComparison = findingKindOrder[left.key.kind] - findingKindOrder[right.key.kind];
			if (kindComparison !== 0) {
				return kindComparison;
			}

			return (left.key.affectedPath ?? "").localeCompare(right.key.affectedPath ?? "", "en", {
				sensitivity: "base",
			});
		});
};

export const createVaultHealthReport = (
	input: VaultHealthScannerInput,
	findings: readonly VaultHealthFinding[] = [],
): VaultHealthReport => {
	const sortedNotes = sortParsedNotesByPath(input.notes);
	const sortedFindings = sortHealthFindings(findings);
	const generatedAt = toIsoTimestamp(input.generatedAt ?? new Date());
	const indexStates = Object.fromEntries(
		[...(input.freshnessSnapshots ?? [])]
			.sort((left, right) => left.indexId.localeCompare(right.indexId))
			.map((snapshot) => [snapshot.indexId, snapshot.state]),
	);

	return {
		reportId: input.reportId ?? `vault-health-${generatedAt.replaceAll(/[^0-9]/g, "").slice(0, 14)}`,
		generatedAt,
		scannedPaths: sortedNotes.map((note) => note.path),
		indexStates,
		findings: sortedFindings,
		groups: groupHealthFindings(sortedFindings),
		summary: summarizeHealthFindings(sortedFindings),
	};
};

const reportOnly = (summary: string) => ({
	kind: "report-only" as const,
	summary,
});

const stageChange = (summary: string) => ({
	kind: "stage-change" as const,
	summary,
	commandId: "voidbrain.stage-change",
});

const rebuildIndex = (summary: string) => ({
	kind: "rebuild-index" as const,
	summary,
});

const existingPathSet = (notes: readonly ParsedMarkdownNote[]): ReadonlySet<NormalizedVaultPath> =>
	new Set(notes.map((note) => note.path));

const sourcePathsFor = (
	note: ParsedMarkdownNote,
): { readonly paths: readonly NormalizedVaultPath[]; readonly issues: readonly ValidationIssue[] } => {
	const { values, issues } = stringArrayFrontmatter(note, "source-paths");
	return {
		paths: values as readonly NormalizedVaultPath[],
		issues,
	};
};

const dedupeValidationIssues = (issues: readonly ValidationIssue[]): readonly ValidationIssue[] => {
	const seen = new Set<string>();
	const deduped: ValidationIssue[] = [];

	for (const issue of issues) {
		const key = `${issue.code}:${issue.path ?? ""}:${issue.field ?? ""}:${issue.message}`;
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		deduped.push(issue);
	}

	return deduped;
};

const buildInboundWikilinkMap = (
	notes: readonly ParsedMarkdownNote[],
): ReadonlyMap<NormalizedVaultPath, readonly VaultHealthEvidence[]> => {
	const inbound = new Map<NormalizedVaultPath, VaultHealthEvidence[]>();
	const paths = existingPathSet(notes);

	for (const note of notes) {
		for (const wikilink of note.wikilinks) {
			if (wikilink.targetPath !== undefined && paths.has(wikilink.targetPath)) {
				const existing = inbound.get(wikilink.targetPath) ?? [];
				existing.push({
					path: note.path,
					targetPath: wikilink.targetPath,
					line: wikilink.line,
					detail: `Inbound wikilink from ${note.path}.`,
				});
				inbound.set(wikilink.targetPath, existing);
			}
		}
	}

	return inbound;
};

const findBrokenWikilinks = (notes: readonly ParsedMarkdownNote[]): readonly VaultHealthFinding[] => {
	const findings: VaultHealthFinding[] = [];
	for (const note of notes) {
		for (const wikilink of note.wikilinks) {
			if (wikilink.status !== "missing") {
				continue;
			}

			findings.push({
				id: `broken-wikilink-${stableIdPart(`${note.path}-${wikilink.target}-${wikilink.line}`)}`,
				kind: "broken-wikilink",
				severity: "error",
				message: `Missing wikilink target "${wikilink.target}" in ${note.path}.`,
				affectedPaths: [note.path],
				evidence: [
					{
						path: note.path,
						line: wikilink.line,
						expected: wikilink.target,
						detail: `Wikilink [[${wikilink.raw}]] does not resolve to a known fixture note.`,
					},
				],
				remediation: reportOnly(
					"Broken wikilinks are ambiguous; review the target before staging any note edit.",
				),
			});
		}
	}

	return findings;
};

const findOrphanNotes = (
	notes: readonly ParsedMarkdownNote[],
): {
	readonly findings: readonly VaultHealthFinding[];
	readonly issues: readonly ValidationIssue[];
} => {
	const sortedNotes = sortParsedNotesByPath(notes);
	const paths = existingPathSet(sortedNotes);
	const inbound = buildInboundWikilinkMap(sortedNotes);
	const findings: VaultHealthFinding[] = [];
	const issues: ValidationIssue[] = [];

	for (const note of sortedNotes) {
		if (artifactKindOf(note) === "source") {
			continue;
		}

		const sourcePaths = sourcePathsFor(note);
		issues.push(...sourcePaths.issues);
		const hasExistingSourceTrace = sourcePaths.paths.some((sourcePath) => paths.has(sourcePath));
		const hasInboundWikilink = (inbound.get(note.path) ?? []).length > 0;
		if (hasExistingSourceTrace || hasInboundWikilink) {
			continue;
		}

		findings.push({
			id: `orphan-note-${stableIdPart(note.path)}`,
			kind: "orphan-note",
			severity: "warning",
			message: `${note.path} has no inbound wikilinks or valid source trace.`,
			affectedPaths: [note.path],
			evidence: [
				{
					path: note.path,
					detail: "Generated note is disconnected from parsed fixture notes and source-path frontmatter.",
				},
			],
			remediation: reportOnly("Orphan repairs are ambiguous; add a source trace or link only after user review."),
		});
	}

	return { findings, issues };
};

const contentGapArtifactKinds = new Set(["summary", "entity", "concept", "conversation"]);

const findContentGaps = (notes: readonly ParsedMarkdownNote[]): readonly VaultHealthFinding[] => {
	const findings: VaultHealthFinding[] = [];

	for (const note of sortParsedNotesByPath(notes)) {
		const artifactKind = artifactKindOf(note);
		if (artifactKind === undefined || !contentGapArtifactKinds.has(artifactKind)) {
			continue;
		}

		const hasHeading = note.headings.length > 0;
		const contentLength = note.chunks.reduce((total, chunk) => total + chunk.text.length, 0);
		if (hasHeading && contentLength >= 32) {
			continue;
		}

		findings.push({
			id: `content-gap-${stableIdPart(note.path)}`,
			kind: "content-gap",
			severity: "warning",
			message: `${note.path} appears to have incomplete generated note content.`,
			affectedPaths: [note.path],
			evidence: [
				{
					path: note.path,
					expected: "heading and at least 32 characters of parsed body text",
					actual: `${note.headings.length} heading(s), ${contentLength} parsed character(s)`,
					detail: "Generated note content is too sparse to trust as a complete artifact.",
				},
			],
			remediation: reportOnly("Content gaps need source review; no deterministic repair is staged."),
		});
	}

	return findings;
};

const fingerprintEvidence = (
	snapshot: IndexFreshnessSnapshot,
	path: NormalizedVaultPath,
): Pick<VaultHealthEvidence, "expected" | "actual"> => {
	const indexed = snapshot.indexedSources.find((source) => source.path === path);
	const current = snapshot.currentSources.find((source) => source.path === path);

	return {
		...(indexed === undefined ? {} : { expected: indexed.contentFingerprint }),
		...(current === undefined ? {} : { actual: current.contentFingerprint }),
	};
};

const indexFinding = (
	snapshot: IndexFreshnessSnapshot,
	path: NormalizedVaultPath | undefined,
	detail: string,
	severity: VaultHealthSeverity,
): VaultHealthFinding => ({
	id: `stale-index-${stableIdPart(`${snapshot.indexId}-${path ?? snapshot.state}-${detail}`)}`,
	kind: "stale-index",
	severity,
	message: `${snapshot.indexId} index is ${snapshot.state}: ${detail}`,
	affectedPaths: path === undefined ? [] : [path],
	evidence: [
		{
			...(path === undefined ? {} : { path }),
			indexId: snapshot.indexId,
			...(path === undefined ? {} : fingerprintEvidence(snapshot, path)),
			detail,
		},
	],
	remediation: rebuildIndex("Rebuild the local index before using it as current retrieval evidence."),
});

const findStaleIndexes = (snapshots: readonly IndexFreshnessSnapshot[] = []): readonly VaultHealthFinding[] => {
	const findings: VaultHealthFinding[] = [];

	for (const snapshot of snapshots) {
		if (snapshot.state === "fresh") {
			continue;
		}

		if (snapshot.state === "missing") {
			findings.push(indexFinding(snapshot, undefined, "No indexed source fingerprints are available.", "error"));
		}

		for (const path of snapshot.missingSourcePaths) {
			findings.push(indexFinding(snapshot, path, `Missing index entry for ${path}.`, "warning"));
		}
		for (const path of snapshot.extraSourcePaths) {
			findings.push(indexFinding(snapshot, path, `Index contains extra source ${path}.`, "info"));
		}
		for (const path of snapshot.staleSourcePaths) {
			findings.push(indexFinding(snapshot, path, `Index fingerprint is stale for ${path}.`, "warning"));
		}
	}

	return findings;
};

const findMissingCitations = (
	notes: readonly ParsedMarkdownNote[],
	citationRequiredArtifactKinds: readonly string[],
): { readonly findings: readonly VaultHealthFinding[]; readonly issues: readonly ValidationIssue[] } => {
	const findings: VaultHealthFinding[] = [];
	const issues: ValidationIssue[] = [];
	const requiredKinds = new Set(citationRequiredArtifactKinds);

	for (const note of sortParsedNotesByPath(notes)) {
		const artifactKind = artifactKindOf(note);
		if (artifactKind === undefined || !requiredKinds.has(artifactKind)) {
			continue;
		}

		const sourcePaths = stringArrayFrontmatter(note, "source-paths", { required: true });
		const citations = stringArrayFrontmatter(note, "citations");
		issues.push(...sourcePaths.issues, ...citations.issues);
		if (sourcePaths.issues.length > 0 || citations.issues.length > 0) {
			continue;
		}

		if (sourcePaths.values.length > 0 && citations.values.length === 0) {
			findings.push({
				id: `missing-citation-${stableIdPart(note.path)}`,
				kind: "missing-citation",
				severity: "error",
				message: `${note.path} has source paths but no citation records.`,
				affectedPaths: [note.path],
				evidence: sourcePaths.values.map((sourcePath) => ({
					path: note.path,
					sourcePath: sourcePath as NormalizedVaultPath,
					detail: `Source-grounded ${artifactKind} note references ${sourcePath} without a citation.`,
				})),
				remediation: stageChange("Stage a citation update before presenting this note as grounded output."),
			});
		}
	}

	return { findings, issues };
};

export const scanVaultHealth = (input: VaultHealthScannerInput): VaultHealthScanResult => {
	const sortedNotes = sortParsedNotesByPath(input.notes);
	const orphanResult = findOrphanNotes(sortedNotes);
	const missingCitationResult = findMissingCitations(sortedNotes, input.citationRequiredArtifactKinds ?? ["summary"]);
	const issues = dedupeValidationIssues([...orphanResult.issues, ...missingCitationResult.issues]);
	if (issues.length > 0) {
		return {
			ok: false,
			issues,
		};
	}

	const findings = [
		...findBrokenWikilinks(sortedNotes),
		...orphanResult.findings,
		...findStaleIndexes(input.freshnessSnapshots),
		...missingCitationResult.findings,
		...findContentGaps(sortedNotes),
	];

	return {
		ok: true,
		report: createVaultHealthReport(input, findings),
	};
};

export const classifyHealthRepairSafety = (finding: VaultHealthFinding): VaultHealthRepairSafety => {
	if (finding.kind !== "missing-citation") {
		return {
			findingId: finding.id,
			kind: "report-only",
			reason: `${finding.kind} findings are report-only because the correct repair is ambiguous.`,
		};
	}

	const targetPath = finding.affectedPaths[0];
	const sourcePaths = finding.evidence.flatMap((evidence) =>
		evidence.sourcePath === undefined ? [] : [evidence.sourcePath],
	);
	if (targetPath === undefined || sourcePaths.length === 0) {
		return {
			findingId: finding.id,
			kind: "report-only",
			reason: "Missing-citation findings require a target path and source-path evidence before staging.",
		};
	}

	return {
		findingId: finding.id,
		kind: "safe-stage-change",
		reason: "Citation IDs can be derived deterministically from existing source-path evidence.",
		targetPath,
		commandId: "voidbrain.health-check",
	};
};

const markdownList = (values: readonly string[]): readonly string[] =>
	values.length === 0 ? ["- None"] : values.map((value) => `- ${redactHealthText(value)}`);

const renderEvidence = (evidence: VaultHealthEvidence): readonly string[] => [
	...(evidence.path === undefined ? [] : [`  - Path: \`${evidence.path}\``]),
	...(evidence.sourcePath === undefined ? [] : [`  - Source path: \`${evidence.sourcePath}\``]),
	...(evidence.targetPath === undefined ? [] : [`  - Target path: \`${evidence.targetPath}\``]),
	...(evidence.indexId === undefined ? [] : [`  - Index: \`${redactHealthText(evidence.indexId)}\``]),
	...(evidence.line === undefined ? [] : [`  - Line: ${evidence.line}`]),
	...(evidence.expected === undefined ? [] : [`  - Expected: ${redactHealthText(evidence.expected)}`]),
	...(evidence.actual === undefined ? [] : [`  - Actual: ${redactHealthText(evidence.actual)}`]),
	`  - Detail: ${redactHealthText(evidence.detail)}`,
];

export const renderVaultHealthMarkdownReport = (report: VaultHealthReport): string =>
	[
		"# Vault Health Report",
		"",
		`Report ID: \`${redactHealthText(report.reportId)}\``,
		`Generated: ${report.generatedAt}`,
		`Scanned paths: ${report.scannedPaths.length}`,
		`Findings: ${report.summary.totalFindings}`,
		`Errors: ${report.summary.errorCount}`,
		`Warnings: ${report.summary.warningCount}`,
		`Info: ${report.summary.infoCount}`,
		"",
		"## Scanned Paths",
		"",
		...markdownList(report.scannedPaths.map((path) => `\`${path}\``)),
		"",
		"## Index States",
		"",
		...markdownList(Object.entries(report.indexStates).map(([indexId, state]) => `\`${indexId}\`: ${state}`)),
		"",
		"## Findings",
		"",
		...(report.groups.length === 0
			? ["No findings."]
			: report.groups.flatMap((group) => [
					`### ${group.key.severity} ${group.key.kind} ${group.key.affectedPath ?? "vault"}`,
					"",
					`Group ID: \`${redactHealthText(group.groupId)}\``,
					`Stageable findings: ${group.stageableFindings}`,
					`Report-only findings: ${group.reportOnlyFindings}`,
					"",
					...group.findings.flatMap((finding) => [
						`#### ${redactHealthText(finding.id)}`,
						"",
						`Message: ${redactHealthText(finding.message)}`,
						`Affected paths: ${finding.affectedPaths.map((path) => `\`${path}\``).join(", ") || "None"}`,
						`Remediation: ${finding.remediation.kind} - ${redactHealthText(finding.remediation.summary)}`,
						...(finding.remediation.commandId === undefined
							? []
							: [`Command ID: \`${finding.remediation.commandId}\``]),
						"",
						"Evidence:",
						...finding.evidence.flatMap(renderEvidence),
						"",
					]),
				])),
		"## Recovery",
		"",
		"- Command ID: `voidbrain.health-check`",
		"- Safe repairs are staged changes only and require `voidbrain.stage-change` review before apply.",
		"- Report-only findings did not create staged changes.",
		"",
	].join("\n");

export const citationIdsForFinding = (finding: VaultHealthFinding): readonly string[] =>
	[
		...new Set(
			finding.evidence.flatMap((evidence) =>
				evidence.sourcePath === undefined ? [] : [sourcePathCitationId(evidence.sourcePath)],
			),
		),
	].sort((left, right) => left.localeCompare(right));

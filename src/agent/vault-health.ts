import type {
	VaultHealthEvidence,
	VaultHealthFinding,
	VaultHealthFindingKind,
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
				remediation: stageChange("Stage a note link update or create the missing target note after review."),
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
			remediation: stageChange("Stage a source trace or link update instead of editing the note directly."),
		});
	}

	return { findings, issues };
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
	];

	return {
		ok: true,
		report: createVaultHealthReport(input, findings),
	};
};

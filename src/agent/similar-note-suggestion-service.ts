import type { FrontmatterValue, ParsedMarkdownNote, RetrievalResult, RetrievalSearchResult } from "../types/retrieval";
import type {
	SimilarNoteCandidate,
	SimilarNoteConfidence,
	SimilarNoteSignalEvidence,
	SimilarNoteSignalKind,
	SimilarNoteSourceRecord,
	SimilarNoteStageFailureReason,
	SimilarNoteStageResult,
	SimilarNoteStageability,
	SimilarNoteSuggestion,
	SimilarNoteSuggestionKind,
	SimilarNoteSuggestionPlan,
	SimilarNoteSuggestionRecovery,
	SimilarNoteSuggestionSummary,
} from "../types/suggestions";
import {
	type IsoTimestamp,
	type NormalizedVaultPath,
	type StagedChangeRecord,
	type StagedFrontmatterPatchEntry,
	type StagedFrontmatterValue,
	type ValidationIssue,
	makeIsoTimestamp,
	makeNormalizedVaultPath,
} from "../types/vault";
import { normalizeVaultPath } from "../utils/vault-paths";
import { type ExistingVaultNote, StagedChangeService } from "./staged-change-service";

export const SIMILAR_NOTE_SUGGESTION_COMMAND_ID = "voidbrain.stage-change";

export interface SimilarNoteSuggestionPlannerInput {
	readonly notes: readonly ParsedMarkdownNote[];
	readonly retrievalResults?: readonly RetrievalSearchResult[];
	readonly stagedChanges?: readonly StagedChangeRecord[];
	readonly now?: Date;
	readonly maxCandidates?: number;
	readonly maxSuggestions?: number;
}

export interface SimilarNoteSuggestionStageInput {
	readonly plan: SimilarNoteSuggestionPlan;
	readonly suggestionId: string;
	readonly existingNotes: readonly ExistingVaultNote[];
	readonly existingStagedChanges?: readonly StagedChangeRecord[];
}

export interface SimilarNoteSuggestionServiceOptions {
	readonly now?: () => Date;
	readonly stagedChangeService?: StagedChangeService;
}

interface ComparableNote {
	readonly path: NormalizedVaultPath;
	readonly folder: string;
	readonly fileName: string;
	readonly title: string;
	readonly tags: readonly string[];
	readonly aliases: readonly string[];
	readonly headings: readonly string[];
	readonly headingTokens: readonly string[];
	readonly frontmatterSourcePaths: readonly NormalizedVaultPath[];
	readonly sourcePaths: readonly NormalizedVaultPath[];
	readonly wikilinkTargets: readonly NormalizedVaultPath[];
	readonly wikilinkTargetKeys: readonly string[];
	readonly relatedNotes: readonly NormalizedVaultPath[];
}

type CandidateWithoutRank = Omit<SimilarNoteCandidate, "rank" | "rankReasons">;
type SuggestionWithoutRank = Omit<SimilarNoteSuggestion, "rank" | "rankReasons">;

const maxDetailLength = 180;
const defaultMaxCandidates = 50;
const defaultMaxSuggestions = 120;
const activeStagedStatuses = new Set<StagedChangeRecord["status"]>([
	"proposed",
	"review-ready",
	"conflicted",
	"approved",
]);

const confidenceWeight: Readonly<Record<SimilarNoteConfidence, number>> = {
	high: 0,
	medium: 1,
	low: 2,
};

const stageabilityWeight: Readonly<Record<SimilarNoteStageability["kind"], number>> = {
	stageable: 0,
	blocked: 1,
	"report-only": 2,
};

const suggestionKindWeight: Readonly<Record<SimilarNoteSuggestionKind, number>> = {
	wikilink: 0,
	"related-note": 1,
	tag: 2,
	alias: 3,
	"frontmatter-placement": 4,
	"folder-placement": 5,
};

const signalWeights: Readonly<Record<SimilarNoteSignalKind, number>> = {
	wikilink: 0.34,
	"source-path": 0.26,
	semantic: 0.24,
	lexical: 0.2,
	tag: 0.18,
	heading: 0.12,
	alias: 0.12,
	folder: 0.08,
	frontmatter: 0.08,
};

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

const stableIdPart = (value: string): string =>
	value
		.toLowerCase()
		.replaceAll(/[^a-z0-9._-]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.slice(0, 96);

const stableId = (prefix: string, parts: readonly string[]): string =>
	`${prefix}-${parts
		.map(stableIdPart)
		.filter((part) => part.length > 0)
		.join("-")}`;

const boundedText = (value: string, maxLength = maxDetailLength): string => {
	const normalized = value.replaceAll(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength - 3).trim()}...`;
};

const uniqueSorted = <TValue extends string>(values: readonly TValue[]): readonly TValue[] =>
	[...new Set(values)].sort((left, right) => left.localeCompare(right));

const uniqueSortedPaths = (paths: readonly NormalizedVaultPath[]): readonly NormalizedVaultPath[] =>
	uniqueSorted(paths);

const asStringArray = (value: FrontmatterValue | undefined): readonly string[] => {
	if (value === undefined) {
		return [];
	}

	const values = Array.isArray(value) ? value : [value];
	return values.flatMap((item) => (typeof item === "string" && item.trim().length > 0 ? [item.trim()] : []));
};

const normalizeTag = (value: string): string => value.trim().replace(/^#+/, "").toLowerCase();

const normalizeToken = (value: string): string =>
	value
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, " ")
		.trim();

const tokenSet = (values: readonly string[]): readonly string[] =>
	uniqueSorted(
		values.flatMap((value) =>
			normalizeToken(value)
				.split(/\s+/)
				.filter((token) => token.length >= 3),
		),
	);

const intersection = <TValue extends string>(left: readonly TValue[], right: readonly TValue[]): readonly TValue[] => {
	const rightSet = new Set(right);
	return uniqueSorted(left.filter((value) => rightSet.has(value)));
};

const overlapScore = (shared: number, leftCount: number, rightCount: number): number => {
	const denominator = Math.max(1, Math.min(leftCount, rightCount));
	return Math.min(1, shared / denominator);
};

const pathFolder = (path: NormalizedVaultPath): string => {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
};

const pathFileName = (path: NormalizedVaultPath): string => {
	const slashIndex = path.lastIndexOf("/");
	const name = slashIndex === -1 ? path : path.slice(slashIndex + 1);
	return name.endsWith(".md") ? name.slice(0, -3) : name;
};

const wikiTargetForPath = (path: NormalizedVaultPath): string => pathFileName(path);

const wikilinkKey = (value: string): string => value.trim().toLowerCase().replace(/\.md$/, "");

const titleForNote = (note: ParsedMarkdownNote): string => {
	const title = note.frontmatter.title;
	if (typeof title === "string" && title.trim().length > 0) {
		return title.trim();
	}

	const firstHeading = note.headings[0]?.text;
	return firstHeading === undefined || firstHeading.trim().length === 0 ? pathFileName(note.path) : firstHeading;
};

const frontmatterSourcePathsForNote = (note: ParsedMarkdownNote): readonly NormalizedVaultPath[] =>
	uniqueSortedPaths(
		asStringArray(note.frontmatter["source-paths"]).flatMap((path) => {
			const normalized = normalizeVaultPath(path);
			return normalized.ok ? [normalized.value] : [];
		}),
	);

const sourcePathsForNote = (note: ParsedMarkdownNote): readonly NormalizedVaultPath[] =>
	uniqueSortedPaths([...frontmatterSourcePathsForNote(note), ...note.chunks.flatMap((chunk) => chunk.sourcePaths)]);

const relatedNotesForNote = (note: ParsedMarkdownNote): readonly NormalizedVaultPath[] =>
	uniqueSortedPaths(
		asStringArray(note.frontmatter["related-notes"]).flatMap((path) => {
			const normalized = normalizeVaultPath(path);
			return normalized.ok ? [normalized.value] : [];
		}),
	);

const comparableNoteFromParsed = (note: ParsedMarkdownNote): ComparableNote => {
	const title = titleForNote(note);
	const headings = uniqueSorted(note.headings.map((heading) => heading.text).filter((heading) => heading.length > 0));
	const aliases = uniqueSorted(asStringArray(note.frontmatter.aliases));
	const tags = uniqueSorted(note.tags.map((tag) => normalizeTag(tag.value)).filter((tag) => tag.length > 0));
	const wikilinkTargets = uniqueSortedPaths(
		note.wikilinks.flatMap((link) => (link.targetPath === undefined ? [] : [link.targetPath])),
	);
	const wikilinkTargetKeys = uniqueSorted(
		note.wikilinks.flatMap((link) => [
			wikilinkKey(link.target),
			...(link.targetPath === undefined
				? []
				: [wikilinkKey(link.targetPath), wikilinkKey(pathFileName(link.targetPath))]),
		]),
	);

	return {
		path: note.path,
		folder: pathFolder(note.path),
		fileName: pathFileName(note.path),
		title,
		tags,
		aliases,
		headings,
		headingTokens: tokenSet([title, ...headings, ...aliases]),
		frontmatterSourcePaths: frontmatterSourcePathsForNote(note),
		sourcePaths: sourcePathsForNote(note),
		wikilinkTargets,
		wikilinkTargetKeys,
		relatedNotes: relatedNotesForNote(note),
	};
};

const evidenceId = (
	kind: SimilarNoteSignalKind,
	sourcePath: NormalizedVaultPath,
	relatedPath: NormalizedVaultPath,
	value: string,
): string => stableId("similar-evidence", [kind, sourcePath, relatedPath, value]);

const signalEvidence = (input: {
	readonly kind: SimilarNoteSignalKind;
	readonly detail: string;
	readonly score: number;
	readonly sourcePath: NormalizedVaultPath;
	readonly relatedPath: NormalizedVaultPath;
	readonly heading?: string;
	readonly value?: string;
	readonly retrievalResult?: RetrievalResult;
}): SimilarNoteSignalEvidence => ({
	id: evidenceId(input.kind, input.sourcePath, input.relatedPath, input.value ?? input.detail),
	kind: input.kind,
	detail: boundedText(input.detail),
	score: Number(input.score.toFixed(4)),
	sourcePath: input.sourcePath,
	relatedPath: input.relatedPath,
	targetPath: input.sourcePath,
	...(input.heading === undefined ? {} : { heading: input.heading }),
	...(input.value === undefined ? {} : { value: input.value }),
	...(input.retrievalResult === undefined
		? {}
		: {
				retrievalResultId: input.retrievalResult.id,
				retrievalMethod: input.retrievalResult.scoreDetails.method,
			}),
});

const candidateKey = (sourcePath: NormalizedVaultPath, relatedPath: NormalizedVaultPath): string =>
	`${sourcePath}\u0000${relatedPath}`;

const addSignal = (
	signalsByPair: Map<string, SimilarNoteSignalEvidence[]>,
	evidence: SimilarNoteSignalEvidence,
): void => {
	if (evidence.relatedPath === undefined || evidence.sourcePath === evidence.relatedPath) {
		return;
	}

	const key = candidateKey(evidence.sourcePath, evidence.relatedPath);
	const existing = signalsByPair.get(key) ?? [];
	signalsByPair.set(key, [...existing, evidence]);
};

const addSymmetricSignal = (
	signalsByPair: Map<string, SimilarNoteSignalEvidence[]>,
	left: ComparableNote,
	right: ComparableNote,
	kind: SimilarNoteSignalKind,
	score: number,
	value: string,
	detail: (source: ComparableNote, related: ComparableNote) => string,
): void => {
	addSignal(
		signalsByPair,
		signalEvidence({
			kind,
			score,
			sourcePath: left.path,
			relatedPath: right.path,
			value,
			detail: detail(left, right),
		}),
	);
	addSignal(
		signalsByPair,
		signalEvidence({
			kind,
			score,
			sourcePath: right.path,
			relatedPath: left.path,
			value,
			detail: detail(right, left),
		}),
	);
};

const addComparableSignals = (
	signalsByPair: Map<string, SimilarNoteSignalEvidence[]>,
	left: ComparableNote,
	right: ComparableNote,
): void => {
	const sharedTags = intersection(left.tags, right.tags);
	if (sharedTags.length > 0) {
		addSymmetricSignal(
			signalsByPair,
			left,
			right,
			"tag",
			overlapScore(sharedTags.length, left.tags.length, right.tags.length),
			sharedTags.join(","),
			(source, related) => `${source.path} and ${related.path} share tag(s): ${sharedTags.join(", ")}.`,
		);
	}

	const sharedHeadingTokens = intersection(left.headingTokens, right.headingTokens);
	if (sharedHeadingTokens.length > 0) {
		addSymmetricSignal(
			signalsByPair,
			left,
			right,
			"heading",
			overlapScore(sharedHeadingTokens.length, left.headingTokens.length, right.headingTokens.length),
			sharedHeadingTokens.join(","),
			(source, related) =>
				`${source.path} and ${related.path} share heading/title token(s): ${sharedHeadingTokens.join(", ")}.`,
		);
	}

	const sharedAliases = intersection(tokenSet(left.aliases), tokenSet(right.aliases));
	if (sharedAliases.length > 0) {
		addSymmetricSignal(
			signalsByPair,
			left,
			right,
			"alias",
			overlapScore(sharedAliases.length, left.aliases.length, right.aliases.length),
			sharedAliases.join(","),
			(source, related) =>
				`${source.path} and ${related.path} share alias token(s): ${sharedAliases.join(", ")}.`,
		);
	}

	const sharedSourcePaths = intersection(left.sourcePaths, right.sourcePaths);
	if (sharedSourcePaths.length > 0) {
		addSymmetricSignal(
			signalsByPair,
			left,
			right,
			"source-path",
			overlapScore(sharedSourcePaths.length, left.sourcePaths.length, right.sourcePaths.length),
			sharedSourcePaths.join(","),
			(source, related) =>
				`${source.path} and ${related.path} share source path(s): ${sharedSourcePaths.join(", ")}.`,
		);
	}

	if (left.folder.length > 0 && left.folder === right.folder) {
		addSymmetricSignal(
			signalsByPair,
			left,
			right,
			"folder",
			1,
			left.folder,
			(source, related) => `${source.path} and ${related.path} are in folder ${source.folder}.`,
		);
	}

	if (left.wikilinkTargets.includes(right.path)) {
		addSignal(
			signalsByPair,
			signalEvidence({
				kind: "wikilink",
				score: 1,
				sourcePath: left.path,
				relatedPath: right.path,
				value: right.path,
				detail: `${left.path} already links to ${right.path}.`,
			}),
		);
	}

	if (right.wikilinkTargets.includes(left.path)) {
		addSignal(
			signalsByPair,
			signalEvidence({
				kind: "wikilink",
				score: 1,
				sourcePath: right.path,
				relatedPath: left.path,
				value: left.path,
				detail: `${right.path} already links to ${left.path}.`,
			}),
		);
	}
};

const addRetrievalSignals = (
	signalsByPair: Map<string, SimilarNoteSignalEvidence[]>,
	notesByPath: ReadonlyMap<NormalizedVaultPath, ComparableNote>,
	retrievalResults: readonly RetrievalSearchResult[],
): void => {
	for (const result of retrievalResults) {
		if (!result.ok) {
			continue;
		}

		for (const retrievalResult of result.results) {
			const related = notesByPath.get(retrievalResult.path);
			if (related === undefined) {
				continue;
			}

			for (const sourcePath of retrievalResult.sourcePaths) {
				if (sourcePath === retrievalResult.path || !notesByPath.has(sourcePath)) {
					continue;
				}

				const kind = retrievalResult.scoreDetails.method;
				addSignal(
					signalsByPair,
					signalEvidence({
						kind,
						score: Math.max(0, Math.min(1, retrievalResult.score)),
						sourcePath,
						relatedPath: retrievalResult.path,
						value: retrievalResult.id,
						retrievalResult,
						detail: `Retrieval result ${retrievalResult.id} matched ${retrievalResult.path} with score ${retrievalResult.score}.`,
						...(retrievalResult.heading === undefined ? {} : { heading: retrievalResult.heading }),
					}),
				);
			}
		}
	}
};

const candidateScore = (evidence: readonly SimilarNoteSignalEvidence[]): number => {
	const bestByKind = new Map<SimilarNoteSignalKind, number>();
	for (const item of evidence) {
		bestByKind.set(item.kind, Math.max(bestByKind.get(item.kind) ?? 0, item.score));
	}

	let score = 0;
	for (const [kind, value] of bestByKind) {
		score += value * signalWeights[kind];
	}

	return Number(Math.min(1, score).toFixed(4));
};

const confidenceForScore = (score: number): SimilarNoteConfidence => {
	if (score >= 0.5) {
		return "high";
	}
	if (score >= 0.24) {
		return "medium";
	}

	return "low";
};

const sourceRecordsForEvidence = (
	sourcePath: NormalizedVaultPath,
	relatedPath: NormalizedVaultPath,
	evidence: readonly SimilarNoteSignalEvidence[],
	stagedChanges: readonly StagedChangeRecord[],
): readonly SimilarNoteSourceRecord[] => {
	const retrievalRecords = evidence.flatMap((item) =>
		item.retrievalResultId === undefined
			? []
			: [
					{
						kind: "retrieval-result" as const,
						id: item.retrievalResultId,
						path: relatedPath,
						relatedPath,
						...(item.heading === undefined ? {} : { heading: item.heading }),
						retrievalResultId: item.retrievalResultId,
					},
				],
	);
	const stagedRecords = stagedChanges
		.filter(
			(change) =>
				activeStagedStatuses.has(change.status) &&
				(change.targetPath === sourcePath || change.targetPath === relatedPath),
		)
		.map((change) => ({
			kind: "staged-change" as const,
			id: change.changeId,
			path: change.targetPath,
			stagedChangeId: change.changeId,
		}));

	return [
		{ kind: "parsed-note", id: sourcePath, path: sourcePath, relatedPath },
		{ kind: "parsed-note", id: relatedPath, path: relatedPath, relatedPath: sourcePath },
		...retrievalRecords,
		...stagedRecords,
	];
};

const candidateRankReasons = (candidate: CandidateWithoutRank): readonly string[] => [
	`confidence:${candidate.confidence}`,
	`score:${candidate.score.toFixed(4)}`,
	`source:${candidate.sourcePath}`,
	`related:${candidate.relatedPath}`,
];

const rankCandidates = (candidates: readonly CandidateWithoutRank[]): readonly SimilarNoteCandidate[] =>
	[...candidates]
		.sort((left, right) => {
			const byConfidence = confidenceWeight[left.confidence] - confidenceWeight[right.confidence];
			if (byConfidence !== 0) {
				return byConfidence;
			}

			const byScore = right.score - left.score;
			if (byScore !== 0) {
				return byScore;
			}

			const bySource = left.sourcePath.localeCompare(right.sourcePath);
			if (bySource !== 0) {
				return bySource;
			}

			const byRelated = left.relatedPath.localeCompare(right.relatedPath);
			if (byRelated !== 0) {
				return byRelated;
			}

			return left.candidateId.localeCompare(right.candidateId);
		})
		.map((candidate, index) => ({
			...candidate,
			rank: index + 1,
			rankReasons: candidateRankReasons(candidate),
		}));

const activeStagedChangeForTarget = (
	stagedChanges: readonly StagedChangeRecord[],
	targetPath: NormalizedVaultPath,
	destinationPath?: NormalizedVaultPath,
): StagedChangeRecord | undefined =>
	stagedChanges.find(
		(change) =>
			activeStagedStatuses.has(change.status) &&
			(change.targetPath === targetPath ||
				change.operationMetadata?.destinationPath === targetPath ||
				change.targetPath === destinationPath),
	);

const recoveryForSuggestion = (input: {
	readonly suggestionId: string;
	readonly sourcePath: NormalizedVaultPath;
	readonly relatedPath?: NormalizedVaultPath;
	readonly targetPath: NormalizedVaultPath;
	readonly destinationPath?: NormalizedVaultPath;
	readonly stagedChangeId?: string;
	readonly validationOutput?: readonly ValidationIssue[];
}): SimilarNoteSuggestionRecovery => ({
	commandId: SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
	suggestionId: input.suggestionId,
	sourcePath: input.sourcePath,
	...(input.relatedPath === undefined ? {} : { relatedPath: input.relatedPath }),
	targetPath: input.targetPath,
	...(input.destinationPath === undefined ? {} : { destinationPath: input.destinationPath }),
	...(input.stagedChangeId === undefined ? {} : { stagedChangeId: input.stagedChangeId }),
	validationOutput: input.validationOutput ?? [],
});

const stageabilityForSuggestion = (input: {
	readonly kind: SimilarNoteSuggestionKind;
	readonly confidence: SimilarNoteConfidence;
	readonly targetPath: NormalizedVaultPath;
	readonly destinationPath?: NormalizedVaultPath;
	readonly stagedChanges: readonly StagedChangeRecord[];
	readonly existingPaths: ReadonlySet<NormalizedVaultPath>;
}): SimilarNoteStageability => {
	const duplicate = activeStagedChangeForTarget(input.stagedChanges, input.targetPath, input.destinationPath);
	if (duplicate !== undefined) {
		return {
			kind: "blocked",
			reason: `An active staged change already targets ${input.targetPath}.`,
			commandId: SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
			targetPath: input.targetPath,
			...(input.destinationPath === undefined ? {} : { destinationPath: input.destinationPath }),
			blockedByStagedChangeId: duplicate.changeId,
		};
	}

	if (input.kind === "folder-placement" && input.destinationPath !== undefined) {
		if (input.existingPaths.has(input.destinationPath)) {
			return {
				kind: "blocked",
				reason: `Destination path ${input.destinationPath} already exists.`,
				commandId: SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
				targetPath: input.targetPath,
				destinationPath: input.destinationPath,
			};
		}
	}

	if (input.confidence === "low") {
		return {
			kind: "report-only",
			reason: "Low-confidence suggestion is visible for review but not stageable.",
			targetPath: input.targetPath,
			...(input.destinationPath === undefined ? {} : { destinationPath: input.destinationPath }),
		};
	}

	return {
		kind: "stageable",
		reason: "Suggestion can be staged for explicit review without mutating vault files directly.",
		commandId: SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
		targetPath: input.targetPath,
		...(input.destinationPath === undefined ? {} : { destinationPath: input.destinationPath }),
	};
};

const suggestionRankReasons = (suggestion: SuggestionWithoutRank): readonly string[] => [
	`confidence:${suggestion.confidence}`,
	`score:${suggestion.score.toFixed(4)}`,
	`stageability:${suggestion.stageability.kind}`,
	`kind:${suggestion.kind}`,
	`target:${suggestion.targetPath}`,
];

const rankSuggestions = (suggestions: readonly SuggestionWithoutRank[]): readonly SimilarNoteSuggestion[] =>
	[...suggestions]
		.sort((left, right) => {
			const byConfidence = confidenceWeight[left.confidence] - confidenceWeight[right.confidence];
			if (byConfidence !== 0) {
				return byConfidence;
			}

			const byScore = right.score - left.score;
			if (byScore !== 0) {
				return byScore;
			}

			const byStageability =
				stageabilityWeight[left.stageability.kind] - stageabilityWeight[right.stageability.kind];
			if (byStageability !== 0) {
				return byStageability;
			}

			const byPath = left.targetPath.localeCompare(right.targetPath);
			if (byPath !== 0) {
				return byPath;
			}

			const byKind = suggestionKindWeight[left.kind] - suggestionKindWeight[right.kind];
			if (byKind !== 0) {
				return byKind;
			}

			return left.suggestionId.localeCompare(right.suggestionId);
		})
		.map((suggestion, index) => ({
			...suggestion,
			rank: index + 1,
			rankReasons: suggestionRankReasons(suggestion),
		}));

const summarizeSuggestions = (suggestions: readonly SimilarNoteSuggestion[]): SimilarNoteSuggestionSummary => ({
	totalSuggestions: suggestions.length,
	highConfidenceCount: suggestions.filter((suggestion) => suggestion.confidence === "high").length,
	mediumConfidenceCount: suggestions.filter((suggestion) => suggestion.confidence === "medium").length,
	lowConfidenceCount: suggestions.filter((suggestion) => suggestion.confidence === "low").length,
	stageableCount: suggestions.filter((suggestion) => suggestion.stageability.kind === "stageable").length,
	reportOnlyCount: suggestions.filter((suggestion) => suggestion.stageability.kind === "report-only").length,
	blockedCount: suggestions.filter((suggestion) => suggestion.stageability.kind === "blocked").length,
	affectedPaths: uniqueSortedPaths(
		suggestions.flatMap((suggestion) => [
			suggestion.targetPath,
			...(suggestion.relatedPath === undefined ? [] : [suggestion.relatedPath]),
			...(suggestion.destinationPath === undefined ? [] : [suggestion.destinationPath]),
		]),
	),
});

const hasWikilinkTo = (source: ComparableNote, relatedPath: NormalizedVaultPath): boolean =>
	source.wikilinkTargets.includes(relatedPath) ||
	source.wikilinkTargetKeys.includes(wikilinkKey(relatedPath)) ||
	source.wikilinkTargetKeys.includes(wikilinkKey(pathFileName(relatedPath)));

const hasFrontmatterValue = (values: readonly string[], value: string): boolean => {
	const normalizedValue = normalizeToken(value);
	return values.some((candidate) => normalizeToken(candidate) === normalizedValue);
};

const missingRelatedTag = (source: ComparableNote, related: ComparableNote): string | undefined =>
	related.tags.find((tag) => tag !== "fixture" && !source.tags.includes(tag));

const aliasSuggestionValue = (source: ComparableNote, related: ComparableNote): string | undefined => {
	const candidate = related.aliases[0] ?? related.title;
	return hasFrontmatterValue(source.aliases, candidate) ? undefined : candidate;
};

const destinationForFolderPlacement = (
	source: ComparableNote,
	related: ComparableNote,
): NormalizedVaultPath | undefined => {
	if (source.folder !== "inbox" || related.folder.length === 0 || source.folder === related.folder) {
		return undefined;
	}

	return makeNormalizedVaultPath(`${related.folder}/${source.fileName}.md`);
};

const frontmatterPlacementValue = (source: ComparableNote, related: ComparableNote): string | undefined => {
	if (source.frontmatterSourcePaths.length > 0) {
		return undefined;
	}

	return related.frontmatterSourcePaths[0] ?? related.sourcePaths[0];
};

const createSuggestion = (input: {
	readonly kind: SimilarNoteSuggestionKind;
	readonly candidate: SimilarNoteCandidate;
	readonly source: ComparableNote;
	readonly related: ComparableNote;
	readonly suggestedValue?: string;
	readonly existingValue?: string;
	readonly destinationPath?: NormalizedVaultPath;
	readonly stagedChanges: readonly StagedChangeRecord[];
	readonly existingPaths: ReadonlySet<NormalizedVaultPath>;
}): SuggestionWithoutRank => {
	const suggestionId = stableId("similar-suggestion", [
		input.kind,
		input.source.path,
		input.related.path,
		input.suggestedValue ?? input.destinationPath ?? "review",
	]);
	const stageability = stageabilityForSuggestion({
		kind: input.kind,
		confidence: input.candidate.confidence,
		targetPath: input.source.path,
		...(input.destinationPath === undefined ? {} : { destinationPath: input.destinationPath }),
		stagedChanges: input.stagedChanges,
		existingPaths: input.existingPaths,
	});
	const recovery = recoveryForSuggestion({
		suggestionId,
		sourcePath: input.source.path,
		relatedPath: input.related.path,
		targetPath: input.source.path,
		...(input.destinationPath === undefined ? {} : { destinationPath: input.destinationPath }),
		...(stageability.blockedByStagedChangeId === undefined
			? {}
			: {
					stagedChangeId: stageability.blockedByStagedChangeId,
					validationOutput: [
						validationIssue(
							"record.invalid-operation",
							stageability.reason,
							"targetPath",
							input.source.path,
						),
					],
				}),
	});

	return {
		suggestionId,
		kind: input.kind,
		confidence: input.candidate.confidence,
		score: input.candidate.score,
		title: `${input.kind} suggestion for ${input.source.path}`,
		summary: boundedText(
			`${input.source.path} has local evidence linking it to ${input.related.path}; review ${input.kind} suggestion.`,
		),
		sourcePath: input.source.path,
		relatedPath: input.related.path,
		targetPath: input.source.path,
		...(input.destinationPath === undefined ? {} : { destinationPath: input.destinationPath }),
		...(input.suggestedValue === undefined ? {} : { suggestedValue: input.suggestedValue }),
		...(input.existingValue === undefined ? {} : { existingValue: input.existingValue }),
		evidence: input.candidate.evidence,
		sourceRecords: input.candidate.sourceRecords,
		stageability,
		recovery,
	};
};

const suggestionsFromCandidate = (
	candidate: SimilarNoteCandidate,
	notesByPath: ReadonlyMap<NormalizedVaultPath, ComparableNote>,
	stagedChanges: readonly StagedChangeRecord[],
	existingPaths: ReadonlySet<NormalizedVaultPath>,
): readonly SuggestionWithoutRank[] => {
	const source = notesByPath.get(candidate.sourcePath);
	const related = notesByPath.get(candidate.relatedPath);
	if (source === undefined || related === undefined) {
		return [];
	}

	const suggestions: SuggestionWithoutRank[] = [];
	if (!hasWikilinkTo(source, related.path)) {
		suggestions.push(
			createSuggestion({
				kind: "wikilink",
				candidate,
				source,
				related,
				suggestedValue: wikiTargetForPath(related.path),
				stagedChanges,
				existingPaths,
			}),
		);
	}

	if (!source.relatedNotes.includes(related.path)) {
		suggestions.push(
			createSuggestion({
				kind: "related-note",
				candidate,
				source,
				related,
				suggestedValue: related.path,
				existingValue: source.relatedNotes.join(", "),
				stagedChanges,
				existingPaths,
			}),
		);
	}

	const tagValue = missingRelatedTag(source, related);
	if (tagValue !== undefined) {
		suggestions.push(
			createSuggestion({
				kind: "tag",
				candidate,
				source,
				related,
				suggestedValue: tagValue,
				existingValue: source.tags.join(", "),
				stagedChanges,
				existingPaths,
			}),
		);
	}

	const aliasValue = aliasSuggestionValue(source, related);
	if (aliasValue !== undefined) {
		suggestions.push(
			createSuggestion({
				kind: "alias",
				candidate,
				source,
				related,
				suggestedValue: aliasValue,
				existingValue: source.aliases.join(", "),
				stagedChanges,
				existingPaths,
			}),
		);
	}

	const sourcePathValue = frontmatterPlacementValue(source, related);
	if (sourcePathValue !== undefined) {
		suggestions.push(
			createSuggestion({
				kind: "frontmatter-placement",
				candidate,
				source,
				related,
				suggestedValue: sourcePathValue,
				existingValue: source.sourcePaths.join(", "),
				stagedChanges,
				existingPaths,
			}),
		);
	}

	const destinationPath = destinationForFolderPlacement(source, related);
	if (destinationPath !== undefined) {
		suggestions.push(
			createSuggestion({
				kind: "folder-placement",
				candidate,
				source,
				related,
				suggestedValue: destinationPath,
				destinationPath,
				stagedChanges,
				existingPaths,
			}),
		);
	}

	return suggestions;
};

const normalizeExistingNotes = (
	notes: readonly ExistingVaultNote[],
): readonly { readonly path: NormalizedVaultPath; readonly content: string }[] =>
	notes.flatMap((note) => {
		const normalized = normalizeVaultPath(note.path);
		return normalized.ok ? [{ path: normalized.value, content: note.content }] : [];
	});

const findExistingNote = (
	notes: readonly { readonly path: NormalizedVaultPath; readonly content: string }[],
	path: NormalizedVaultPath,
) => notes.find((note) => note.path === path);

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
	const lines = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
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
): {
	readonly afterContent: string;
	readonly before: StagedFrontmatterValue | undefined;
	readonly after: StagedFrontmatterValue;
} | null => {
	const lines = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
	if (lines[0]?.trim() !== "---") {
		return null;
	}

	const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (closingIndex === -1) {
		return null;
	}

	const before = frontmatterArrayValue(content, key);
	const merged = [...(before ?? []), ...values].filter((value) => value.trim().length > 0);
	const after = [...new Set(merged)].sort((left, right) => left.localeCompare(right));
	const rendered = `${key}: [${after.join(", ")}]`;
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
		after,
	};
};

const appendWikilink = (
	content: string,
	relatedPath: NormalizedVaultPath,
): { readonly afterContent: string; readonly linkedTarget: string } | null => {
	const target = wikiTargetForPath(relatedPath);
	const pathTarget = relatedPath.endsWith(".md") ? relatedPath.slice(0, -3) : relatedPath;
	const escapedTargets = [target, pathTarget].map((value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const linkPattern = new RegExp(`\\[\\[(?:${escapedTargets.join("|")})(?:[#|\\]])`, "i");
	if (linkPattern.test(content)) {
		return null;
	}

	const normalizedContent = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
	const separator = normalizedContent.endsWith("\n") ? "\n" : "\n\n";
	return {
		afterContent: `${normalizedContent}${separator}Related: [[${target}]]\n`,
		linkedTarget: target,
	};
};

const validateStageTarget = (targetPath: NormalizedVaultPath): readonly ValidationIssue[] => {
	const normalized = normalizeVaultPath(targetPath);
	if (!normalized.ok) {
		return normalized.errors;
	}

	if (!normalized.value.endsWith(".md")) {
		return [
			validationIssue(
				"path.invalid-extension",
				"Similar-note suggestions can stage changes only for markdown notes.",
				"targetPath",
				normalized.value,
			),
		];
	}

	if (normalized.value.startsWith(".voidbrain/")) {
		return [
			validationIssue(
				"path.unsupported-location",
				"Similar-note suggestions cannot stage changes for Voidbrain support records.",
				"targetPath",
				normalized.value,
			),
		];
	}

	return [];
};

const failureResult = (
	reason: SimilarNoteStageFailureReason,
	message: string,
	recovery: SimilarNoteSuggestionRecovery,
	suggestionId?: string,
): SimilarNoteStageResult => ({
	ok: false,
	...(suggestionId === undefined ? {} : { suggestionId }),
	reason,
	message,
	recovery,
});

export class SimilarNoteSuggestionService {
	private readonly now: () => Date;
	private readonly stagedChangeService: StagedChangeService;
	private readonly inFlightSuggestionIds = new Set<string>();

	public constructor(options: SimilarNoteSuggestionServiceOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.stagedChangeService = options.stagedChangeService ?? new StagedChangeService({ now: this.now });
	}

	public plan(input: SimilarNoteSuggestionPlannerInput): SimilarNoteSuggestionPlan {
		const comparableNotes = input.notes.map(comparableNoteFromParsed);
		const notesByPath = new Map(comparableNotes.map((note) => [note.path, note] as const));
		const signalsByPair = new Map<string, SimilarNoteSignalEvidence[]>();
		const stagedChanges = input.stagedChanges ?? [];

		for (let leftIndex = 0; leftIndex < comparableNotes.length; leftIndex += 1) {
			const left = comparableNotes[leftIndex];
			if (left === undefined) {
				continue;
			}

			for (let rightIndex = leftIndex + 1; rightIndex < comparableNotes.length; rightIndex += 1) {
				const right = comparableNotes[rightIndex];
				if (right !== undefined) {
					addComparableSignals(signalsByPair, left, right);
				}
			}
		}
		addRetrievalSignals(signalsByPair, notesByPath, input.retrievalResults ?? []);

		const candidates = rankCandidates(
			[...signalsByPair.entries()].map(([key, evidence]) => {
				const [sourcePath = "", relatedPath = ""] = key.split("\u0000");
				const source = makeNormalizedVaultPath(sourcePath);
				const related = makeNormalizedVaultPath(relatedPath);
				const score = candidateScore(evidence);
				return {
					candidateId: stableId("similar-candidate", [source, related]),
					sourcePath: source,
					relatedPath: related,
					score,
					confidence: confidenceForScore(score),
					evidence: [...evidence].sort((left, right) => left.id.localeCompare(right.id)),
					sourceRecords: sourceRecordsForEvidence(source, related, evidence, stagedChanges),
				};
			}),
		).slice(0, input.maxCandidates ?? defaultMaxCandidates);

		const existingPaths = new Set(comparableNotes.map((note) => note.path));
		const suggestions = rankSuggestions(
			candidates.flatMap((candidate) =>
				suggestionsFromCandidate(candidate, notesByPath, stagedChanges, existingPaths),
			),
		).slice(0, input.maxSuggestions ?? defaultMaxSuggestions);

		return {
			schemaVersion: 1,
			generatedAt: toIsoTimestamp(input.now ?? this.now()),
			candidates,
			suggestions,
			summary: summarizeSuggestions(suggestions),
		};
	}

	public async stageSuggestion(input: SimilarNoteSuggestionStageInput): Promise<SimilarNoteStageResult> {
		const suggestion = input.plan.suggestions.find((candidate) => candidate.suggestionId === input.suggestionId);
		if (suggestion === undefined) {
			const issue = validationIssue(
				"record.invalid-state",
				`Similar-note suggestion ${input.suggestionId} is not present in the plan.`,
				"suggestionId",
			);
			return failureResult(
				"not-found",
				"Similar-note suggestion was not found.",
				{
					commandId: SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
					suggestionId: input.suggestionId,
					validationOutput: [issue],
				},
				input.suggestionId,
			);
		}

		if (suggestion.stageability.kind === "report-only") {
			const issue = validationIssue(
				"record.invalid-operation",
				suggestion.stageability.reason,
				"suggestionId",
				suggestion.targetPath,
			);
			return failureResult(
				"report-only",
				"Similar-note suggestion is report-only and was not staged.",
				{
					...suggestion.recovery,
					validationOutput: [...suggestion.recovery.validationOutput, issue],
				},
				suggestion.suggestionId,
			);
		}

		if (suggestion.stageability.kind === "blocked") {
			const issue = validationIssue(
				"record.invalid-operation",
				suggestion.stageability.reason,
				"targetPath",
				suggestion.targetPath,
			);
			return failureResult(
				"blocked",
				"Similar-note suggestion is blocked and was not staged.",
				{
					...suggestion.recovery,
					validationOutput: [...suggestion.recovery.validationOutput, issue],
				},
				suggestion.suggestionId,
			);
		}

		const targetIssues = validateStageTarget(suggestion.targetPath);
		if (targetIssues.length > 0) {
			return failureResult(
				"unsupported-path",
				"Similar-note suggestion target path is not stageable.",
				{
					...suggestion.recovery,
					validationOutput: [...suggestion.recovery.validationOutput, ...targetIssues],
				},
				suggestion.suggestionId,
			);
		}

		const activeDuplicate = activeStagedChangeForTarget(
			input.existingStagedChanges ?? [],
			suggestion.targetPath,
			suggestion.destinationPath,
		);
		if (activeDuplicate !== undefined) {
			const issue = validationIssue(
				"record.invalid-operation",
				`An active staged change already targets ${suggestion.targetPath}.`,
				"targetPath",
				suggestion.targetPath,
			);
			return failureResult(
				"active-staged-change",
				"Similar-note suggestion was not staged because an active staged change already targets the path.",
				{
					...suggestion.recovery,
					stagedChangeId: activeDuplicate.changeId,
					validationOutput: [...suggestion.recovery.validationOutput, issue],
				},
				suggestion.suggestionId,
			);
		}

		if (this.inFlightSuggestionIds.has(suggestion.suggestionId)) {
			const issue = validationIssue(
				"record.invalid-operation",
				`Similar-note suggestion staging is already in flight for ${suggestion.suggestionId}.`,
				"suggestionId",
				suggestion.targetPath,
			);
			return failureResult(
				"in-flight",
				"Similar-note suggestion staging is already in flight.",
				{
					...suggestion.recovery,
					validationOutput: [...suggestion.recovery.validationOutput, issue],
				},
				suggestion.suggestionId,
			);
		}

		this.inFlightSuggestionIds.add(suggestion.suggestionId);
		try {
			return await this.stageSuggestionInternal(suggestion, input);
		} finally {
			this.inFlightSuggestionIds.delete(suggestion.suggestionId);
		}
	}

	private async stageSuggestionInternal(
		suggestion: SimilarNoteSuggestion,
		input: SimilarNoteSuggestionStageInput,
	): Promise<SimilarNoteStageResult> {
		const existingNotes = normalizeExistingNotes(input.existingNotes);
		const existingNote = findExistingNote(existingNotes, suggestion.targetPath);
		if (existingNote === undefined) {
			const issue = validationIssue(
				"record.invalid-state",
				"Similar-note staging requires current note content for the target path.",
				"targetPath",
				suggestion.targetPath,
			);
			return failureResult(
				"missing-content",
				"Similar-note suggestion was not staged because current target content is missing.",
				{
					...suggestion.recovery,
					validationOutput: [...suggestion.recovery.validationOutput, issue],
				},
				suggestion.suggestionId,
			);
		}

		switch (suggestion.kind) {
			case "wikilink":
				return this.stageWikilinkSuggestion(suggestion, existingNote.content, input);
			case "tag":
				return this.stageFrontmatterArraySuggestion(suggestion, existingNote.content, input, "tags");
			case "alias":
				return this.stageFrontmatterArraySuggestion(suggestion, existingNote.content, input, "aliases");
			case "related-note":
				return this.stageFrontmatterArraySuggestion(suggestion, existingNote.content, input, "related-notes");
			case "frontmatter-placement":
				return this.stageFrontmatterArraySuggestion(suggestion, existingNote.content, input, "source-paths");
			case "folder-placement":
				return this.stageFolderPlacementSuggestion(suggestion, input);
			default: {
				const exhaustive: never = suggestion.kind;
				throw new Error(`Unhandled similar-note suggestion kind: ${String(exhaustive)}`);
			}
		}
	}

	private async stageWikilinkSuggestion(
		suggestion: SimilarNoteSuggestion,
		beforeContent: string,
		input: SimilarNoteSuggestionStageInput,
	): Promise<SimilarNoteStageResult> {
		if (suggestion.relatedPath === undefined) {
			return this.validationFailure(
				"missing-content",
				"Wikilink suggestion is missing a related path.",
				suggestion,
			);
		}

		const update = appendWikilink(beforeContent, suggestion.relatedPath);
		if (update === null) {
			return this.validationFailure("no-op", "Wikilink already exists in current note content.", suggestion);
		}

		const staged = await this.stagedChangeService.stageUpdateNote({
			commandId: SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
			targetPath: suggestion.targetPath,
			sourcePaths: sourcePathsForSuggestion(suggestion),
			rationale: `Stage wikilink suggestion ${suggestion.suggestionId}.`,
			existingNotes: input.existingNotes,
			afterContent: update.afterContent,
			validationOutput: suggestion.recovery.validationOutput,
			...(input.existingStagedChanges === undefined
				? {}
				: { existingStagedChanges: input.existingStagedChanges }),
		});

		return this.stageResultFromStagedChange(suggestion, staged);
	}

	private async stageFrontmatterArraySuggestion(
		suggestion: SimilarNoteSuggestion,
		beforeContent: string,
		input: SimilarNoteSuggestionStageInput,
		key: string,
	): Promise<SimilarNoteStageResult> {
		if (suggestion.suggestedValue === undefined) {
			return this.validationFailure("missing-content", "Frontmatter suggestion is missing a value.", suggestion);
		}

		const update = upsertFrontmatterArray(beforeContent, key, [suggestion.suggestedValue]);
		if (update === null) {
			return this.validationFailure(
				"validation-failed",
				"Frontmatter suggestion requires a valid frontmatter block.",
				suggestion,
			);
		}
		if (update.before !== undefined && JSON.stringify(update.before) === JSON.stringify(update.after)) {
			return this.validationFailure(
				"no-op",
				"Frontmatter value already exists in current note content.",
				suggestion,
			);
		}

		const frontmatterPatch: readonly StagedFrontmatterPatchEntry[] = [
			{
				key,
				...(update.before === undefined ? {} : { before: update.before }),
				after: update.after,
			},
		];
		const staged = await this.stagedChangeService.stageFrontmatterEdit({
			commandId: SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
			targetPath: suggestion.targetPath,
			sourcePaths: sourcePathsForSuggestion(suggestion),
			rationale: `Stage ${key} suggestion ${suggestion.suggestionId}.`,
			existingNotes: input.existingNotes,
			afterContent: update.afterContent,
			frontmatterPatch,
			validationOutput: suggestion.recovery.validationOutput,
			...(input.existingStagedChanges === undefined
				? {}
				: { existingStagedChanges: input.existingStagedChanges }),
		});

		return this.stageResultFromStagedChange(suggestion, staged);
	}

	private async stageFolderPlacementSuggestion(
		suggestion: SimilarNoteSuggestion,
		input: SimilarNoteSuggestionStageInput,
	): Promise<SimilarNoteStageResult> {
		if (suggestion.destinationPath === undefined) {
			return this.validationFailure(
				"missing-content",
				"Folder placement suggestion is missing a destination path.",
				suggestion,
			);
		}

		const staged = await this.stagedChangeService.stageMoveNote({
			commandId: SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
			targetPath: suggestion.targetPath,
			destinationPath: suggestion.destinationPath,
			sourcePaths: sourcePathsForSuggestion(suggestion),
			rationale: `Stage folder placement suggestion ${suggestion.suggestionId}.`,
			existingNotes: input.existingNotes,
			validationOutput: suggestion.recovery.validationOutput,
			...(input.existingStagedChanges === undefined
				? {}
				: { existingStagedChanges: input.existingStagedChanges }),
		});

		return this.stageResultFromStagedChange(suggestion, staged);
	}

	private validationFailure(
		reason: SimilarNoteStageFailureReason,
		message: string,
		suggestion: SimilarNoteSuggestion,
	): SimilarNoteStageResult {
		const issue = validationIssue("record.invalid-operation", message, "suggestionId", suggestion.targetPath);
		return failureResult(
			reason,
			message,
			{
				...suggestion.recovery,
				validationOutput: [...suggestion.recovery.validationOutput, issue],
			},
			suggestion.suggestionId,
		);
	}

	private stageResultFromStagedChange(
		suggestion: SimilarNoteSuggestion,
		staged: Awaited<ReturnType<StagedChangeService["stageUpdateNote"]>>,
	): SimilarNoteStageResult {
		if (!staged.ok) {
			return failureResult(
				"validation-failed",
				"Similar-note suggestion failed staged-change validation.",
				{
					...suggestion.recovery,
					validationOutput: [...suggestion.recovery.validationOutput, ...staged.errors],
				},
				suggestion.suggestionId,
			);
		}

		return {
			ok: true,
			suggestionId: suggestion.suggestionId,
			targetPath: staged.value.targetPath,
			stagedChangeId: staged.value.changeId,
			stagedChange: staged.value,
			recovery: {
				...suggestion.recovery,
				stagedChangeId: staged.value.changeId,
				validationOutput: staged.value.recovery.validationOutput,
			},
		};
	}
}

const sourcePathsForSuggestion = (suggestion: SimilarNoteSuggestion): readonly NormalizedVaultPath[] =>
	uniqueSortedPaths([
		suggestion.sourcePath,
		...(suggestion.relatedPath === undefined ? [] : [suggestion.relatedPath]),
		...suggestion.evidence.flatMap((evidence) => [
			evidence.sourcePath,
			...(evidence.relatedPath === undefined ? [] : [evidence.relatedPath]),
		]),
	]);

export const createSimilarNoteSuggestionService = (
	options?: SimilarNoteSuggestionServiceOptions,
): SimilarNoteSuggestionService => new SimilarNoteSuggestionService(options);

export const planSimilarNoteSuggestions = (
	input: SimilarNoteSuggestionPlannerInput,
	options?: SimilarNoteSuggestionServiceOptions,
): SimilarNoteSuggestionPlan => new SimilarNoteSuggestionService(options).plan(input);

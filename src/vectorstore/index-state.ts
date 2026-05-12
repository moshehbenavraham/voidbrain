import {
	type IndexFreshnessSnapshot,
	type IndexJobStatus,
	type IndexProgressSnapshot,
	type IndexSourceFingerprint,
	type LexicalIndexSnapshot,
	type ParsedMarkdownNote,
	assertNeverRetrievalValue,
} from "../types/retrieval";
import { type IsoTimestamp, makeIsoTimestamp } from "../types/vault";
import { compareVaultPaths } from "../utils/vault-paths";

export interface ProgressSnapshotInput {
	readonly jobId: string;
	readonly indexId: string;
	readonly status: IndexJobStatus;
	readonly totalNotes: number;
	readonly indexedNotes: number;
	readonly now: Date;
	readonly startedAt?: IsoTimestamp;
	readonly currentPath?: IndexProgressSnapshot["currentPath"];
	readonly completedAt?: IsoTimestamp;
	readonly errorMessage?: string;
}

export const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

export const compareSourceFingerprints = (left: IndexSourceFingerprint, right: IndexSourceFingerprint): number =>
	compareVaultPaths(left.path, right.path);

export const sortSourceFingerprints = (sources: readonly IndexSourceFingerprint[]): readonly IndexSourceFingerprint[] =>
	[...sources].sort(compareSourceFingerprints);

export const fingerprintsFromParsedNotes = (notes: readonly ParsedMarkdownNote[]): readonly IndexSourceFingerprint[] =>
	sortSourceFingerprints(
		notes.map((note) => ({
			path: note.path,
			contentFingerprint: note.contentFingerprint,
		})),
	);

export const createProgressSnapshot = (input: ProgressSnapshotInput): IndexProgressSnapshot => {
	const updatedAt = toIsoTimestamp(input.now);
	return {
		jobId: input.jobId,
		indexId: input.indexId,
		status: input.status,
		totalNotes: input.totalNotes,
		indexedNotes: input.indexedNotes,
		startedAt: input.startedAt ?? updatedAt,
		updatedAt,
		...(input.currentPath === undefined ? {} : { currentPath: input.currentPath }),
		...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
		...(input.errorMessage === undefined ? {} : { errorMessage: input.errorMessage }),
	};
};

export const updateProgressSnapshot = (
	previous: IndexProgressSnapshot,
	updates: Partial<Pick<IndexProgressSnapshot, "status" | "indexedNotes" | "currentPath" | "errorMessage">>,
	now: Date,
): IndexProgressSnapshot =>
	createProgressSnapshot({
		jobId: previous.jobId,
		indexId: previous.indexId,
		status: updates.status ?? previous.status,
		totalNotes: previous.totalNotes,
		indexedNotes: updates.indexedNotes ?? previous.indexedNotes,
		startedAt: previous.startedAt,
		now,
		...(updates.currentPath === undefined && previous.currentPath === undefined
			? {}
			: { currentPath: updates.currentPath ?? previous.currentPath }),
		...(updates.errorMessage === undefined && previous.errorMessage === undefined
			? {}
			: { errorMessage: updates.errorMessage ?? previous.errorMessage }),
	});

export const completeProgressSnapshot = (previous: IndexProgressSnapshot, now: Date): IndexProgressSnapshot => {
	const completedAt = toIsoTimestamp(now);
	return {
		...previous,
		status: "ready",
		indexedNotes: previous.totalNotes,
		updatedAt: completedAt,
		completedAt,
	};
};

export const cancelProgressSnapshot = (previous: IndexProgressSnapshot, now: Date): IndexProgressSnapshot => {
	const completedAt = toIsoTimestamp(now);
	return {
		...previous,
		status: "canceled",
		updatedAt: completedAt,
		completedAt,
	};
};

export const failProgressSnapshot = (
	previous: IndexProgressSnapshot,
	message: string,
	now: Date,
): IndexProgressSnapshot => {
	const completedAt = toIsoTimestamp(now);
	return {
		...previous,
		status: "error",
		updatedAt: completedAt,
		completedAt,
		errorMessage: message,
	};
};

const fingerprintMap = (sources: readonly IndexSourceFingerprint[]): ReadonlyMap<string, IndexSourceFingerprint> =>
	new Map(sources.map((source) => [source.path, source]));

export const evaluateIndexFreshness = (
	indexId: string,
	indexedSources: readonly IndexSourceFingerprint[],
	currentSources: readonly IndexSourceFingerprint[],
	checkedAt: Date,
): IndexFreshnessSnapshot => {
	const sortedIndexed = sortSourceFingerprints(indexedSources);
	const sortedCurrent = sortSourceFingerprints(currentSources);
	const indexedByPath = fingerprintMap(sortedIndexed);
	const currentByPath = fingerprintMap(sortedCurrent);

	const missingSourcePaths = sortedCurrent
		.filter((source) => !indexedByPath.has(source.path))
		.map((source) => source.path);
	const extraSourcePaths = sortedIndexed
		.filter((source) => !currentByPath.has(source.path))
		.map((source) => source.path);
	const staleSourcePaths = sortedCurrent
		.filter((source) => indexedByPath.get(source.path)?.contentFingerprint !== source.contentFingerprint)
		.filter((source) => indexedByPath.has(source.path))
		.map((source) => source.path);

	const state =
		sortedIndexed.length === 0
			? "missing"
			: missingSourcePaths.length > 0 || extraSourcePaths.length > 0
				? "partial"
				: staleSourcePaths.length > 0
					? "stale"
					: "fresh";

	return {
		indexId,
		state,
		checkedAt: toIsoTimestamp(checkedAt),
		indexedSources: sortedIndexed,
		currentSources: sortedCurrent,
		staleSourcePaths,
		missingSourcePaths,
		extraSourcePaths,
	};
};

export const resetLexicalIndexForBuild = (
	indexId: string,
	sources: readonly IndexSourceFingerprint[] = [],
): LexicalIndexSnapshot => ({
	indexId,
	status: "building",
	sources: sortSourceFingerprints(sources),
	chunks: [],
});

export const isIndexUsableForSearch = (status: IndexJobStatus): boolean => {
	switch (status) {
		case "ready":
			return true;
		case "idle":
		case "building":
		case "stale":
		case "error":
		case "canceled":
			return false;
		default:
			return assertNeverRetrievalValue(status);
	}
};

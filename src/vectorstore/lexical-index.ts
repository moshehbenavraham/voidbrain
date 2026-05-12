import type {
	LexicalIndexChunkRecord,
	LexicalIndexSnapshot,
	LexicalSearchHit,
	ParsedMarkdownNote,
	RetrievalFailure,
	RetrievalQuery,
} from "../types/retrieval";
import { type NormalizedVaultPath, makeIsoTimestamp } from "../types/vault";
import { compareVaultPaths, normalizeVaultPath } from "../utils/vault-paths";
import { fingerprintsFromParsedNotes } from "./index-state";
import { headingLevelWeight } from "./markdown-parser";

export const DEFAULT_LEXICAL_SEARCH_LIMIT = 10;
export const MAX_LEXICAL_SEARCH_LIMIT = 50;

export interface LexicalIndexBuildInput {
	readonly indexId: string;
	readonly notes: readonly ParsedMarkdownNote[];
	readonly builtAt: Date;
	readonly signal?: AbortSignal;
}

export interface LexicalIndexBuildSuccess {
	readonly ok: true;
	readonly index: LexicalIndexSnapshot;
}

export interface LexicalIndexBuildCanceled {
	readonly ok: false;
	readonly status: "canceled";
	readonly message: string;
}

export type LexicalIndexBuildResult = LexicalIndexBuildSuccess | LexicalIndexBuildCanceled;

export interface LexicalSearchSuccess {
	readonly ok: true;
	readonly query: RetrievalQuery;
	readonly hits: readonly LexicalSearchHit[];
}

export type LexicalSearchResult = LexicalSearchSuccess | RetrievalFailure;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const retrievalFailure = (code: RetrievalFailure["code"], message: string, field?: string): RetrievalFailure => ({
	ok: false,
	code,
	message,
	...(field === undefined ? {} : { field }),
});

const isRetrievalFailure = (
	value: RetrievalQuery | RetrievalFailure | readonly NormalizedVaultPath[],
): value is RetrievalFailure => isRecord(value) && "ok" in value && value.ok === false;

export const tokenizeLexicalText = (text: string): readonly string[] => {
	const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [];
	return matches
		.map((token) => token.replaceAll(/^-|-$/g, ""))
		.filter((token) => token.length >= 2)
		.slice(0, 2_000);
};

const countTokens = (tokens: readonly string[]): readonly LexicalIndexChunkRecord["tokens"][number][] => {
	const counts = new Map<string, number>();
	for (const token of tokens) {
		counts.set(token, (counts.get(token) ?? 0) + 1);
	}

	return [...counts.entries()]
		.map(([token, count]) => ({ token, count }))
		.sort((left, right) => left.token.localeCompare(right.token, "en", { sensitivity: "base" }));
};

const compareChunkRecords = (left: LexicalIndexChunkRecord, right: LexicalIndexChunkRecord): number => {
	const pathComparison = compareVaultPaths(left.chunk.path, right.chunk.path);
	if (pathComparison !== 0) {
		return pathComparison;
	}

	const headingComparison = (left.chunk.heading ?? "").localeCompare(right.chunk.heading ?? "", "en", {
		sensitivity: "base",
	});
	if (headingComparison !== 0) {
		return headingComparison;
	}

	return left.chunk.id.localeCompare(right.chunk.id, "en", { sensitivity: "base" });
};

const isAborted = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

export const buildLexicalIndex = (input: LexicalIndexBuildInput): LexicalIndexBuildResult => {
	if (isAborted(input.signal)) {
		return {
			ok: false,
			status: "canceled",
			message: "Lexical index build was canceled before it started.",
		};
	}

	const chunks: LexicalIndexChunkRecord[] = [];
	for (const note of input.notes) {
		if (isAborted(input.signal)) {
			return {
				ok: false,
				status: "canceled",
				message: `Lexical index build was canceled before indexing ${note.path}.`,
			};
		}

		for (const chunk of note.chunks) {
			if (isAborted(input.signal)) {
				return {
					ok: false,
					status: "canceled",
					message: `Lexical index build was canceled while indexing ${chunk.id}.`,
				};
			}

			const tokens = tokenizeLexicalText(chunk.text);
			chunks.push({
				chunk,
				tokens: countTokens(tokens),
				totalTokenCount: tokens.length,
			});
		}
	}

	return {
		ok: true,
		index: {
			indexId: input.indexId,
			status: "ready",
			builtAt: makeIsoTimestamp(input.builtAt.toISOString()),
			sources: fingerprintsFromParsedNotes(input.notes),
			chunks: chunks.sort(compareChunkRecords),
		},
	};
};

const parsePathsFilter = (value: unknown): readonly NormalizedVaultPath[] | RetrievalFailure => {
	if (value === undefined) {
		return [];
	}
	if (!Array.isArray(value)) {
		return retrievalFailure("retrieval.unsupported-filter", "paths filter must be an array.", "filters.paths");
	}

	const paths: NormalizedVaultPath[] = [];
	for (const [index, path] of value.entries()) {
		const normalized = normalizeVaultPath(path);
		if (!normalized.ok) {
			return retrievalFailure(
				"retrieval.unsupported-filter",
				`filters.paths[${index}] must be a vault-relative path.`,
				`filters.paths[${index}]`,
			);
		}
		paths.push(normalized.value);
	}

	return paths.sort(compareVaultPaths);
};

export const parseLexicalQuery = (input: unknown): RetrievalQuery | RetrievalFailure => {
	if (!isRecord(input)) {
		return retrievalFailure("retrieval.invalid-query", "Lexical query must be an object.", "root");
	}

	const query = input.query;
	if (typeof query !== "string" || query.trim().length === 0) {
		return retrievalFailure("retrieval.invalid-query", "query must be a non-empty string.", "query");
	}

	const rawLimit = input.limit ?? DEFAULT_LEXICAL_SEARCH_LIMIT;
	if (
		!Number.isInteger(rawLimit) ||
		typeof rawLimit !== "number" ||
		rawLimit < 1 ||
		rawLimit > MAX_LEXICAL_SEARCH_LIMIT
	) {
		return retrievalFailure(
			"retrieval.invalid-limit",
			`limit must be an integer from 1 to ${MAX_LEXICAL_SEARCH_LIMIT}.`,
			"limit",
		);
	}

	const rawOffset = input.offset ?? 0;
	if (!Number.isInteger(rawOffset) || typeof rawOffset !== "number" || rawOffset < 0) {
		return retrievalFailure("retrieval.invalid-limit", "offset must be a non-negative integer.", "offset");
	}

	const filters = input.filters;
	if (filters !== undefined && !isRecord(filters)) {
		return retrievalFailure("retrieval.unsupported-filter", "filters must be an object when present.", "filters");
	}

	if (isRecord(filters) && filters.tags !== undefined) {
		return retrievalFailure(
			"retrieval.unsupported-filter",
			"Tag filters are not supported by the lexical baseline.",
			"filters.tags",
		);
	}

	const paths = parsePathsFilter(isRecord(filters) ? filters.paths : undefined);
	if (isRetrievalFailure(paths)) {
		return paths;
	}

	return {
		query: query.trim(),
		limit: rawLimit,
		...(rawOffset === 0 ? {} : { offset: rawOffset }),
		...(paths.length === 0 ? {} : { filters: { paths } }),
	};
};

const tokenCountMap = (record: LexicalIndexChunkRecord): ReadonlyMap<string, number> =>
	new Map(record.tokens.map((token) => [token.token, token.count]));

const pathFilterAllows = (query: RetrievalQuery, path: NormalizedVaultPath): boolean => {
	const paths = query.filters?.paths;
	if (paths === undefined || paths.length === 0) {
		return true;
	}

	return paths.includes(path);
};

const scoreChunk = (record: LexicalIndexChunkRecord, queryTokens: readonly string[]): LexicalSearchHit | undefined => {
	const counts = tokenCountMap(record);
	const matchedTokens = queryTokens.filter((token) => counts.has(token));
	if (matchedTokens.length === 0) {
		return undefined;
	}

	const termScore = matchedTokens.reduce((score, token) => score + (counts.get(token) ?? 0), 0);
	const headingTokens = tokenizeLexicalText(record.chunk.heading ?? "");
	const headingMatches = matchedTokens.filter((token) => headingTokens.includes(token)).length;
	const headingBoost =
		record.chunk.headingLevel === undefined
			? 0
			: headingMatches * (headingLevelWeight(record.chunk.headingLevel) / 10);
	const lengthPenalty = record.totalTokenCount === 0 ? 1 : Math.min(1, 30 / record.totalTokenCount);

	return {
		chunk: record.chunk,
		score: Number((termScore + headingBoost + lengthPenalty).toFixed(6)),
		matchedTokens,
	};
};

const compareHits = (left: LexicalSearchHit, right: LexicalSearchHit): number => {
	const scoreComparison = right.score - left.score;
	if (scoreComparison !== 0) {
		return scoreComparison;
	}

	const pathComparison = compareVaultPaths(left.chunk.path, right.chunk.path);
	if (pathComparison !== 0) {
		return pathComparison;
	}

	const headingComparison = (left.chunk.heading ?? "").localeCompare(right.chunk.heading ?? "", "en", {
		sensitivity: "base",
	});
	if (headingComparison !== 0) {
		return headingComparison;
	}

	return left.chunk.id.localeCompare(right.chunk.id, "en", { sensitivity: "base" });
};

export const searchLexicalIndex = (index: LexicalIndexSnapshot, queryInput: unknown): LexicalSearchResult => {
	if (index.status !== "ready") {
		return retrievalFailure("retrieval.index-not-ready", `Lexical index ${index.indexId} is not ready.`);
	}

	const query = parseLexicalQuery(queryInput);
	if (isRetrievalFailure(query)) {
		return query;
	}

	const queryTokens = [...new Set(tokenizeLexicalText(query.query))].sort((left, right) =>
		left.localeCompare(right, "en", { sensitivity: "base" }),
	);
	if (queryTokens.length === 0) {
		return retrievalFailure(
			"retrieval.invalid-query",
			"query must include at least one searchable token.",
			"query",
		);
	}

	const offset = query.offset ?? 0;
	const hits = index.chunks
		.filter((record) => pathFilterAllows(query, record.chunk.path))
		.flatMap((record) => {
			const hit = scoreChunk(record, queryTokens);
			return hit === undefined ? [] : [hit];
		})
		.sort(compareHits)
		.slice(offset, offset + query.limit);

	return {
		ok: true,
		query,
		hits,
	};
};

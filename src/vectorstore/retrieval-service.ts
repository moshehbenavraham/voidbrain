import {
	type LexicalIndexSnapshot,
	type LexicalSearchHit,
	type RetrievalFailure,
	type RetrievalQuery,
	type RetrievalResult,
	type RetrievalScoreMethod,
	type RetrievalSearchResult,
	type SemanticIndexCompatibility,
	type SemanticLexicalFallbackDecision,
	assertNeverRetrievalValue,
} from "../types/retrieval";
import { type LexicalSearchResult, searchLexicalIndex } from "./lexical-index";
import { createSnippet } from "./markdown-parser";

export interface RetrievalCompositionOptions {
	readonly maxSnippetCharacters?: number;
}

export interface LexicalFallbackSelectionOptions extends RetrievalCompositionOptions {
	readonly maxResults?: number;
}

export interface LexicalFallbackRetrievalSuccess {
	readonly ok: true;
	readonly query: RetrievalQuery;
	readonly results: readonly RetrievalResult[];
	readonly fallback: SemanticLexicalFallbackDecision;
}

export interface LexicalFallbackRetrievalFailure extends RetrievalFailure {
	readonly fallback: SemanticLexicalFallbackDecision;
}

export type LexicalFallbackRetrievalResult = LexicalFallbackRetrievalSuccess | LexicalFallbackRetrievalFailure;

const normalizedScoreForMethod = (method: RetrievalScoreMethod, score: number): number => {
	switch (method) {
		case "lexical":
			return Math.min(1, score / 10);
		case "semantic":
			return Math.min(1, Math.max(0, score));
		default:
			return assertNeverRetrievalValue(method);
	}
};

export const composeLexicalRetrievalResult = (
	hit: LexicalSearchHit,
	options: RetrievalCompositionOptions = {},
): RetrievalResult => ({
	id: `${hit.chunk.id}:lexical`,
	path: hit.chunk.path,
	...(hit.chunk.heading === undefined ? {} : { heading: hit.chunk.heading }),
	...(hit.chunk.headingLevel === undefined ? {} : { headingLevel: hit.chunk.headingLevel }),
	snippet: createSnippet(hit.chunk.text, hit.matchedTokens, options.maxSnippetCharacters),
	score: hit.score,
	scoreDetails: {
		method: "lexical",
		score: hit.score,
		normalizedScore: normalizedScoreForMethod("lexical", hit.score),
		matchedTokens: hit.matchedTokens,
	},
	chunkId: hit.chunk.id,
	sourcePaths: hit.chunk.sourcePaths,
});

export const composeLexicalRetrievalResults = (
	searchResult: LexicalSearchResult,
	options: RetrievalCompositionOptions = {},
): RetrievalSearchResult => {
	if (!searchResult.ok) {
		return searchResult;
	}

	return {
		ok: true,
		query: searchResult.query,
		results: searchResult.hits.map((hit) => composeLexicalRetrievalResult(hit, options)),
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const clampFallbackLimit = (value: unknown, maxResults: number): unknown => {
	if (!Number.isInteger(value) || typeof value !== "number") {
		return value;
	}

	return Math.max(1, Math.min(value, maxResults));
};

const boundFallbackQuery = (queryInput: unknown, maxResults: number): unknown => {
	if (!isRecord(queryInput)) {
		return queryInput;
	}

	return {
		...queryInput,
		limit: clampFallbackLimit(queryInput.limit, maxResults),
	};
};

const createFallbackDecision = (
	compatibility: SemanticIndexCompatibility,
	resultLimit: number,
): SemanticLexicalFallbackDecision => ({
	mode: compatibility.fallbackMode,
	semanticCompatibilityCode: compatibility.code,
	semanticSearchEligible: compatibility.semanticSearchEligible,
	resultLimit,
	message: compatibility.message,
	validationOutput: [`semantic compatibility: ${compatibility.code}`, `fallback mode: ${compatibility.fallbackMode}`],
	guidance: compatibility.guidance,
});

export const selectLexicalFallbackRetrieval = (input: {
	readonly lexicalIndex: LexicalIndexSnapshot | null;
	readonly queryInput: unknown;
	readonly semanticCompatibility: SemanticIndexCompatibility;
	readonly options?: LexicalFallbackSelectionOptions;
}): LexicalFallbackRetrievalResult => {
	const maxResults = Math.max(1, Math.min(input.options?.maxResults ?? 10, 50));
	const fallback = createFallbackDecision(input.semanticCompatibility, maxResults);
	if (input.semanticCompatibility.fallbackMode === "unavailable") {
		return {
			ok: false,
			code: "retrieval.index-not-ready",
			message: "Lexical fallback is unavailable because the lexical index is not ready.",
			fallback,
		};
	}

	if (input.lexicalIndex === null) {
		return {
			ok: false,
			code: "retrieval.index-not-ready",
			message: "Lexical fallback is unavailable because the lexical index is missing.",
			fallback,
		};
	}

	const boundedQuery = boundFallbackQuery(input.queryInput, maxResults);
	const search = searchLexicalIndex(input.lexicalIndex, boundedQuery);
	const retrieval = composeLexicalRetrievalResults(search, input.options);
	if (!retrieval.ok) {
		return {
			...retrieval,
			fallback,
		};
	}

	return {
		...retrieval,
		fallback: createFallbackDecision(input.semanticCompatibility, retrieval.query.limit),
	};
};

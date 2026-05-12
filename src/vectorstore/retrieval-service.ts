import {
	type LexicalSearchHit,
	type RetrievalResult,
	type RetrievalScoreMethod,
	type RetrievalSearchResult,
	assertNeverRetrievalValue,
} from "../types/retrieval";
import type { LexicalSearchResult } from "./lexical-index";
import { createSnippet } from "./markdown-parser";

export interface RetrievalCompositionOptions {
	readonly maxSnippetCharacters?: number;
}

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

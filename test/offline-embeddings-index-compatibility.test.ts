import { describe, expect, it } from "vitest";
import { evaluateSemanticIndexCompatibility } from "../src/vectorstore";
import {
	SEMANTIC_COMPATIBILITY_ALTERNATE_FAMILY,
	SEMANTIC_COMPATIBILITY_DIMENSIONS,
	SEMANTIC_COMPATIBILITY_FAMILY,
	SEMANTIC_COMPATIBILITY_FIXED_DATE,
	SEMANTIC_COMPATIBILITY_FIXTURE_MESSAGE,
	canceledSemanticReadinessFixture,
	partialSemanticCompatibilitySources,
	providerBlockedSemanticReadinessFixture,
	semanticCompatibilitySnapshot,
	semanticCompatibilitySources,
	semanticReadinessFixture,
	staleSemanticCompatibilitySources,
} from "./fixtures/vault/semantic-index-compatibility-fixtures";

const readyReadiness = () =>
	semanticReadinessFixture({
		embeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
		dimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
	});

describe("offline embedding semantic index compatibility", () => {
	it("allows semantic search only when provider, dimensions, vectors, and sources match", () => {
		const compatibility = evaluateSemanticIndexCompatibility({
			semanticReadiness: readyReadiness(),
			semanticSnapshot: semanticCompatibilitySnapshot(),
			currentSources: semanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		});

		expect(compatibility).toMatchObject({
			state: "ready",
			code: "compatible",
			semanticSearchEligible: true,
			fallbackMode: "semantic",
			sourcePathCounts: {
				indexed: 2,
				current: 2,
			},
			guidance: {
				action: "none",
			},
		});
	});

	it("falls back to lexical retrieval when a semantic snapshot is missing", () => {
		const compatibility = evaluateSemanticIndexCompatibility({
			semanticReadiness: readyReadiness(),
			semanticSnapshot: null,
			currentSources: semanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		});

		expect(compatibility).toMatchObject({
			state: "missing",
			code: "missing-index",
			semanticSearchEligible: false,
			fallbackMode: "lexical",
			guidance: {
				action: "rebuild-semantic-index",
				sourcePathCount: 2,
			},
		});
	});

	it("detects family switches, dimension mismatches, and stale source fingerprints", () => {
		expect(
			evaluateSemanticIndexCompatibility({
				semanticReadiness: readyReadiness(),
				semanticSnapshot: semanticCompatibilitySnapshot({
					config: {
						...semanticCompatibilitySnapshot().config,
						embeddingModelFamily: SEMANTIC_COMPATIBILITY_ALTERNATE_FAMILY,
					},
				}),
				currentSources: semanticCompatibilitySources(),
				lexicalReadinessState: "ready",
				checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
				activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
				activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
			}),
		).toMatchObject({
			state: "incompatible",
			code: "family-mismatch",
			fallbackMode: "lexical",
		});

		expect(
			evaluateSemanticIndexCompatibility({
				semanticReadiness: readyReadiness(),
				semanticSnapshot: semanticCompatibilitySnapshot(),
				currentSources: semanticCompatibilitySources(),
				lexicalReadinessState: "ready",
				checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
				activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
				activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS + 1,
			}),
		).toMatchObject({
			state: "incompatible",
			code: "dimension-mismatch",
			guidance: {
				action: "rebuild-semantic-index",
			},
		});

		const stale = evaluateSemanticIndexCompatibility({
			semanticReadiness: readyReadiness(),
			semanticSnapshot: semanticCompatibilitySnapshot(),
			currentSources: staleSemanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		});
		expect(stale).toMatchObject({
			state: "stale",
			code: "stale-source-fingerprints",
			sourcePathCounts: {
				stale: 1,
			},
		});
	});

	it("reports provider-blocked and canceled states with bounded recovery metadata", () => {
		const blocked = evaluateSemanticIndexCompatibility({
			semanticReadiness: providerBlockedSemanticReadinessFixture(),
			semanticSnapshot: semanticCompatibilitySnapshot(),
			currentSources: partialSemanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		});
		expect(blocked).toMatchObject({
			state: "provider-blocked",
			code: "provider-blocked",
			fallbackMode: "lexical",
			recovery: {
				sourcePathCount: 3,
				fallbackMode: "lexical",
			},
		});

		const canceled = evaluateSemanticIndexCompatibility({
			semanticReadiness: canceledSemanticReadinessFixture(),
			semanticSnapshot: semanticCompatibilitySnapshot({ status: "canceled" }),
			currentSources: semanticCompatibilitySources(),
			lexicalReadinessState: "ready",
			checkedAt: SEMANTIC_COMPATIBILITY_FIXED_DATE,
			activeEmbeddingModelFamily: SEMANTIC_COMPATIBILITY_FAMILY,
			activeDimensions: SEMANTIC_COMPATIBILITY_DIMENSIONS,
		});
		expect(canceled).toMatchObject({
			state: "canceled",
			code: "provider-canceled",
			guidance: {
				action: "review-provider-setup",
			},
		});

		const serialized = JSON.stringify([blocked, canceled]);
		expect(serialized).not.toContain("prompt");
		expect(serialized).not.toContain("authorization");
		expect(SEMANTIC_COMPATIBILITY_FIXTURE_MESSAGE).not.toContain("sk-");
	});
});

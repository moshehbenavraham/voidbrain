import { describe, expect, it } from "vitest";
import {
	BASELINE_PROVIDERS,
	LOCAL_FIXTURE_PROVIDER_ID,
	TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
	makeProviderModelId,
} from "../src/providers";
import type { ProviderPrivacyPolicy } from "../src/types/providers";
import type { MarkdownParseResult, ParsedMarkdownNote } from "../src/types/retrieval";
import {
	FixtureIndexingService,
	buildLexicalIndex,
	checkSemanticCompatibility,
	composeLexicalRetrievalResults,
	createSemanticIndexAdapter,
	evaluateIndexFreshness,
	makeEmbeddingModelFamily,
	parseMarkdownNote,
	resetLexicalIndexForBuild,
	searchLexicalIndex,
} from "../src/vectorstore";
import {
	INDEXING_FIXTURE_NOTE_MESSAGE,
	INDEXING_KNOWN_PATHS,
	INDEXING_PARSE_OPTIONS,
	loadIndexingFixtureNotes,
} from "./fixtures/vault/indexing-fixtures";

const localFirstPolicy: ProviderPrivacyPolicy = {
	areCloudProvidersEnabled: false,
	trustedProviderIds: [],
};

const expectParsed = (result: MarkdownParseResult): ParsedMarkdownNote => {
	if (!result.ok) {
		throw new Error(`Expected parse success, got ${JSON.stringify(result.errors)}`);
	}

	return result.value;
};

const fixtureContent = (path: string): string => {
	const fixture = loadIndexingFixtureNotes().find((note) => note.path === path);
	if (fixture === undefined) {
		throw new Error(`Missing fixture ${path}`);
	}

	return fixture.content;
};

const parseFixtureNotes = (): readonly ParsedMarkdownNote[] =>
	loadIndexingFixtureNotes().map((note) =>
		expectParsed(parseMarkdownNote(note.path, note.content, INDEXING_PARSE_OPTIONS)),
	);

const firstKnownPath = () => {
	const path = INDEXING_KNOWN_PATHS[0];
	if (path === undefined) {
		throw new Error("Expected at least one indexing fixture path");
	}

	return path;
};

describe("indexing markdown parser", () => {
	it("extracts frontmatter, headings, wikilinks, tags, and traceable chunks", () => {
		const note = expectParsed(
			parseMarkdownNote(
				"sources/demo-article.md",
				fixtureContent("sources/demo-article.md"),
				INDEXING_PARSE_OPTIONS,
			),
		);

		expect(note.frontmatter.title).toBe("Demo Article About Local Vaults");
		expect(note.headings.map((heading) => heading.text)).toEqual(["Demo Article About Local Vaults", "Key Points"]);
		expect(note.wikilinks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					target: "demo-researcher",
					targetPath: "entities/demo-researcher.md",
					status: "resolved",
				}),
			]),
		);
		expect(note.tags.map((tag) => tag.value)).toEqual(expect.arrayContaining(["fixture", "local-first", "source"]));
		expect(note.chunks[0]).toMatchObject({
			path: "sources/demo-article.md",
			heading: "Demo Article About Local Vaults",
			sourcePaths: ["sources/demo-article.md"],
		});
	});

	it("preserves missing wikilinks as traceable parser output", () => {
		const note = expectParsed(
			parseMarkdownNote(
				"sources/demo-article.md",
				`${fixtureContent("sources/demo-article.md")}\n\nRelated missing note: [[missing-note]].`,
				INDEXING_PARSE_OPTIONS,
			),
		);

		expect(note.wikilinks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					target: "missing-note",
					status: "missing",
					line: expect.any(Number),
				}),
			]),
		);
	});
});

describe("lexical indexing and retrieval", () => {
	it("builds a deterministic lexical index and returns traceable snippets", () => {
		const parsedNotes = parseFixtureNotes();
		const built = buildLexicalIndex({
			indexId: "lexical-fixture",
			notes: parsedNotes,
			builtAt: new Date("2026-05-12T00:00:00.000Z"),
		});

		expect(built).toMatchObject({ ok: true });
		if (!built.ok) {
			throw new Error(built.message);
		}

		const search = searchLexicalIndex(built.index, {
			query: "local vault support files",
			limit: 3,
		});
		const retrieval = composeLexicalRetrievalResults(search);

		expect(retrieval).toMatchObject({ ok: true });
		if (!retrieval.ok) {
			throw new Error(retrieval.message);
		}

		expect(retrieval.results).toHaveLength(3);
		expect(retrieval.results[0]).toMatchObject({
			path: expect.any(String),
			snippet: expect.stringContaining("Local"),
			scoreDetails: { method: "lexical" },
			sourcePaths: expect.any(Array),
		});
		expect(retrieval.results.map((result) => result.score)).toEqual(
			[...retrieval.results.map((result) => result.score)].sort((left, right) => right - left),
		);
	});

	it("rejects invalid limits and non-ready indexes explicitly", () => {
		const parsedNotes = parseFixtureNotes();
		const built = buildLexicalIndex({
			indexId: "lexical-fixture",
			notes: parsedNotes,
			builtAt: new Date("2026-05-12T00:00:00.000Z"),
		});
		if (!built.ok) {
			throw new Error(built.message);
		}

		expect(searchLexicalIndex(built.index, { query: "vault", limit: 100 })).toMatchObject({
			ok: false,
			code: "retrieval.invalid-limit",
		});

		expect(searchLexicalIndex({ ...built.index, status: "stale" }, { query: "vault", limit: 3 })).toMatchObject({
			ok: false,
			code: "retrieval.index-not-ready",
		});
	});
});

describe("index freshness, progress, cancellation, and resume behavior", () => {
	it("reports fresh, stale, partial, and reset states deterministically", () => {
		const parsedNotes = parseFixtureNotes();
		const sources = parsedNotes.map((note) => ({
			path: note.path,
			contentFingerprint: note.contentFingerprint,
		}));
		const firstSource = sources[0];
		if (firstSource === undefined) {
			throw new Error("Expected at least one source fingerprint");
		}

		expect(
			evaluateIndexFreshness("lexical-fixture", sources, sources, new Date("2026-05-12T00:00:00.000Z")),
		).toMatchObject({
			state: "fresh",
			staleSourcePaths: [],
		});

		expect(
			evaluateIndexFreshness(
				"lexical-fixture",
				sources,
				[{ ...firstSource, contentFingerprint: "changed" }, ...sources.slice(1)],
				new Date("2026-05-12T00:00:00.000Z"),
			),
		).toMatchObject({
			state: "stale",
			staleSourcePaths: [firstSource.path],
		});

		expect(
			evaluateIndexFreshness(
				"lexical-fixture",
				sources.slice(0, 1),
				sources,
				new Date("2026-05-12T00:00:00.000Z"),
			),
		).toMatchObject({
			state: "partial",
		});

		expect(resetLexicalIndexForBuild("lexical-fixture", sources)).toMatchObject({
			status: "building",
			chunks: [],
		});
	});

	it("reports progress, cancellation, and duplicate in-flight builds", async () => {
		const progressStatuses: string[] = [];
		const service = new FixtureIndexingService({
			parseOptions: INDEXING_PARSE_OPTIONS,
		});
		const abortController = new AbortController();
		abortController.abort();

		await expect(
			service.buildLexicalIndexJob({
				jobId: "job-canceled",
				indexId: "lexical-canceled",
				notes: loadIndexingFixtureNotes(),
				signal: abortController.signal,
				now: () => new Date("2026-05-12T00:00:00.000Z"),
				onProgress: (snapshot) => progressStatuses.push(snapshot.status),
			}),
		).resolves.toMatchObject({
			ok: false,
			status: "canceled",
		});
		expect(progressStatuses).toContain("canceled");

		let releaseFirstBuild: (() => void) | undefined;
		let shouldBlockFirstNote = true;
		const duplicateService = new FixtureIndexingService({
			parseOptions: INDEXING_PARSE_OPTIONS,
			hooks: {
				beforeNote: () => {
					if (!shouldBlockFirstNote) {
						return undefined;
					}

					shouldBlockFirstNote = false;
					return new Promise<void>((resolve) => {
						releaseFirstBuild = resolve;
					});
				},
			},
		});
		const firstBuild = duplicateService.buildLexicalIndexJob({
			jobId: "job-first",
			indexId: "lexical-duplicate",
			notes: loadIndexingFixtureNotes(),
			now: () => new Date("2026-05-12T00:00:00.000Z"),
		});
		await Promise.resolve();

		await expect(
			duplicateService.buildLexicalIndexJob({
				jobId: "job-second",
				indexId: "lexical-duplicate",
				notes: loadIndexingFixtureNotes(),
				now: () => new Date("2026-05-12T00:00:00.000Z"),
			}),
		).resolves.toMatchObject({
			ok: false,
			status: "error",
			message: expect.stringContaining("in flight"),
		});

		releaseFirstBuild?.();
		await expect(firstBuild).resolves.toMatchObject({ ok: true, status: "ready" });
	});
});

describe("semantic index compatibility and provider preflight", () => {
	it("checks embedding family compatibility and denial paths", () => {
		const family = makeEmbeddingModelFamily("local-fixture-embeddings");

		expect(
			checkSemanticCompatibility({
				expectedFamily: family,
				actualFamily: family,
				expectedDimensions: 3,
				actualDimensions: 3,
			}),
		).toMatchObject({ ok: true, code: "compatible" });

		expect(
			checkSemanticCompatibility({
				expectedFamily: family,
				actualFamily: "other-family",
				expectedDimensions: 3,
				actualDimensions: 3,
			}),
		).toMatchObject({ ok: false, code: "family-mismatch" });
	});

	it("requires embeddings capability and disclosure preflight before semantic preparation", () => {
		const adapter = createSemanticIndexAdapter({
			indexId: "semantic-fixture",
			embeddingModelFamily: makeEmbeddingModelFamily("local-fixture-embeddings"),
			dimensions: 3,
			distanceMetric: "cosine",
		});

		expect(
			adapter.prepareEmbedding(BASELINE_PROVIDERS, localFirstPolicy, {
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				contentSensitivity: "private-vault",
				sourcePaths: [firstKnownPath()],
				workflowId: "test-semantic-index",
				userFacingPurpose: "Build synthetic semantic index fixture.",
			}),
		).toMatchObject({ ok: true });

		expect(
			adapter.prepareEmbedding(BASELINE_PROVIDERS, localFirstPolicy, {
				providerId: TRUSTED_CLOUD_FIXTURE_PROVIDER_ID,
				contentSensitivity: "private-vault",
				sourcePaths: [firstKnownPath()],
				workflowId: "test-semantic-index",
				userFacingPurpose: "Build synthetic semantic index fixture.",
			}),
		).toMatchObject({
			ok: false,
			preflight: { preflight: { allowed: false, code: "cloud-disabled" } },
		});

		expect(
			adapter.prepareEmbedding(BASELINE_PROVIDERS, localFirstPolicy, {
				providerId: LOCAL_FIXTURE_PROVIDER_ID,
				preferredModelId: makeProviderModelId("local-chat-fixture"),
				contentSensitivity: "private-vault",
				sourcePaths: [firstKnownPath()],
				workflowId: "test-semantic-index",
				userFacingPurpose: "Build synthetic semantic index fixture.",
			}),
		).toMatchObject({
			ok: false,
			preflight: { preflight: { allowed: false, code: "capability-unsupported" } },
		});

		expect(INDEXING_FIXTURE_NOTE_MESSAGE).not.toContain("sk-");
	});
});

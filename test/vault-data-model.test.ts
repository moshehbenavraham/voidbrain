import { describe, expect, it } from "vitest";
import type { ValidationResult } from "../src/types/vault";
import { normalizeVaultPath, validateArtifactPath } from "../src/utils/vault-paths";
import {
	validateJsonArtifactFixture,
	validateMarkdownArtifactFixture,
	validateSourceManifest,
} from "../src/utils/vault-validation";
import sourceManifestFixture from "./fixtures/vault/.voidbrain/manifests/sources.json";
import runtimeStateFixture from "./fixtures/vault/.voidbrain/runtime-state.json";
import conceptNote from "./fixtures/vault/concepts/local-first-vaults.md?raw";
import conversationNote from "./fixtures/vault/conversations/2026-05-12-demo-chat.md?raw";
import entityNote from "./fixtures/vault/entities/demo-researcher.md?raw";
import sourceNote from "./fixtures/vault/sources/demo-article.md?raw";
import summaryNote from "./fixtures/vault/summaries/demo-article-summary.md?raw";

const markdownFixturesByPath: Record<string, string> = {
	"concepts/local-first-vaults.md": conceptNote,
	"conversations/2026-05-12-demo-chat.md": conversationNote,
	"entities/demo-researcher.md": entityNote,
	"sources/demo-article.md": sourceNote,
	"summaries/demo-article-summary.md": summaryNote,
};

const jsonFixturesByPath: Record<string, unknown> = {
	".voidbrain/manifests/sources.json": sourceManifestFixture,
	".voidbrain/runtime-state.json": runtimeStateFixture,
};

const readFixture = (path: string): string => {
	const fixture = markdownFixturesByPath[path];
	if (fixture === undefined) {
		throw new Error(`Missing markdown fixture for ${path}`);
	}

	return fixture;
};

const readJsonFixture = (path: string): unknown => {
	const fixture = jsonFixturesByPath[path];
	if (fixture === undefined) {
		throw new Error(`Missing JSON fixture for ${path}`);
	}

	return JSON.parse(JSON.stringify(fixture)) as unknown;
};

const expectOk = <TValue>(result: ValidationResult<TValue>): TValue => {
	if (!result.ok) {
		throw new Error(`Expected validation success, got ${JSON.stringify(result.errors)}`);
	}

	return result.value;
};

const firstErrorCode = (result: ReturnType<typeof normalizeVaultPath>) => {
	if (result.ok) {
		return "ok";
	}

	return result.errors[0]?.code;
};

describe("vault path contracts", () => {
	it("normalizes vault-relative paths without changing their artifact identity", () => {
		const normalized = normalizeVaultPath("sources//demo-article.md");

		expect(normalized).toMatchObject({
			ok: true,
			value: "sources/demo-article.md",
		});
	});

	it("rejects unsafe paths before runtime I/O can use them", () => {
		const invalidPaths = [
			"",
			"/tmp/demo-article.md",
			"../demo-article.md",
			"sources/../demo-article.md",
			"C:\\vault\\demo-article.md",
			"https://example.invalid/demo-article.md",
		];

		expect(invalidPaths.map((path) => firstErrorCode(normalizeVaultPath(path)))).toEqual([
			"path.empty",
			"path.absolute",
			"path.traversal",
			"path.traversal",
			"path.absolute",
			"path.url",
		]);
	});

	it("rejects generated artifacts outside their allowed locations", () => {
		expect(validateArtifactPath("notes/demo-article.md", "source")).toMatchObject({
			ok: false,
			errors: [{ code: "path.unsupported-location" }],
		});
		expect(validateArtifactPath("sources/demo-article.txt", "source")).toMatchObject({
			ok: false,
			errors: [{ code: "path.invalid-extension" }],
		});
	});

	it("rejects source manifests that are not sorted deterministically by path", () => {
		const result = validateSourceManifest({
			artifactKind: "source-manifest",
			schemaVersion: 1,
			generatedAt: "2026-05-12T00:00:00Z",
			records: [
				{
					id: "source-z",
					path: "sources/z-note.md",
					title: "Z Note",
					sourceType: "article",
					contentSha256: "z",
					createdAt: "2026-05-12T00:00:00Z",
					updatedAt: "2026-05-12T00:00:00Z",
					tags: ["fixture"],
				},
				{
					id: "source-a",
					path: "sources/a-note.md",
					title: "A Note",
					sourceType: "article",
					contentSha256: "a",
					createdAt: "2026-05-12T00:00:00Z",
					updatedAt: "2026-05-12T00:00:00Z",
					tags: ["fixture"],
				},
			],
		});

		expect(result).toMatchObject({
			ok: false,
			errors: [{ code: "record.unsorted" }],
		});
	});
});

describe("vault fixture contracts", () => {
	it("validates generated markdown fixtures with source traceability", () => {
		const fixtures = [
			{ path: "sources/demo-article.md", artifactKind: "source" },
			{ path: "entities/demo-researcher.md", artifactKind: "entity" },
			{ path: "concepts/local-first-vaults.md", artifactKind: "concept" },
			{ path: "summaries/demo-article-summary.md", artifactKind: "summary" },
			{ path: "conversations/2026-05-12-demo-chat.md", artifactKind: "conversation" },
		] as const;

		for (const fixture of fixtures) {
			const note = expectOk(validateMarkdownArtifactFixture(fixture.path, readFixture(fixture.path)));

			expect(note.path).toBe(fixture.path);
			expect(note.frontmatter["artifact-kind"]).toBe(fixture.artifactKind);
			expect(note.body.length).toBeGreaterThan(0);
			if (fixture.artifactKind !== "source") {
				expect(note.frontmatter["source-paths"]).toContain("sources/demo-article.md");
			}
		}
	});

	it("validates source manifest and runtime support JSON fixtures", () => {
		const manifest = expectOk(
			validateJsonArtifactFixture(
				".voidbrain/manifests/sources.json",
				readJsonFixture(".voidbrain/manifests/sources.json"),
			),
		);
		const runtimeState = expectOk(
			validateJsonArtifactFixture(
				".voidbrain/runtime-state.json",
				readJsonFixture(".voidbrain/runtime-state.json"),
			),
		);

		expect("artifactKind" in manifest ? manifest.artifactKind : undefined).toBe("source-manifest");
		expect("stagedChanges" in runtimeState ? runtimeState.stagedChanges : []).toHaveLength(1);
	});

	it("rejects unsupported markdown artifact kinds with explicit errors", () => {
		const markdown = readFixture("sources/demo-article.md").replace(
			"artifact-kind: source",
			"artifact-kind: unknown",
		);

		expect(validateMarkdownArtifactFixture("sources/demo-article.md", markdown)).toMatchObject({
			ok: false,
			errors: [{ code: "metadata.unsupported-artifact-kind" }],
		});
	});

	it("rejects secret-like fields in markdown and support records", () => {
		const markdown = readFixture("entities/demo-researcher.md").replace(
			"title: Demo Researcher",
			"title: Demo Researcher\napiKey: demo-key",
		);
		expect(validateMarkdownArtifactFixture("entities/demo-researcher.md", markdown)).toMatchObject({
			ok: false,
			errors: expect.arrayContaining([expect.objectContaining({ code: "metadata.secret-field" })]),
		});

		const manifest = readJsonFixture(".voidbrain/manifests/sources.json");
		if (
			typeof manifest === "object" &&
			manifest !== null &&
			"records" in manifest &&
			Array.isArray(manifest.records)
		) {
			const firstRecord = manifest.records[0];
			if (typeof firstRecord === "object" && firstRecord !== null) {
				(firstRecord as Record<string, unknown>).token = "demo-token";
			}
		}

		expect(validateJsonArtifactFixture(".voidbrain/manifests/sources.json", manifest)).toMatchObject({
			ok: false,
			errors: expect.arrayContaining([expect.objectContaining({ code: "metadata.secret-field" })]),
		});
	});
});

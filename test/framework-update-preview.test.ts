import { describe, expect, it } from "vitest";
import {
	classifyFrameworkUpdateCandidatePath,
	createFrameworkUpdatePreviewPlanner,
	createPreviewContentHash,
	normalizeFrameworkUpdateCandidatePath,
	planFrameworkUpdatePreview,
} from "../src/agent/framework-update-preview";
import {
	conflictingFrameworkPreviewCandidates,
	currentReadme,
	excludedFrameworkPreviewPaths,
	frameworkPreviewCurrentFiles,
	frameworkPreviewNow,
	pathOnlyPreviewCandidates,
	proposedFrameworkDoc,
	safeFrameworkPreviewCandidates,
	unsafeFrameworkPreviewCandidate,
} from "./fixtures/vault/framework-update-preview-fixtures";

describe("framework update preview planner", () => {
	it("normalizes repository paths and fails closed on unsafe boundaries", () => {
		expect(normalizeFrameworkUpdateCandidatePath("./docs\\agent-surfaces-commands.md")).toBe(
			"docs/agent-surfaces-commands.md",
		);
		expect(normalizeFrameworkUpdateCandidatePath("../outside.md")).toBeUndefined();

		expect(classifyFrameworkUpdateCandidatePath("AGENTS.md")).toMatchObject({
			ok: true,
			path: "AGENTS.md",
		});
		expect(classifyFrameworkUpdateCandidatePath("vault/research-note.md")).toMatchObject({
			ok: false,
			action: "excluded",
			issue: expect.objectContaining({ code: "framework.user-content-target" }),
		});
		expect(classifyFrameworkUpdateCandidatePath("src/agent/runtime-command-handlers.exe")).toMatchObject({
			ok: false,
			action: "conflict",
			issue: expect.objectContaining({ code: "framework.unsupported-path" }),
		});
	});

	it("plans deterministic create, update, and skip actions with hashes", () => {
		const plan = planFrameworkUpdatePreview({
			rootDir: ".",
			candidates: safeFrameworkPreviewCandidates,
			currentFiles: frameworkPreviewCurrentFiles,
			now: frameworkPreviewNow,
		});

		expect(plan).toMatchObject({
			dryRun: true,
			commandId: "voidbrain.preview-framework-update",
			generatedAt: "2026-05-13T00:00:00.000Z",
			issues: [],
		});
		expect(plan.actions.map((action) => [action.path, action.action])).toEqual([
			["AGENTS.md", "update"],
			["docs/framework-update-preview.md", "create"],
			["README.md", "skip"],
		]);
		expect(plan.actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "AGENTS.md",
					currentHash: createPreviewContentHash(frameworkPreviewCurrentFiles[0]?.content ?? ""),
					proposedHash: expect.objectContaining({ algorithm: "sha256" }),
					recovery: expect.objectContaining({
						commandId: "voidbrain.preview-framework-update",
						targetPath: "AGENTS.md",
						action: "update",
					}),
				}),
				expect.objectContaining({
					path: "docs/framework-update-preview.md",
					action: "create",
					proposedHash: createPreviewContentHash(proposedFrameworkDoc),
				}),
				expect.objectContaining({
					path: "README.md",
					action: "skip",
					currentHash: createPreviewContentHash(currentReadme),
					proposedHash: createPreviewContentHash(currentReadme),
				}),
			]),
		);
	});

	it("reports excluded user-content paths and invalid path conflicts", () => {
		const plan = planFrameworkUpdatePreview({
			rootDir: ".",
			candidatePaths: pathOnlyPreviewCandidates,
			currentFiles: frameworkPreviewCurrentFiles,
			now: frameworkPreviewNow,
		});

		expect(plan.actions.map((action) => [action.path, action.action])).toEqual([
			["../outside.md", "conflict"],
			["AGENTS.md", "skip"],
			["test/fixtures/vault/sources/demo-article.md", "excluded"],
		]);
		expect(plan.excludedUserContentPaths).toEqual(["test/fixtures/vault/sources/demo-article.md"]);
		expect(plan.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "framework.invalid-input" }),
				expect.objectContaining({ code: "framework.user-content-target" }),
			]),
		);
	});

	it("reports duplicate candidates, path collisions, and unsupported paths as typed issues", () => {
		const plan = planFrameworkUpdatePreview({
			rootDir: ".",
			candidates: [
				...conflictingFrameworkPreviewCandidates,
				{
					path: "README.md",
					proposedContent: currentReadme,
				},
				{
					path: "./README.md",
					proposedContent: currentReadme,
				},
			],
			currentFiles: frameworkPreviewCurrentFiles,
			now: frameworkPreviewNow,
		});

		expect(plan.actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "AGENTS.md",
					action: "conflict",
					conflict: expect.objectContaining({ kind: "path-collision" }),
				}),
				expect.objectContaining({
					path: "README.md",
					action: "skip",
					recovery: expect.objectContaining({ issueCode: "framework.duplicate-candidate" }),
				}),
				expect.objectContaining({
					path: "src/agent/runtime-command-handlers.exe",
					action: "conflict",
					conflict: expect.objectContaining({ kind: "unsupported-path" }),
				}),
			]),
		);
		expect(plan.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining([
				"framework.path-collision",
				"framework.duplicate-candidate",
				"framework.unsupported-path",
			]),
		);
	});

	it("turns unsafe proposed content into redacted conflict output", () => {
		const plan = planFrameworkUpdatePreview({
			rootDir: ".",
			candidates: [unsafeFrameworkPreviewCandidate()],
			now: frameworkPreviewNow,
		});
		const serialized = JSON.stringify(plan);

		expect(plan.actions).toEqual([
			expect.objectContaining({
				path: "docs/unsafe-framework-update.md",
				action: "conflict",
				conflict: expect.objectContaining({ kind: "unsafe-content" }),
			}),
		]);
		expect(plan.issues.map((issue) => issue.code)).toEqual([
			"framework.unsafe-content",
			"framework.unsafe-content",
			"framework.unsafe-content",
		]);
		expect(serialized).not.toContain("fake-value-for-conflict-tests");
		expect(serialized).not.toContain("sk-fixturecredentialexample");
		expect(serialized).not.toContain("/home/example");
	});

	it("reports read failures and missing comparison input without throwing", () => {
		const plan = planFrameworkUpdatePreview({
			rootDir: ".",
			candidatePaths: ["AGENTS.md", "docs/missing-framework-file.md"],
			currentFileReadFailures: [
				{
					path: "AGENTS.md",
					message: "Permission denied for synthetic read.",
				},
			],
			now: frameworkPreviewNow,
		});

		expect(plan.actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "AGENTS.md",
					action: "conflict",
					conflict: expect.objectContaining({ kind: "current-file-read-failed" }),
				}),
				expect.objectContaining({
					path: "docs/missing-framework-file.md",
					action: "conflict",
					conflict: expect.objectContaining({ kind: "missing-comparison-input" }),
				}),
			]),
		);
		expect(plan.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining(["framework.current-file-read-failed", "framework.invalid-input"]),
		);
	});

	it("injects current-file reads and releases duplicate in-flight protection after completion", async () => {
		let releaseFirstPreview: (() => void) | undefined;
		let beforePlanCount = 0;
		const planner = createFrameworkUpdatePreviewPlanner({
			now: () => frameworkPreviewNow,
			beforePlan: () => {
				beforePlanCount += 1;
				if (beforePlanCount > 1) {
					return undefined;
				}
				return new Promise<void>((resolve) => {
					releaseFirstPreview = resolve;
				});
			},
			readCurrentFile: (path) =>
				path === "README.md"
					? {
							status: "found",
							content: currentReadme,
						}
					: {
							status: "missing",
						},
		});

		const firstPreview = planner.plan({
			rootDir: ".",
			candidatePaths: ["README.md"],
		});
		const duplicatePreview = await planner.plan({
			rootDir: ".",
			candidatePaths: ["AGENTS.md"],
		});

		expect(duplicatePreview.issues).toEqual([
			expect.objectContaining({
				code: "framework.duplicate-preview",
			}),
		]);

		if (releaseFirstPreview === undefined) {
			throw new Error("Expected first preview to be waiting");
		}
		releaseFirstPreview();

		await expect(firstPreview).resolves.toMatchObject({
			dryRun: true,
			actions: [
				expect.objectContaining({
					path: "README.md",
					action: "skip",
					currentHash: createPreviewContentHash(currentReadme),
				}),
			],
		});

		await expect(
			planner.plan({
				rootDir: ".",
				candidates: [
					{
						path: "docs/new-framework-file.md",
						proposedContent: proposedFrameworkDoc,
					},
				],
			}),
		).resolves.toMatchObject({
			actions: [
				expect.objectContaining({
					path: "docs/new-framework-file.md",
					action: "create",
				}),
			],
		});
	});
});

import type {
	AgentValidationIssue,
	FrameworkUpdatePreviewAction,
	FrameworkUpdatePreviewInput,
	FrameworkUpdatePreviewPlan,
} from "../types/agent-commands";

export interface FrameworkUpdatePreviewPlannerOptions {
	readonly now?: () => Date;
	readonly beforePlan?: () => Promise<void> | void;
}

export interface FrameworkUpdatePreviewPlanner {
	plan(input: FrameworkUpdatePreviewInput): Promise<FrameworkUpdatePreviewPlan>;
}

const defaultFrameworkPaths = [
	"AGENTS.md",
	"CLAUDE.md",
	"GEMINI.md",
	"README.md",
	"docs/agent-surfaces-commands.md",
	"skills/voidbrain/SKILL.md",
	"src/agent/index.ts",
	"src/types/agent-commands.ts",
] as const;

const userContentPrefixes = [
	"EXAMPLES/",
	"vault/",
	"test/fixtures/vault/",
	".voidbrain/generated/",
	".voidbrain/staged/",
	"sources/",
	"entities/",
	"concepts/",
	"summaries/",
	"conversations/",
] as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isPreviewInput = (value: unknown): value is FrameworkUpdatePreviewInput =>
	isRecord(value) &&
	typeof value.rootDir === "string" &&
	Array.isArray(value.candidatePaths) &&
	value.candidatePaths.every((path) => typeof path === "string") &&
	(value.now === undefined || value.now instanceof Date);

const toIsoString = (date: Date): string => date.toISOString();

const normalizeCandidatePath = (candidatePath: string): string | undefined => {
	const normalized = candidatePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");

	if (
		normalized.length === 0 ||
		normalized.startsWith("/") ||
		/^[A-Za-z]:\//.test(normalized) ||
		normalized.split("/").includes("..")
	) {
		return undefined;
	}

	return normalized;
};

const isUserContentPath = (path: string): boolean =>
	userContentPrefixes.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix));

const planActionForPath = (path: string): FrameworkUpdatePreviewAction => ({
	path,
	action: "update",
	reason: "Framework-owned path eligible for preview only.",
});

export const planFrameworkUpdatePreview = (input: unknown): FrameworkUpdatePreviewPlan => {
	if (!isPreviewInput(input)) {
		return {
			dryRun: true,
			generatedAt: toIsoString(new Date()),
			actions: [],
			excludedUserContentPaths: [],
			issues: [
				{
					code: "framework.invalid-input",
					message: "Framework update preview expects rootDir and repository-relative candidatePaths.",
					path: "<input>",
				},
			],
		};
	}

	const generatedAt = toIsoString(input.now ?? new Date());
	const actions: FrameworkUpdatePreviewAction[] = [];
	const excludedUserContentPaths: string[] = [];
	const issues: AgentValidationIssue[] = [];
	const candidates = input.candidatePaths.length > 0 ? input.candidatePaths : defaultFrameworkPaths;
	const seen = new Set<string>();

	for (const candidate of candidates) {
		const normalized = normalizeCandidatePath(candidate);

		if (normalized === undefined) {
			issues.push({
				code: "framework.invalid-input",
				message: `Framework update candidate must be repository-relative: ${candidate}`,
				path: candidate,
			});
			continue;
		}

		if (seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);

		if (isUserContentPath(normalized)) {
			excludedUserContentPaths.push(normalized);
			issues.push({
				code: "framework.user-content-target",
				message: `Framework update preview excluded user-content path ${normalized}.`,
				path: normalized,
			});
			continue;
		}

		actions.push(planActionForPath(normalized));
	}

	return {
		dryRun: true,
		generatedAt,
		actions: actions.sort((left, right) => left.path.localeCompare(right.path)),
		excludedUserContentPaths: excludedUserContentPaths.sort((left, right) => left.localeCompare(right)),
		issues: issues.sort((left, right) => (left.path ?? "").localeCompare(right.path ?? "")),
	};
};

class DefaultFrameworkUpdatePreviewPlanner implements FrameworkUpdatePreviewPlanner {
	private isPlanning = false;
	private readonly now: () => Date;
	private readonly beforePlan: () => Promise<void> | void;

	constructor(options: FrameworkUpdatePreviewPlannerOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.beforePlan = options.beforePlan ?? (() => undefined);
	}

	async plan(input: FrameworkUpdatePreviewInput): Promise<FrameworkUpdatePreviewPlan> {
		if (this.isPlanning) {
			return {
				dryRun: true,
				generatedAt: toIsoString(this.now()),
				actions: [],
				excludedUserContentPaths: [],
				issues: [
					{
						code: "framework.duplicate-preview",
						message: "Framework update preview is already in flight.",
					},
				],
			};
		}

		this.isPlanning = true;
		try {
			await this.beforePlan();
			return planFrameworkUpdatePreview({
				...input,
				now: input.now ?? this.now(),
			});
		} finally {
			this.isPlanning = false;
		}
	}
}

export const createFrameworkUpdatePreviewPlanner = (
	options: FrameworkUpdatePreviewPlannerOptions = {},
): FrameworkUpdatePreviewPlanner => new DefaultFrameworkUpdatePreviewPlanner(options);

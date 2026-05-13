import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
	type FrameworkUpdatePreviewCurrentFileReadResult,
	createFrameworkUpdatePreviewPlanner,
} from "../src/agent/framework-update-preview";
import type { FrameworkUpdatePreviewPlan } from "../src/types/agent-commands";

const commandId = "voidbrain.preview-framework-update" as const;

const rootDir = process.cwd();
const candidatePaths = process.argv.slice(2);

const isNodeError = (error: unknown): error is NodeJS.ErrnoException => error instanceof Error;

const isMissingFileError = (error: unknown): boolean =>
	isNodeError(error) && (error.code === "ENOENT" || error.code === "ENOTDIR");

const isInsideRoot = (root: string, target: string): boolean => {
	const relativePath = relative(root, target);
	return relativePath.length === 0 || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const readCurrentFile = async (
	path: string,
	repositoryRoot: string,
): Promise<FrameworkUpdatePreviewCurrentFileReadResult> => {
	const absoluteRoot = resolve(repositoryRoot);
	const absolutePath = resolve(absoluteRoot, path);

	if (!isInsideRoot(absoluteRoot, absolutePath)) {
		return {
			status: "failed",
			message: `Refused to read outside repository root: ${path}`,
		};
	}

	try {
		return {
			status: "found",
			content: await readFile(absolutePath, "utf8"),
		};
	} catch (error) {
		if (isMissingFileError(error)) {
			return {
				status: "missing",
			};
		}

		return {
			status: "failed",
			message: error instanceof Error ? error.message : "Unknown repository read failure.",
		};
	}
};

const validateRepositoryRoot = async (repositoryRoot: string): Promise<FrameworkUpdatePreviewPlan | undefined> => {
	const requiredPaths = ["package.json", ".spec_system/state.json"] as const;

	for (const requiredPath of requiredPaths) {
		try {
			await access(resolve(repositoryRoot, requiredPath), constants.R_OK);
		} catch {
			return {
				dryRun: true,
				commandId,
				generatedAt: new Date().toISOString(),
				actions: [],
				excludedUserContentPaths: [],
				issues: [
					{
						code: "framework.invalid-input",
						commandId,
						path: requiredPath,
						message: `Run preview:framework-update from the repository root; missing ${requiredPath}.`,
						remediation: "Change to the repository root and retry the dry-run preview.",
					},
				],
			};
		}
	}

	return undefined;
};

const rootValidationFailure = await validateRepositoryRoot(rootDir);
const plan =
	rootValidationFailure ??
	(await createFrameworkUpdatePreviewPlanner({
		readCurrentFile,
	}).plan({
		rootDir,
		candidatePaths,
	}));

console.log(JSON.stringify(plan, null, 2));

const hasConflicts = plan.actions.some((action) => action.action === "conflict");
if (plan.issues.length > 0 || hasConflicts) {
	process.exitCode = 1;
}

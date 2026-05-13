import { existsSync, readFileSync } from "node:fs";

export interface RepositoryHealthCheck {
	readonly id: string;
	readonly label: string;
	readonly passed: boolean;
	readonly details: string;
}

export interface RepositoryHealthScriptResult {
	readonly checks: readonly RepositoryHealthCheck[];
}

interface SpecSystemState {
	readonly current_phase?: number;
	readonly current_session?: string | null;
	readonly phases?: Record<string, { readonly status?: string }>;
}

const readTextFile = (path: string): string => readFileSync(path, "utf8");

const readJsonFile = <T>(path: string): T => JSON.parse(readTextFile(path)) as T;

const lowerIncludes = (value: string, needle: string): boolean => value.toLowerCase().includes(needle.toLowerCase());

const createCheck = (id: string, label: string, passed: boolean, details: string): RepositoryHealthCheck => ({
	id,
	label,
	passed,
	details,
});

export const runRepositoryHealthScript = (repoRoot = process.cwd()): RepositoryHealthScriptResult => {
	const checks: RepositoryHealthCheck[] = [];

	const statePath = `${repoRoot}/.spec_system/state.json`;
	if (!existsSync(statePath)) {
		checks.push(createCheck("spec-state", "Spec state", false, "Missing .spec_system/state.json."));
	} else {
		try {
			const state = readJsonFile<SpecSystemState>(statePath);
			const currentPhaseKey = state.current_phase === undefined ? undefined : String(state.current_phase);
			const currentPhaseStatus =
				currentPhaseKey === undefined ? undefined : state.phases?.[currentPhaseKey]?.status;
			const hasCompletedPhase = currentPhaseStatus === "complete";
			const hasNoActiveSession = state.current_session === null;

			checks.push(
				createCheck(
					"spec-state",
					"Spec state",
					hasCompletedPhase && hasNoActiveSession,
					hasCompletedPhase
						? hasNoActiveSession
							? `Phase ${currentPhaseKey ?? "unknown"} is complete and no session is active.`
							: "Current phase is complete, but current_session is still set."
						: `Current phase ${currentPhaseKey ?? "unknown"} is not marked complete.`,
				),
			);
		} catch (error) {
			checks.push(
				createCheck(
					"spec-state",
					"Spec state",
					false,
					`Could not read or parse .spec_system/state.json: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
		}
	}

	const packageJsonPath = `${repoRoot}/package.json`;
	if (!existsSync(packageJsonPath)) {
		checks.push(createCheck("package-scripts", "Package scripts", false, "Missing package.json."));
	} else {
		try {
			const packageJson = readJsonFile<{ readonly scripts?: Record<string, string> }>(packageJsonPath);
			const scripts = packageJson.scripts ?? {};
			const hasBuildScript = typeof scripts.build === "string" && scripts.build.length > 0;
			const hasValidateScript = typeof scripts.validate === "string" && scripts.validate.length > 0;
			const hasHealthScript = typeof scripts.health === "string" && scripts.health.length > 0;

			checks.push(
				createCheck(
					"package-scripts",
					"Package scripts",
					hasBuildScript && hasValidateScript && hasHealthScript,
					hasBuildScript && hasValidateScript && hasHealthScript
						? "Build, validate, and health scripts are registered."
						: "Expected build, validate, and health scripts in package.json.",
				),
			);
		} catch (error) {
			checks.push(
				createCheck(
					"package-scripts",
					"Package scripts",
					false,
					`Could not read or parse package.json: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
		}
	}

	const deploymentGuidePath = `${repoRoot}/docs/deployment.md`;
	if (!existsSync(deploymentGuidePath)) {
		checks.push(createCheck("deployment-guide", "Deployment guide", false, "Missing docs/deployment.md."));
	} else {
		try {
			const deploymentGuide = readTextFile(deploymentGuidePath);
			const mentionsNoHostedTarget =
				lowerIncludes(deploymentGuide, "no hosted deployment target") ||
				lowerIncludes(deploymentGuide, "does not have a hosted deployment target");
			const mentionsLocalBuildGate = lowerIncludes(deploymentGuide, "build step is the main local release gate");

			checks.push(
				createCheck(
					"deployment-guide",
					"Deployment guide",
					mentionsNoHostedTarget && mentionsLocalBuildGate,
					mentionsNoHostedTarget && mentionsLocalBuildGate
						? "Deployment guide documents the local-only release gate."
						: "Deployment guide should document the local-only release gate and the lack of a hosted deployment target.",
				),
			);
		} catch (error) {
			checks.push(
				createCheck(
					"deployment-guide",
					"Deployment guide",
					false,
					`Could not read docs/deployment.md: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
		}
	}

	const environmentsGuidePath = `${repoRoot}/docs/environments.md`;
	if (!existsSync(environmentsGuidePath)) {
		checks.push(createCheck("environment-guide", "Environment guide", false, "Missing docs/environments.md."));
	} else {
		try {
			const environmentsGuide = readTextFile(environmentsGuidePath);
			const mentionsNoBackend = lowerIncludes(environmentsGuide, "there is no hosted backend");
			const mentionsLocalFirst = lowerIncludes(
				environmentsGuide,
				"distribution is centered on the obsidian plugin",
			);
			const mentionsPluginWorkflow = lowerIncludes(environmentsGuide, "local vault workflows");

			checks.push(
				createCheck(
					"environment-guide",
					"Environment guide",
					mentionsNoBackend && (mentionsLocalFirst || mentionsPluginWorkflow),
					mentionsNoBackend && (mentionsLocalFirst || mentionsPluginWorkflow)
						? "Environment guide documents the plugin-only production model."
						: "Environment guide should document the absence of a hosted backend and the plugin-local workflow model.",
				),
			);
		} catch (error) {
			checks.push(
				createCheck(
					"environment-guide",
					"Environment guide",
					false,
					`Could not read docs/environments.md: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
		}
	}

	const healthWorkflowPath = `${repoRoot}/.github/workflows/health.yml`;
	checks.push(
		createCheck(
			"health-workflow",
			"Health workflow",
			existsSync(healthWorkflowPath),
			existsSync(healthWorkflowPath)
				? "Repository health workflow is configured."
				: "Missing .github/workflows/health.yml.",
		),
	);

	const requiredCiWorkflows = [
		".github/workflows/quality.yml",
		".github/workflows/test.yml",
		".github/workflows/security.yml",
	] as const;
	const missingCiWorkflows = requiredCiWorkflows.filter((path) => !existsSync(`${repoRoot}/${path}`));
	checks.push(
		createCheck(
			"ci-workflows",
			"CI workflows",
			missingCiWorkflows.length === 0,
			missingCiWorkflows.length === 0
				? "Quality, test, and security workflows are present."
				: `Missing CI workflow(s): ${missingCiWorkflows.join(", ")}.`,
		),
	);

	return { checks };
};

const runCli = (): void => {
	const { checks } = runRepositoryHealthScript(process.cwd());
	const failures = checks.filter((check) => !check.passed);

	if (failures.length > 0) {
		console.error(`Repository health validation failed (${failures.length} checks).`);
		for (const check of failures) {
			console.error(`- [${check.id}] ${check.details}`);
		}
		process.exitCode = 1;
		return;
	}

	console.log("Repository health validation passed.");
	console.log(`Checks passed: ${checks.length}`);
	for (const check of checks) {
		console.log(`- [${check.id}] ${check.details}`);
	}
};

if ((import.meta as ImportMeta & { main?: boolean }).main) {
	runCli();
}

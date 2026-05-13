import type { AgentCommand, AgentCommandId, AgentValidationIssue } from "../types/agent-commands";
import type { VoidbrainPluginSettings } from "../types/plugin";
import type { RecoverySummary } from "../types/recovery";
import type { RuntimeCommandContext, RuntimeCommandOutcome, RuntimeStatusSnapshot } from "../types/runtime";
import {
	AGENT_COMMAND_CATALOG,
	sortAgentCommandsDeterministically,
	validateAgentCommandCatalog,
} from "./command-catalog";

export interface RuntimeCommandHandlerEntry {
	readonly command: AgentCommand;
	readonly run: () => RuntimeCommandOutcome;
}

export interface ChatRuntimeCommandExecutionOptions {
	readonly openChatView: () => Promise<void> | void;
	readonly canOpenChat?: () => boolean;
}

export interface IngestionRuntimeCommandExecutionOptions {
	readonly openIngestionModal: () => Promise<void> | void;
	readonly canOpenIngestion?: () => boolean;
}

export interface StagedReviewRuntimeCommandExecutionOptions {
	readonly openStagedChangeReview: () => Promise<void> | void;
	readonly canOpenStagedChangeReview?: () => boolean;
}

export interface HealthRuntimeCommandExecutionOptions {
	readonly openHealthCheck: () => Promise<void> | void;
	readonly canOpenHealthCheck?: () => boolean;
}

export interface RecoveryRuntimeCommandExecutionOptions {
	readonly recoverSession: () => Promise<RecoverySummary> | RecoverySummary;
	readonly canRecoverSession?: () => boolean;
}

export interface RuntimeCommandHandlerOptions {
	readonly getSettings: () => VoidbrainPluginSettings;
	readonly getStatusSnapshot: () => RuntimeStatusSnapshot;
	readonly chat?: ChatRuntimeCommandExecutionOptions;
	readonly ingestion?: IngestionRuntimeCommandExecutionOptions;
	readonly stagedReview?: StagedReviewRuntimeCommandExecutionOptions;
	readonly health?: HealthRuntimeCommandExecutionOptions;
	readonly recovery?: RecoveryRuntimeCommandExecutionOptions;
}

export class RuntimeCommandRegistrationError extends Error {
	readonly issues: readonly AgentValidationIssue[];

	constructor(issues: readonly AgentValidationIssue[]) {
		super("Runtime command catalog failed validation.");
		this.name = "RuntimeCommandRegistrationError";
		this.issues = issues;
	}
}

const plannedWorkflowMessages: Readonly<Record<AgentCommandId, string>> = {
	"voidbrain.ingest-source": "Source ingestion staging is unavailable. No generated notes were applied to the vault.",
	"voidbrain.chat-with-vault":
		"Grounded vault chat is not ready yet. Retrieval readiness must be ready, and vault content will not be sent to a provider before explicit provider review exists.",
	"voidbrain.health-check": "Vault health reporting is unavailable. No vault notes were changed.",
	"voidbrain.stage-change":
		"Staged-change review and confirmed apply are unavailable. Direct note writes remain disabled.",
	"voidbrain.recover-session": "Session recovery runtime is unavailable. Recovery remains read-only and redacted.",
	"voidbrain.validate-agent-surfaces":
		"Agent surface validation is available from repository tooling, but the Obsidian command is read-only placeholder behavior.",
	"voidbrain.preview-framework-update":
		"Framework update preview is dry-run only. Runtime apply behavior is intentionally unavailable.",
};

const recoveryHints: Readonly<Record<AgentCommandId, string>> = {
	"voidbrain.ingest-source":
		"Retry from an approved markdown, text, pasted, or URL source record and inspect staged-change IDs before apply.",
	"voidbrain.chat-with-vault":
		"Build or refresh the lexical index and configure providers first; chat remains blocked until retrieval and provider preflight are ready.",
	"voidbrain.health-check": "Reload the plugin and retry the local health scan; repairs remain staged changes only.",
	"voidbrain.stage-change":
		"Review staged-change IDs, confirmation requirements, backup intent, validation output, and recovery details before apply.",
	"voidbrain.recover-session":
		"Inspect command IDs, cache paths, target paths, report IDs, staged-change IDs, validation output, and retry or discard guidance.",
	"voidbrain.validate-agent-surfaces": "Run bun run validate:agent-surfaces from the repository root.",
	"voidbrain.preview-framework-update": "Run bun run preview:framework-update for a dry-run plan.",
};

const commandKind = (command: AgentCommand): RuntimeCommandOutcome["kind"] => {
	if (command.status === "implemented") {
		return "opened";
	}

	if (command.id === "voidbrain.preview-framework-update") {
		return "dry-run";
	}

	if (command.id === "voidbrain.validate-agent-surfaces") {
		return "read-only";
	}

	return "not-ready";
};

const commandSeverity = (command: AgentCommand): RuntimeCommandOutcome["severity"] => {
	if (command.status === "implemented") {
		return "ready";
	}

	if (command.status === "scaffolded") {
		return "warning";
	}

	return command.privacyLevel === "explicit-provider-review" ? "missing" : "warning";
};

const buildCommandOutcome = (context: RuntimeCommandContext): RuntimeCommandOutcome => {
	const statusSummary = `${context.statusSnapshot.counts.missing} missing, ${context.statusSnapshot.counts.warning} warning, ${context.statusSnapshot.counts.error} error.`;
	const providerReview = context.settings.shouldRequireProviderReview
		? "Provider review remains required."
		: "Provider review setting was recovered before execution.";

	return {
		commandId: context.command.id,
		kind: commandKind(context.command),
		severity: commandSeverity(context.command),
		userMessage: `${plannedWorkflowMessages[context.command.id]} ${providerReview} Current readiness: ${statusSummary}`,
		recoveryHint: recoveryHints[context.command.id],
	};
};

const buildChatCommandOutcome = (
	context: RuntimeCommandContext,
	chat: ChatRuntimeCommandExecutionOptions | undefined,
): RuntimeCommandOutcome => {
	if (context.command.id !== "voidbrain.chat-with-vault" || context.command.status !== "implemented") {
		return buildCommandOutcome(context);
	}

	if (chat === undefined || chat.canOpenChat?.() === false) {
		return {
			commandId: context.command.id,
			kind: "not-ready",
			severity: "error",
			userMessage: "Grounded vault chat runtime is unavailable. No vault notes were changed.",
			recoveryHint: "Reload the plugin and verify chat, provider, and retrieval readiness.",
		};
	}

	void chat.openChatView();
	return {
		commandId: context.command.id,
		kind: "opened",
		severity: "ready",
		userMessage: "Grounded vault chat opened with local retrieval and explicit provider review gates.",
		recoveryHint: "Inspect retrieval evidence and citations before trusting an answer.",
	};
};

const buildIngestionCommandOutcome = (
	context: RuntimeCommandContext,
	ingestion: IngestionRuntimeCommandExecutionOptions | undefined,
): RuntimeCommandOutcome => {
	if (context.command.id !== "voidbrain.ingest-source" || context.command.status !== "implemented") {
		return buildCommandOutcome(context);
	}

	if (ingestion === undefined || ingestion.canOpenIngestion?.() === false) {
		return {
			commandId: context.command.id,
			kind: "not-ready",
			severity: "error",
			userMessage: "Source ingestion staging runtime is unavailable. No vault notes were changed.",
			recoveryHint: "Reload the plugin and retry with a bounded source path or pasted source record.",
		};
	}

	void ingestion.openIngestionModal();
	return {
		commandId: context.command.id,
		kind: "opened",
		severity: "ready",
		userMessage: "Source ingestion staging opened with local-first preview and staged-change review gates.",
		recoveryHint: "Preview target paths and staged-change IDs before trusting generated notes.",
	};
};

const buildStagedReviewCommandOutcome = (
	context: RuntimeCommandContext,
	stagedReview: StagedReviewRuntimeCommandExecutionOptions | undefined,
): RuntimeCommandOutcome => {
	if (context.command.id !== "voidbrain.stage-change" || context.command.status !== "implemented") {
		return buildCommandOutcome(context);
	}

	if (stagedReview === undefined || stagedReview.canOpenStagedChangeReview?.() === false) {
		return {
			commandId: context.command.id,
			kind: "not-ready",
			severity: "error",
			userMessage: "Staged-change review runtime is unavailable. No vault notes were changed.",
			recoveryHint: "Reload the plugin and inspect staged-change IDs, target paths, and validation output.",
		};
	}

	void stagedReview.openStagedChangeReview();
	return {
		commandId: context.command.id,
		kind: "opened",
		severity: "ready",
		userMessage: "Staged-change review opened with explicit confirmation and local backup gates.",
		recoveryHint: "Apply only after reviewing diffs, backup intent, conflicts, and recovery details.",
	};
};

const buildHealthCommandOutcome = (
	context: RuntimeCommandContext,
	health: HealthRuntimeCommandExecutionOptions | undefined,
	inFlightCommandIds: Set<AgentCommandId>,
): RuntimeCommandOutcome => {
	if (context.command.id !== "voidbrain.health-check" || context.command.status !== "implemented") {
		return buildCommandOutcome(context);
	}

	if (health === undefined || health.canOpenHealthCheck?.() === false) {
		return {
			commandId: context.command.id,
			kind: "not-ready",
			severity: "error",
			userMessage: "Vault health runtime is unavailable. No vault notes were changed.",
			recoveryHint: "Reload the plugin and inspect command ID voidbrain.health-check recovery details.",
		};
	}

	if (inFlightCommandIds.has(context.command.id)) {
		return {
			commandId: context.command.id,
			kind: "not-ready",
			severity: "warning",
			userMessage: "Vault health is already opening. No duplicate scan was started.",
			recoveryHint: "Wait for the current health flow to finish before retrying.",
		};
	}

	inFlightCommandIds.add(context.command.id);
	Promise.resolve(health.openHealthCheck())
		.catch(() => undefined)
		.finally(() => {
			inFlightCommandIds.delete(context.command.id);
		});
	return {
		commandId: context.command.id,
		kind: "opened",
		severity: "ready",
		userMessage: "Vault health opened with local scanning, markdown export, and staged repair gates.",
		recoveryHint: "Inspect report ID, target paths, staged-change IDs, and validation output before apply.",
	};
};

const buildRecoveryCommandOutcome = (
	context: RuntimeCommandContext,
	recovery: RecoveryRuntimeCommandExecutionOptions | undefined,
	inFlightCommandIds: Set<AgentCommandId>,
): RuntimeCommandOutcome => {
	if (context.command.id !== "voidbrain.recover-session" || context.command.status !== "implemented") {
		return buildCommandOutcome(context);
	}

	if (recovery === undefined || recovery.canRecoverSession?.() === false) {
		return {
			commandId: context.command.id,
			kind: "not-ready",
			severity: "error",
			userMessage: "Session recovery runtime is unavailable. No vault notes or support records were changed.",
			recoveryHint:
				"Reload the plugin and inspect hot cache path, staged-change IDs, report IDs, validation output, and retry or discard options.",
		};
	}

	if (inFlightCommandIds.has(context.command.id)) {
		return {
			commandId: context.command.id,
			kind: "not-ready",
			severity: "warning",
			userMessage: "Session recovery is already running. No duplicate recovery read was started.",
			recoveryHint: "Wait for the current recovery summary before retrying or discarding records.",
		};
	}

	inFlightCommandIds.add(context.command.id);
	Promise.resolve(recovery.recoverSession())
		.catch(() => undefined)
		.finally(() => {
			inFlightCommandIds.delete(context.command.id);
		});
	return {
		commandId: context.command.id,
		kind: "read-only",
		severity: "ready",
		userMessage:
			"Session recovery started as a read-only local support-record scan. No providers were called and no vault files were changed.",
		recoveryHint:
			"Inspect command IDs, cache paths, target paths, report IDs, staged-change IDs, validation output, and retry or discard guidance before taking action.",
	};
};

export const mapRuntimeCommandError = (command: AgentCommand, error: unknown): RuntimeCommandOutcome => ({
	commandId: command.id,
	kind: "error",
	severity: "error",
	userMessage: `Command ${command.id} failed before execution. No vault notes were changed.`,
	recoveryHint: error instanceof Error ? error.message : "Inspect runtime command registration state.",
});

export const createRuntimeCommandHandlers = (
	options: RuntimeCommandHandlerOptions,
	commands: readonly AgentCommand[] = AGENT_COMMAND_CATALOG,
): readonly RuntimeCommandHandlerEntry[] => {
	const validation = validateAgentCommandCatalog(commands);
	if (!validation.ok) {
		throw new RuntimeCommandRegistrationError(validation.issues);
	}

	const inFlightCommandIds = new Set<AgentCommandId>();

	return sortAgentCommandsDeterministically(commands).map((command) => ({
		command,
		run: () => {
			try {
				const context = {
					command,
					settings: options.getSettings(),
					statusSnapshot: options.getStatusSnapshot(),
				};
				if (command.id === "voidbrain.ingest-source") {
					return buildIngestionCommandOutcome(context, options.ingestion);
				}
				if (command.id === "voidbrain.stage-change") {
					return buildStagedReviewCommandOutcome(context, options.stagedReview);
				}
				if (command.id === "voidbrain.chat-with-vault") {
					return buildChatCommandOutcome(context, options.chat);
				}
				if (command.id === "voidbrain.health-check") {
					return buildHealthCommandOutcome(context, options.health, inFlightCommandIds);
				}
				if (command.id === "voidbrain.recover-session") {
					return buildRecoveryCommandOutcome(context, options.recovery, inFlightCommandIds);
				}

				return buildCommandOutcome(context);
			} catch (error) {
				return mapRuntimeCommandError(command, error);
			}
		},
	}));
};

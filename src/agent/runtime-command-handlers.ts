import type { AgentCommand, AgentCommandId, AgentValidationIssue } from "../types/agent-commands";
import type { VoidbrainPluginSettings } from "../types/plugin";
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

export interface RuntimeCommandHandlerOptions {
	readonly getSettings: () => VoidbrainPluginSettings;
	readonly getStatusSnapshot: () => RuntimeStatusSnapshot;
	readonly chat?: ChatRuntimeCommandExecutionOptions;
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
	"voidbrain.ingest-source":
		"Source ingestion is not ready yet. Retrieval readiness must be checked before provider work, and this command will create staged changes only after the ingestion workflow is implemented.",
	"voidbrain.chat-with-vault":
		"Grounded vault chat is not ready yet. Retrieval readiness must be ready, and vault content will not be sent to a provider before explicit provider review exists.",
	"voidbrain.health-check":
		"Runtime health checks are not ready yet. This command is currently a local-first readiness placeholder.",
	"voidbrain.stage-change":
		"Staged-change review entry points are not ready yet. Direct note writes remain disabled.",
	"voidbrain.recover-session":
		"Session recovery is not ready yet. Recovery output will stay redacted when this workflow is implemented.",
	"voidbrain.validate-agent-surfaces":
		"Agent surface validation is available from repository tooling, but the Obsidian command is read-only placeholder behavior.",
	"voidbrain.preview-framework-update":
		"Framework update preview is dry-run only. Runtime apply behavior is intentionally unavailable.",
};

const recoveryHints: Readonly<Record<AgentCommandId, string>> = {
	"voidbrain.ingest-source":
		"Refresh retrieval readiness and use synthetic source fixtures until the ingestion staging workflow is implemented.",
	"voidbrain.chat-with-vault":
		"Build or refresh the lexical index and configure providers first; chat remains blocked until retrieval and provider preflight are ready.",
	"voidbrain.health-check": "Use the repository validation commands until runtime health checks are implemented.",
	"voidbrain.stage-change": "Review staged-change support records only; do not edit user notes directly.",
	"voidbrain.recover-session": "Keep command IDs and staged-change IDs available for later recovery workflows.",
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

	return sortAgentCommandsDeterministically(commands).map((command) => ({
		command,
		run: () => {
			try {
				return buildChatCommandOutcome(
					{
						command,
						settings: options.getSettings(),
						statusSnapshot: options.getStatusSnapshot(),
					},
					options.chat,
				);
			} catch (error) {
				return mapRuntimeCommandError(command, error);
			}
		},
	}));
};

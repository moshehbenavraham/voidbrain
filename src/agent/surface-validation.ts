import {
	AGENT_COMMAND_STATUSES,
	type AgentCommand,
	type AgentSurfaceDefinition,
	type AgentSurfaceValidationReport,
	type AgentValidationIssue,
	type AgentValidationResult,
	isAgentCommandId,
	isAgentCommandStatus,
	isAgentSurfaceId,
} from "../types/agent-commands";
import { createRedactedLineExcerpt, sortAgentValidationIssues } from "./agent-validation-reporting";
import { AGENT_COMMAND_CATALOG } from "./command-catalog";

export interface AgentSurfaceMarkdownInput {
	readonly surface: AgentSurfaceDefinition;
	readonly markdown: string;
}

export interface MarkdownLineContext {
	readonly line: number;
	readonly text: string;
	readonly heading?: string | undefined;
}

export interface AgentCommandMarkdownReference {
	readonly commandId: string;
	readonly line: number;
	readonly heading?: string | undefined;
	readonly excerpt: string;
}

const commandReferencePattern = /\bvoidbrain\.[a-z0-9-]+\b/g;
const markdownHeadingPattern = /^(#{1,6})\s+(.+?)\s*#*$/;
const markdownTableSeparatorPattern = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;

const fallbackSurface: AgentSurfaceDefinition = {
	id: "human-docs",
	label: "Invalid surface",
	path: "<unknown>",
	required: true,
	requiredSafetyPhrases: [],
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string");

const isAgentCommandArray = (value: unknown): value is readonly AgentCommand[] =>
	Array.isArray(value) && value.every((item) => isRecord(item) && isAgentCommandId(item.id));

const isSurfaceDefinition = (value: unknown): value is AgentSurfaceDefinition =>
	isRecord(value) &&
	isAgentSurfaceId(value.id) &&
	typeof value.label === "string" &&
	typeof value.path === "string" &&
	typeof value.required === "boolean" &&
	isStringArray(value.requiredSafetyPhrases);

const normalizePhrase = (value: string): string => value.trim().toLowerCase();

const uniqueSorted = (values: Iterable<string>): readonly string[] =>
	[...new Set(values)].sort((left, right) => left.localeCompare(right));

export const getMarkdownLineContexts = (markdown: string): readonly MarkdownLineContext[] => {
	const contexts: MarkdownLineContext[] = [];
	let currentHeading: string | undefined;

	for (const [lineIndex, text] of markdown.split(/\n/).entries()) {
		const headingMatch = text.match(markdownHeadingPattern);
		if (headingMatch?.[2] !== undefined) {
			currentHeading = headingMatch[2].trim();
		}

		contexts.push({
			line: lineIndex + 1,
			text,
			heading: currentHeading,
		});
	}

	return contexts;
};

export const extractAgentCommandReferencesFromMarkdown = (
	markdown: string,
): readonly AgentCommandMarkdownReference[] => {
	const references: AgentCommandMarkdownReference[] = [];

	for (const context of getMarkdownLineContexts(markdown)) {
		for (const match of context.text.matchAll(commandReferencePattern)) {
			if (match[0] !== undefined) {
				references.push({
					commandId: match[0],
					line: context.line,
					heading: context.heading,
					excerpt: createRedactedLineExcerpt(context.text),
				});
			}
		}
	}

	return references.sort((left, right) => {
		const byCommand = left.commandId.localeCompare(right.commandId);
		if (byCommand !== 0) {
			return byCommand;
		}

		return left.line - right.line;
	});
};

export const extractAgentCommandIdsFromMarkdown = (markdown: string): readonly string[] => {
	return uniqueSorted(extractAgentCommandReferencesFromMarkdown(markdown).map((reference) => reference.commandId));
};

export const findMissingRequiredSafetyPhrases = (
	markdown: string,
	requiredPhrases: readonly string[],
): readonly string[] => {
	const normalizedMarkdown = normalizePhrase(markdown);
	return uniqueSorted(requiredPhrases.filter((phrase) => !normalizedMarkdown.includes(normalizePhrase(phrase))));
};

const expectedCommandIds = (commands: readonly AgentCommand[]): readonly string[] =>
	uniqueSorted(commands.map((command) => command.id));

const requiredPhrasesForSurface = (
	surface: AgentSurfaceDefinition,
	commands: readonly AgentCommand[],
): readonly string[] =>
	uniqueSorted([...surface.requiredSafetyPhrases, ...commands.flatMap((command) => command.requiredSafetyPhrases)]);

const invalidInputReport = (message: string): AgentSurfaceValidationReport => ({
	surface: fallbackSurface,
	commandIds: [],
	requiredSafetyPhrases: [],
	issues: [
		{
			code: "surface.invalid-input",
			message,
			path: fallbackSurface.path,
			remediation:
				"Call surface validation with a known surface definition, markdown text, and catalog commands.",
		},
	],
});

const parseMarkdownTableCells = (line: string): readonly string[] | undefined => {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.includes("|")) {
		return undefined;
	}

	return trimmed
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());
};

const normalizeTableCell = (cell: string): string => cell.replace(/[`*_]/g, "").trim().toLowerCase();

const commandStatusFromCell = (cell: string): AgentCommand["status"] | undefined => {
	const normalized = normalizeTableCell(cell);
	const status = AGENT_COMMAND_STATUSES.find((candidate) => normalized === candidate);
	return isAgentCommandStatus(status) ? status : undefined;
};

export const findStaleCommandStatusIssues = (
	markdown: string,
	surface: AgentSurfaceDefinition,
	commands: readonly AgentCommand[],
): readonly AgentValidationIssue[] => {
	const commandById = new Map(commands.map((command) => [command.id, command]));
	const issues: AgentValidationIssue[] = [];
	let activeCommandIdColumn = -1;
	let activeStatusColumn = -1;

	for (const context of getMarkdownLineContexts(markdown)) {
		const cells = parseMarkdownTableCells(context.text);
		if (cells === undefined) {
			activeCommandIdColumn = -1;
			activeStatusColumn = -1;
			continue;
		}

		if (markdownTableSeparatorPattern.test(context.text.trim())) {
			continue;
		}

		const normalizedCells = cells.map(normalizeTableCell);
		const commandIdColumn = normalizedCells.findIndex((cell) => cell === "command id");
		const statusColumn = normalizedCells.findIndex((cell) => cell === "status");

		if (commandIdColumn >= 0 && statusColumn >= 0) {
			activeCommandIdColumn = commandIdColumn;
			activeStatusColumn = statusColumn;
			continue;
		}

		if (activeCommandIdColumn < 0 || activeStatusColumn < 0) {
			continue;
		}

		const commandIdCell = cells[activeCommandIdColumn] ?? "";
		const statusCell = cells[activeStatusColumn] ?? "";
		const commandId = commandIdCell.match(commandReferencePattern)?.[0];
		if (commandId === undefined) {
			continue;
		}

		const command = commandById.get(commandId as AgentCommand["id"]);
		if (command === undefined) {
			continue;
		}

		const actualStatus = commandStatusFromCell(statusCell);
		if (actualStatus === command.status) {
			continue;
		}

		issues.push({
			code: "surface.stale-command-status",
			message:
				actualStatus === undefined
					? `${surface.path} does not list a recognized status for ${commandId}.`
					: `${surface.path} lists ${commandId} as ${actualStatus}, but catalog status is ${command.status}.`,
			commandId,
			surfaceId: surface.id,
			path: surface.path,
			line: context.line,
			heading: context.heading,
			excerpt: context.text,
			remediation: `Update the status cell for ${commandId} to ${command.status}.`,
		});
	}

	return issues;
};

export const validateAgentSurfaceMarkdown = (input: unknown): AgentSurfaceValidationReport => {
	if (!isRecord(input)) {
		return invalidInputReport("Agent surface validation input must be an object.");
	}

	if (!isSurfaceDefinition(input.surface)) {
		return invalidInputReport("Agent surface validation input must include a valid surface definition.");
	}

	if (typeof input.markdown !== "string") {
		return invalidInputReport("Agent surface validation input must include markdown text.");
	}

	const commands = isAgentCommandArray(input.commands) ? input.commands : AGENT_COMMAND_CATALOG;
	const surface = input.surface;
	const commandReferences = extractAgentCommandReferencesFromMarkdown(input.markdown);
	const commandIds = uniqueSorted(commandReferences.map((reference) => reference.commandId));
	const firstReferenceByCommandId = new Map<string, AgentCommandMarkdownReference>();
	for (const reference of commandReferences) {
		if (!firstReferenceByCommandId.has(reference.commandId)) {
			firstReferenceByCommandId.set(reference.commandId, reference);
		}
	}
	const expectedIds = expectedCommandIds(commands);
	const expectedIdSet = new Set(expectedIds);
	const actualIdSet = new Set(commandIds);
	const requiredSafetyPhrases = requiredPhrasesForSurface(surface, commands);
	const missingPhrases = findMissingRequiredSafetyPhrases(input.markdown, requiredSafetyPhrases);
	const issues: AgentValidationIssue[] = [...findStaleCommandStatusIssues(input.markdown, surface, commands)];

	for (const commandId of expectedIds) {
		if (!actualIdSet.has(commandId)) {
			const command = commands.find((candidate) => candidate.id === commandId);
			issues.push({
				code: "surface.missing-command-id",
				message: `${surface.path} is missing command ID ${commandId}.`,
				commandId,
				surfaceId: surface.id,
				path: surface.path,
				heading: surface.label,
				remediation:
					command === undefined
						? `Add ${commandId} from the canonical command catalog.`
						: `Add ${commandId} with ${command.status} status and required recovery evidence.`,
			});
		}
	}

	for (const commandId of commandIds) {
		if (!expectedIdSet.has(commandId)) {
			const reference = firstReferenceByCommandId.get(commandId);
			issues.push({
				code: "surface.unknown-command-id",
				message: `${surface.path} references unknown command ID ${commandId}.`,
				commandId,
				surfaceId: surface.id,
				path: surface.path,
				line: reference?.line,
				heading: reference?.heading,
				excerpt: reference?.excerpt,
				remediation: "Remove the stale command ID or add it to the canonical command catalog first.",
			});
		}
	}

	for (const phrase of missingPhrases) {
		issues.push({
			code: "surface.missing-safety-phrase",
			message: `${surface.path} is missing required safety phrase "${phrase}".`,
			surfaceId: surface.id,
			path: surface.path,
			field: phrase,
			heading: surface.label,
			remediation: `Add "${phrase}" language to the safety policy for this surface.`,
		});
	}

	return {
		surface,
		commandIds,
		requiredSafetyPhrases,
		issues: sortAgentValidationIssues(issues),
	};
};

export const validateAgentSurfaces = (
	inputs: readonly AgentSurfaceMarkdownInput[],
	commands: readonly AgentCommand[] = AGENT_COMMAND_CATALOG,
): AgentValidationResult => {
	const reports = inputs.map((input) => validateAgentSurfaceMarkdown({ ...input, commands }));
	const issues = sortAgentValidationIssues(reports.flatMap((report) => report.issues));

	if (issues.length > 0) {
		return {
			ok: false,
			issues,
		};
	}

	return {
		ok: true,
		issues: [],
	};
};

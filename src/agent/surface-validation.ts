import {
	type AgentCommand,
	type AgentSurfaceDefinition,
	type AgentSurfaceValidationReport,
	type AgentValidationIssue,
	type AgentValidationResult,
	isAgentCommandId,
	isAgentSurfaceId,
} from "../types/agent-commands";
import { AGENT_COMMAND_CATALOG } from "./command-catalog";

export interface AgentSurfaceMarkdownInput {
	readonly surface: AgentSurfaceDefinition;
	readonly markdown: string;
}

const commandReferencePattern = /\bvoidbrain\.[a-z0-9-]+\b/g;

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

const normalizePhrase = (value: string): string => value.trim().toLocaleLowerCase();

const uniqueSorted = (values: Iterable<string>): readonly string[] =>
	[...new Set(values)].sort((left, right) => left.localeCompare(right));

export const extractAgentCommandIdsFromMarkdown = (markdown: string): readonly string[] => {
	const matches = markdown.match(commandReferencePattern);
	return uniqueSorted(matches ?? []);
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
		},
	],
});

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
	const commandIds = extractAgentCommandIdsFromMarkdown(input.markdown);
	const expectedIds = expectedCommandIds(commands);
	const expectedIdSet = new Set(expectedIds);
	const actualIdSet = new Set(commandIds);
	const requiredSafetyPhrases = requiredPhrasesForSurface(surface, commands);
	const missingPhrases = findMissingRequiredSafetyPhrases(input.markdown, requiredSafetyPhrases);
	const issues: AgentValidationIssue[] = [];

	for (const commandId of expectedIds) {
		if (!actualIdSet.has(commandId)) {
			issues.push({
				code: "surface.missing-command-id",
				message: `${surface.path} is missing command ID ${commandId}.`,
				commandId,
				surfaceId: surface.id,
				path: surface.path,
			});
		}
	}

	for (const commandId of commandIds) {
		if (!expectedIdSet.has(commandId)) {
			issues.push({
				code: "surface.unknown-command-id",
				message: `${surface.path} references unknown command ID ${commandId}.`,
				commandId,
				surfaceId: surface.id,
				path: surface.path,
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
		});
	}

	return {
		surface,
		commandIds,
		requiredSafetyPhrases,
		issues,
	};
};

export const validateAgentSurfaces = (
	inputs: readonly AgentSurfaceMarkdownInput[],
	commands: readonly AgentCommand[] = AGENT_COMMAND_CATALOG,
): AgentValidationResult => {
	const reports = inputs.map((input) => validateAgentSurfaceMarkdown({ ...input, commands }));
	const issues = reports.flatMap((report) => report.issues);

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

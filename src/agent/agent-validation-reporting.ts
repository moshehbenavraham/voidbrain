import type { AgentValidationIssue } from "../types/agent-commands";

const maxExcerptLength = 120;

const redactionPatterns: readonly [RegExp, string][] = [
	[/\bBearer\s+[A-Za-z0-9._-]{8,}\b/g, "Bearer [REDACTED]"],
	[/\bsk-[A-Za-z0-9]{8,}\b/g, "[REDACTED_CREDENTIAL]"],
	[/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, "[REDACTED_CREDENTIAL]"],
	[/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, "[REDACTED_CREDENTIAL]"],
	[/\bAKIA[0-9A-Z]{12,}\b/g, "[REDACTED_CREDENTIAL]"],
	[
		/\b((?:api[_-]?key|access[_-]?key|secret|token|password|authorization)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,}\]]+)/gi,
		"$1[REDACTED]",
	],
	[/\/Users\/[A-Za-z0-9._-]+(?:\/[^\s"'`)]+)*/g, "[REDACTED_PRIVATE_PATH]"],
	[/\/home\/[A-Za-z0-9._-]+(?:\/[^\s"'`)]+)*/g, "[REDACTED_PRIVATE_PATH]"],
	[/[A-Za-z]:\\Users\\[^\\\s]+(?:\\[^\\\s]+)*/g, "[REDACTED_PRIVATE_PATH]"],
];

export const redactSensitiveValidationText = (value: string): string =>
	redactionPatterns.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);

export const createRedactedLineExcerpt = (line: string, maxLength = maxExcerptLength): string => {
	const redacted = redactSensitiveValidationText(line.trim());
	return redacted.length > maxLength ? `${redacted.slice(0, maxLength - 3)}...` : redacted;
};

const issuePath = (issue: AgentValidationIssue): string => redactSensitiveValidationText(issue.path ?? "<unknown>");

const issueLine = (issue: AgentValidationIssue): string => (issue.line === undefined ? "" : `:${issue.line}`);

const issueHeading = (issue: AgentValidationIssue): string =>
	issue.heading === undefined ? "" : ` [${redactSensitiveValidationText(issue.heading)}]`;

const issueCommand = (issue: AgentValidationIssue): string =>
	issue.commandId === undefined ? "" : ` [${redactSensitiveValidationText(issue.commandId)}]`;

const issueExcerpt = (issue: AgentValidationIssue): string =>
	issue.excerpt === undefined ? "" : ` Excerpt: ${createRedactedLineExcerpt(issue.excerpt)}`;

const issueRemediation = (issue: AgentValidationIssue): string =>
	issue.remediation === undefined ? "" : ` Remediation: ${redactSensitiveValidationText(issue.remediation)}`;

export const formatAgentValidationIssue = (issue: AgentValidationIssue): string =>
	`${issuePath(issue)}${issueLine(issue)}${issueHeading(issue)}: ${issue.code}${issueCommand(issue)} - ${redactSensitiveValidationText(issue.message)}${issueExcerpt(issue)}${issueRemediation(issue)}`;

export const sortAgentValidationIssues = (issues: readonly AgentValidationIssue[]): readonly AgentValidationIssue[] =>
	[...issues].sort((left, right) =>
		formatAgentValidationIssue(left).localeCompare(formatAgentValidationIssue(right)),
	);

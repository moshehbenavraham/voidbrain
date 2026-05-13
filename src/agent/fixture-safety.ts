import type {
	AgentValidationIssue,
	AgentValidationResult,
	FixtureSafetyEntry,
	FixtureSafetyReport,
} from "../types/agent-commands";
import { createRedactedLineExcerpt, sortAgentValidationIssues } from "./agent-validation-reporting";

const secretLikeKeyPattern = /\b(api[_-]?key|access[_-]?key|secret|token|password|authorization)\b\s*[:=]/i;
const credentialLikeValuePattern =
	/\b(sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{20,})\b/;
const privatePathHintPattern =
	/(^|[\s"'(])((\/Users\/[A-Za-z0-9._-]+)|(\/home\/[A-Za-z0-9._-]+)|([A-Za-z]:\\Users\\[^\\\s]+))/;
const markdownHeadingPattern = /^(#{1,6})\s+(.+?)\s*#*$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isFixtureSafetyEntry = (value: unknown): value is FixtureSafetyEntry =>
	isRecord(value) && typeof value.path === "string" && typeof value.content === "string";

const headingsByLine = (content: string): ReadonlyMap<number, string> => {
	const headings = new Map<number, string>();
	let currentHeading: string | undefined;

	for (const [lineIndex, line] of content.split(/\n/).entries()) {
		const headingMatch = line.match(markdownHeadingPattern);
		if (headingMatch?.[2] !== undefined) {
			currentHeading = headingMatch[2].trim();
		}

		if (currentHeading !== undefined) {
			headings.set(lineIndex + 1, currentHeading);
		}
	}

	return headings;
};

const issueForLine = (
	code: AgentValidationIssue["code"],
	path: string,
	lineNumber: number,
	heading: string | undefined,
	message: string,
	line: string,
): AgentValidationIssue => ({
	code,
	message,
	path,
	line: lineNumber,
	heading,
	excerpt: createRedactedLineExcerpt(line),
	remediation: "Replace the example with a clearly fake placeholder and keep examples under synthetic fixture paths.",
});

export const scanFixtureSafetyText = (path: string, content: string): FixtureSafetyReport => {
	if (path.trim().length === 0 || typeof content !== "string") {
		return {
			path,
			issues: [
				{
					code: "fixture.invalid-input",
					message: "Fixture safety scan requires a path and text content.",
					path,
					remediation:
						"Pass a repository-relative path and text content from an approved validation boundary.",
				},
			],
		};
	}

	const issues: AgentValidationIssue[] = [];
	const lines = content.split(/\n/);
	const headings = headingsByLine(content);

	for (const [lineIndex, line] of lines.entries()) {
		const lineNumber = lineIndex + 1;
		const heading = headings.get(lineNumber);

		if (secretLikeKeyPattern.test(line)) {
			issues.push(
				issueForLine(
					"fixture.secret-like-key",
					path,
					lineNumber,
					heading,
					"Secret-like key assignment found in fixture or example",
					line,
				),
			);
		}

		if (credentialLikeValuePattern.test(line)) {
			issues.push(
				issueForLine(
					"fixture.credential-like-value",
					path,
					lineNumber,
					heading,
					"Credential-like value found in fixture or example",
					line,
				),
			);
		}

		if (privatePathHintPattern.test(line)) {
			issues.push(
				issueForLine(
					"fixture.private-path-hint",
					path,
					lineNumber,
					heading,
					"Private local path hint found in fixture or example",
					line,
				),
			);
		}
	}

	return {
		path,
		issues: sortAgentValidationIssues(issues),
	};
};

export const scanFixtureSafetyTexts = (entries: readonly FixtureSafetyEntry[]): readonly FixtureSafetyReport[] =>
	entries.map((entry) => scanFixtureSafetyText(entry.path, entry.content));

export const validateFixtureSafetyEntries = (input: unknown): AgentValidationResult => {
	if (!Array.isArray(input) || !input.every(isFixtureSafetyEntry)) {
		return {
			ok: false,
			issues: [
				{
					code: "fixture.invalid-input",
					message: "Fixture safety validation expects an array of path/content entries.",
					path: "<input>",
					remediation: "Pass fixture safety entries shaped as { path, content }.",
				},
			],
		};
	}

	const reports = scanFixtureSafetyTexts(input);
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

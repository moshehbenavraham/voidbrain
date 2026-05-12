import {
	type FrontmatterPrimitive,
	type FrontmatterValue,
	type MarkdownHeading,
	type MarkdownParseFailure,
	type MarkdownParseIssue,
	type MarkdownParseResult,
	type MarkdownTag,
	type MarkdownTextChunk,
	type ParsedFrontmatter,
	type ParsedMarkdownNote,
	type ParsedWikilink,
	assertNeverRetrievalValue,
} from "../types/retrieval";
import { type NormalizedVaultPath, makeWikilink } from "../types/vault";
import { compareVaultPaths, normalizeVaultPath } from "../utils/vault-paths";

export const DEFAULT_CHUNK_MAX_CHARACTERS = 1_200;
export const DEFAULT_SNIPPET_MAX_CHARACTERS = 180;

export interface MarkdownParseOptions {
	readonly knownPaths?: readonly NormalizedVaultPath[];
	readonly pathAliases?: Readonly<Record<string, NormalizedVaultPath>>;
	readonly maxChunkCharacters?: number;
}

interface FrontmatterExtractionSuccess {
	readonly ok: true;
	readonly value: FrontmatterExtraction;
}

interface FrontmatterExtraction {
	readonly frontmatter: ParsedFrontmatter;
	readonly body: string;
	readonly bodyStartLine: number;
}

type HeadingWithMutableEnd = Omit<MarkdownHeading, "lineEnd"> & {
	lineEnd: number;
};

const success = (value: ParsedMarkdownNote): MarkdownParseResult => ({ ok: true, value });

const failure = (errors: readonly MarkdownParseIssue[]): MarkdownParseFailure => ({ ok: false, errors });

const parseIssue = (
	code: MarkdownParseIssue["code"],
	message: string,
	field?: string,
	line?: number,
): MarkdownParseIssue => ({
	code,
	message,
	...(field === undefined ? {} : { field }),
	...(line === undefined ? {} : { line }),
});

const normalizeLineEndings = (content: string): string => content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

const stableFingerprint = (content: string): string => {
	let hash = 0x811c9dc5;

	for (let index = 0; index < content.length; index += 1) {
		hash ^= content.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0).toString(16).padStart(8, "0");
};

const stripQuotes = (value: string): string => {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}

	return trimmed;
};

const parseScalar = (value: string): FrontmatterPrimitive => {
	const trimmed = stripQuotes(value);
	if (trimmed === "true") {
		return true;
	}
	if (trimmed === "false") {
		return false;
	}
	if (trimmed === "null") {
		return null;
	}
	if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}

	return trimmed;
};

const parseFrontmatterValue = (rawValue: string): FrontmatterValue => {
	const trimmed = rawValue.trim();
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		const inner = trimmed.slice(1, -1).trim();
		if (inner.length === 0) {
			return [];
		}

		return inner.split(",").map((item) => parseScalar(item));
	}

	return parseScalar(trimmed);
};

const extractFrontmatter = (content: string): FrontmatterExtractionSuccess | MarkdownParseFailure => {
	const lines = content.split("\n");
	if (lines[0]?.trim() !== "---") {
		return {
			ok: true,
			value: {
				frontmatter: {},
				body: content,
				bodyStartLine: 1,
			},
		};
	}

	const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (closingIndex === -1) {
		return failure([
			parseIssue("parse.invalid-frontmatter", "Frontmatter block is missing a closing fence.", "frontmatter", 1),
		]);
	}

	const frontmatter: Record<string, FrontmatterValue> = {};
	const errors: MarkdownParseIssue[] = [];
	for (let index = 1; index < closingIndex; index += 1) {
		const line = lines[index];
		if (line === undefined || line.trim().length === 0 || line.trim().startsWith("#")) {
			continue;
		}

		const separatorIndex = line.indexOf(":");
		if (separatorIndex <= 0) {
			errors.push(
				parseIssue(
					"parse.invalid-frontmatter",
					"Frontmatter entries must use `key: value` syntax.",
					"frontmatter",
					index + 1,
				),
			);
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		if (key.length === 0) {
			errors.push(
				parseIssue("parse.invalid-frontmatter", "Frontmatter key cannot be empty.", "frontmatter", index + 1),
			);
			continue;
		}

		frontmatter[key] = parseFrontmatterValue(line.slice(separatorIndex + 1));
	}

	if (errors.length > 0) {
		return failure(errors);
	}

	return {
		ok: true,
		value: {
			frontmatter,
			body: lines.slice(closingIndex + 1).join("\n"),
			bodyStartLine: closingIndex + 2,
		},
	};
};

const slugifyHeading = (heading: string): string =>
	heading
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9\s-]/g, "")
		.replaceAll(/\s+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-|-$/g, "");

const uniqueSlug = (slug: string, counts: Map<string, number>): string => {
	const count = counts.get(slug) ?? 0;
	counts.set(slug, count + 1);

	return count === 0 ? slug : `${slug}-${count + 1}`;
};

const extractHeadings = (
	body: string,
	path: NormalizedVaultPath,
	bodyStartLine: number,
): readonly MarkdownHeading[] => {
	const headings: HeadingWithMutableEnd[] = [];
	const slugCounts = new Map<string, number>();
	const lines = body.split("\n");

	for (const [index, line] of lines.entries()) {
		const match = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line.trim());
		if (match === null) {
			continue;
		}

		const level = match[1]?.length;
		const text = match[2]?.trim();
		if (
			level === undefined ||
			text === undefined ||
			(level !== 1 && level !== 2 && level !== 3 && level !== 4 && level !== 5 && level !== 6)
		) {
			continue;
		}

		const slug = uniqueSlug(slugifyHeading(text), slugCounts);
		const lineStart = bodyStartLine + index;
		const previousHeading = headings.at(-1);
		if (previousHeading !== undefined) {
			previousHeading.lineEnd = lineStart - 1;
		}

		headings.push({
			id: `${path}#${slug}`,
			path,
			level,
			text,
			slug,
			lineStart,
			lineEnd: bodyStartLine + lines.length - 1,
		});
	}

	return headings.map((heading) => ({ ...heading }));
};

const normalizeAliasKey = (target: string): string => target.trim().toLowerCase();

const resolveWikilinkPath = (target: string, options: MarkdownParseOptions): NormalizedVaultPath | undefined => {
	const directPath = target.includes("/") || target.endsWith(".md") ? normalizeVaultPath(target) : undefined;
	if (directPath?.ok) {
		return directPath.value;
	}

	return options.pathAliases?.[normalizeAliasKey(target)];
};

const wikilinkStatus = (
	targetPath: NormalizedVaultPath | undefined,
	options: MarkdownParseOptions,
): ParsedWikilink["status"] => {
	if (targetPath === undefined) {
		return options.pathAliases === undefined ? "unknown" : "missing";
	}

	if (options.knownPaths === undefined) {
		return "unknown";
	}

	return options.knownPaths.includes(targetPath) ? "resolved" : "missing";
};

const extractWikilinks = (
	body: string,
	bodyStartLine: number,
	options: MarkdownParseOptions,
): readonly ParsedWikilink[] => {
	const wikilinks: ParsedWikilink[] = [];
	const lines = body.split("\n");

	for (const [index, line] of lines.entries()) {
		const matches = line.matchAll(/\[\[([^\]]+)\]\]/g);
		for (const match of matches) {
			const rawTarget = match[1]?.trim();
			if (rawTarget === undefined || rawTarget.length === 0) {
				continue;
			}

			const [targetWithHeading, alias] = rawTarget.split("|", 2);
			const [target, heading] = (targetWithHeading ?? "").split("#", 2);
			const trimmedTarget = (target ?? "").trim();
			const targetPath = resolveWikilinkPath(trimmedTarget, options);
			wikilinks.push({
				raw: makeWikilink(rawTarget),
				target: trimmedTarget,
				...(targetPath === undefined ? {} : { targetPath }),
				...(heading === undefined || heading.trim().length === 0 ? {} : { heading: heading.trim() }),
				...(alias === undefined || alias.trim().length === 0 ? {} : { alias: alias.trim() }),
				status: wikilinkStatus(targetPath, options),
				line: bodyStartLine + index,
			});
		}
	}

	return wikilinks;
};

const normalizeTag = (tag: string): string => tag.replace(/^#/, "").trim().toLowerCase();

const tagsFromFrontmatter = (frontmatter: ParsedFrontmatter): readonly MarkdownTag[] => {
	const rawTags = frontmatter.tags;
	const values = Array.isArray(rawTags) ? rawTags : rawTags === undefined ? [] : [rawTags];

	return values
		.filter((tag): tag is string => typeof tag === "string" && normalizeTag(tag).length > 0)
		.map((tag) => ({
			value: normalizeTag(tag),
			source: "frontmatter" as const,
		}));
};

const extractInlineTags = (body: string, bodyStartLine: number): readonly MarkdownTag[] => {
	const tags: MarkdownTag[] = [];
	const lines = body.split("\n");

	for (const [index, line] of lines.entries()) {
		const matches = line.matchAll(/(^|[\s(])#([A-Za-z][A-Za-z0-9/_-]*)/g);
		for (const match of matches) {
			const value = match[2];
			if (value !== undefined) {
				tags.push({
					value: normalizeTag(value),
					source: "inline",
					line: bodyStartLine + index,
				});
			}
		}
	}

	return tags;
};

const dedupeTags = (tags: readonly MarkdownTag[]): readonly MarkdownTag[] => {
	const seen = new Set<string>();
	const deduped: MarkdownTag[] = [];

	for (const tag of tags) {
		const key = `${tag.source}:${tag.value}:${tag.line ?? 0}`;
		if (!seen.has(key)) {
			seen.add(key);
			deduped.push(tag);
		}
	}

	return deduped.sort((left, right) => {
		const lineComparison = (left.line ?? 0) - (right.line ?? 0);
		if (lineComparison !== 0) {
			return lineComparison;
		}

		return left.value.localeCompare(right.value, "en", { sensitivity: "base" });
	});
};

const cleanMarkdownText = (text: string): string =>
	text
		.replaceAll(
			/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
			(_match, target: string, alias?: string) => alias ?? target,
		)
		.replaceAll(/^#{1,6}\s+/gm, "")
		.replaceAll(/^\s*[-*]\s+/gm, "")
		.replaceAll(/[`*_>]/g, "")
		.replaceAll(/\s+/g, " ")
		.trim();

const normalizeSourcePaths = (
	frontmatter: ParsedFrontmatter,
	fallbackPath: NormalizedVaultPath,
): readonly NormalizedVaultPath[] => {
	const rawSourcePaths = frontmatter["source-paths"];
	const rawValues = Array.isArray(rawSourcePaths) ? rawSourcePaths : [];
	const paths = rawValues.flatMap((value) => {
		if (typeof value !== "string") {
			return [];
		}

		const normalized = normalizeVaultPath(value);
		return normalized.ok ? [normalized.value] : [];
	});

	return paths.length > 0 ? [...paths].sort(compareVaultPaths) : [fallbackPath];
};

const chunkId = (path: NormalizedVaultPath, heading: MarkdownHeading | undefined, index: number): string => {
	if (heading === undefined) {
		return `${path}#chunk-${index + 1}`;
	}

	return `${heading.id}:chunk-${index + 1}`;
};

export const createSnippet = (
	text: string,
	queryTokens: readonly string[] = [],
	maxCharacters = DEFAULT_SNIPPET_MAX_CHARACTERS,
): string => {
	const cleaned = cleanMarkdownText(text);
	if (cleaned.length <= maxCharacters) {
		return cleaned;
	}

	const lowered = cleaned.toLowerCase();
	const firstMatch = queryTokens
		.map((token) => lowered.indexOf(token.toLowerCase()))
		.filter((index) => index >= 0)
		.sort((left, right) => left - right)[0];
	const midpoint = firstMatch ?? 0;
	const start = Math.max(0, midpoint - Math.floor(maxCharacters / 3));
	const end = Math.min(cleaned.length, start + maxCharacters);
	const snippet = cleaned.slice(start, end).trim();

	if (start === 0) {
		return `${snippet}...`;
	}
	if (end >= cleaned.length) {
		return `...${snippet}`;
	}

	return `...${snippet}...`;
};

export const extractMarkdownChunks = (
	path: NormalizedVaultPath,
	body: string,
	headings: readonly MarkdownHeading[],
	frontmatter: ParsedFrontmatter,
	bodyStartLine: number,
	maxCharacters = DEFAULT_CHUNK_MAX_CHARACTERS,
): readonly MarkdownTextChunk[] => {
	const sourcePaths = normalizeSourcePaths(frontmatter, path);
	const lines = body.split("\n");
	const chunks: MarkdownTextChunk[] = [];
	const sortedHeadings = [...headings].sort((left, right) => left.lineStart - right.lineStart);
	const ranges =
		sortedHeadings.length === 0
			? [{ heading: undefined, startLine: bodyStartLine, endLine: bodyStartLine + lines.length - 1 }]
			: sortedHeadings.map((heading) => ({
					heading,
					startLine: heading.lineStart,
					endLine: heading.lineEnd,
				}));

	for (const [rangeIndex, range] of ranges.entries()) {
		const startIndex = Math.max(0, range.startLine - bodyStartLine);
		const endIndex = Math.min(lines.length - 1, range.endLine - bodyStartLine);
		const rangeLines = lines.slice(startIndex, endIndex + 1);
		const cleaned = cleanMarkdownText(rangeLines.join("\n"));
		if (cleaned.length === 0) {
			continue;
		}

		const segments: string[] = [];
		for (let index = 0; index < cleaned.length; index += maxCharacters) {
			segments.push(cleaned.slice(index, index + maxCharacters).trim());
		}

		for (const [segmentIndex, segment] of segments.entries()) {
			if (segment.length === 0) {
				continue;
			}

			const idOffset = chunks.length;
			chunks.push({
				id: chunkId(path, range.heading, idOffset),
				path,
				...(range.heading === undefined
					? {}
					: { heading: range.heading.text, headingLevel: range.heading.level }),
				startLine: range.startLine,
				endLine: range.endLine,
				text: segment,
				sourcePaths,
			});
			if (segmentIndex > 0) {
				const previous = chunks.at(-1);
				if (previous !== undefined) {
					chunks[chunks.length - 1] = {
						...previous,
						id: `${previous.id}-part-${segmentIndex + 1}`,
					};
				}
			}
		}
	}

	return chunks;
};

export const parseMarkdownNote = (
	pathInput: unknown,
	contentInput: unknown,
	options: MarkdownParseOptions = {},
): MarkdownParseResult => {
	const normalizedPath = normalizeVaultPath(pathInput);
	if (!normalizedPath.ok) {
		return failure(
			normalizedPath.errors.map((error) =>
				parseIssue("parse.invalid-path", error.message, error.field, undefined),
			),
		);
	}

	if (typeof contentInput !== "string") {
		return failure([parseIssue("parse.invalid-content", "Markdown content must be a string.", "content")]);
	}

	const content = normalizeLineEndings(contentInput);
	const extracted = extractFrontmatter(content);
	if (!extracted.ok) {
		return extracted;
	}

	const { body, bodyStartLine, frontmatter } = extracted.value;
	const headings = extractHeadings(body, normalizedPath.value, bodyStartLine);
	const tags = dedupeTags([...tagsFromFrontmatter(frontmatter), ...extractInlineTags(body, bodyStartLine)]);
	const chunks = extractMarkdownChunks(
		normalizedPath.value,
		body,
		headings,
		frontmatter,
		bodyStartLine,
		options.maxChunkCharacters,
	);

	return success({
		path: normalizedPath.value,
		frontmatter,
		body,
		headings,
		wikilinks: extractWikilinks(body, bodyStartLine, options),
		tags,
		chunks,
		contentFingerprint: stableFingerprint(content),
	});
};

export const headingLevelWeight = (level: MarkdownHeading["level"]): number => {
	switch (level) {
		case 1:
			return 6;
		case 2:
			return 5;
		case 3:
			return 4;
		case 4:
			return 3;
		case 5:
			return 2;
		case 6:
			return 1;
		default:
			return assertNeverRetrievalValue(level);
	}
};

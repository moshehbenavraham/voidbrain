import type {
	SourceCitationEvidence,
	SourceIngestionGeneratedArtifact,
	SourceIngestionGeneratedConceptArtifact,
	SourceIngestionGeneratedEntityArtifact,
	SourceIngestionGeneratedSourceArtifact,
	SourceIngestionGeneratedSummaryArtifact,
	SourceIngestionPreview,
} from "../types/ingestion";
import type { ConceptType, EntityType, IsoTimestamp, NormalizedVaultPath } from "../types/vault";

export interface SourceIngestionExtractionCandidate {
	readonly entities: readonly string[];
	readonly concepts: readonly string[];
	readonly summarySentences: readonly string[];
	readonly excerpt: string;
}

export interface RenderSourceIngestionArtifactsInput {
	readonly preview: SourceIngestionPreview;
	readonly extraction: SourceIngestionExtractionCandidate;
	readonly createdAt: IsoTimestamp;
}

type FrontmatterValue = string | number | boolean | null | readonly (string | number | boolean | null)[];

export const toAsciiText = (value: string): string =>
	Array.from(value)
		.map((character) => {
			if (character === "\n" || character === "\t") {
				return character;
			}
			const code = character.charCodeAt(0);
			if (code >= 32 && code <= 126) {
				return character;
			}

			return "?";
		})
		.join("");

const normalizeWhitespace = (value: string): string => toAsciiText(value).replaceAll(/\s+/g, " ").trim();

const yamlScalar = (value: string | number | boolean | null): string => {
	if (value === null) {
		return "null";
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	return JSON.stringify(toAsciiText(value));
};

const renderFrontmatter = (frontmatter: Readonly<Record<string, FrontmatterValue>>): string => {
	const lines = ["---"];
	for (const [key, value] of Object.entries(frontmatter)) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) {
				lines.push(`  - ${yamlScalar(item)}`);
			}
			continue;
		}

		lines.push(`${key}: ${yamlScalar(value as string | number | boolean | null)}`);
	}
	lines.push("---", "");
	return lines.join("\n");
};

const wikilinkForPath = (path: NormalizedVaultPath, label: string): string => {
	const notePath = String(path).replace(/\.md$/u, "");
	return `[[${notePath}|${toAsciiText(label)}]]`;
};

const citationLines = (citations: readonly SourceCitationEvidence[]): string[] =>
	citations.map((citation) => `- ${citation.citationId}: ${citation.sourcePath}`);

const firstSentence = (value: string): string => {
	const normalized = normalizeWhitespace(value);
	const sentence = normalized.split(/(?<=[.!?])\s+/u)[0] ?? normalized;
	return sentence.slice(0, 220);
};

const artifactTitle = (title: string, fallback: string): string => {
	const normalized = normalizeWhitespace(title);
	return normalized.length > 0 ? normalized : fallback;
};

const renderSourceArtifact = (input: RenderSourceIngestionArtifactsInput): SourceIngestionGeneratedSourceArtifact => {
	const citation = input.preview.citationEvidence[0];
	if (citation === undefined) {
		throw new Error("Source ingestion renderer requires source citation evidence.");
	}

	const markdown = [
		renderFrontmatter({
			"voidbrain-id": `source-${input.preview.contentSha256.slice(0, 12)}`,
			"artifact-kind": "source",
			"created-at": input.createdAt,
			"updated-at": input.createdAt,
			"source-paths": [input.preview.sourcePath],
			tags: ["voidbrain/source", "source-ingestion"],
			title: input.preview.title,
			"source-type": input.preview.sourceType,
			...(input.preview.sourceUrl === undefined ? {} : { "source-url": input.preview.sourceUrl }),
			"external-id": `source-record-${input.preview.contentSha256.slice(0, 12)}`,
		}),
		`# ${toAsciiText(input.preview.title)}`,
		"",
		`Source path: ${input.preview.sourcePath}`,
		`Source record: source-record-${input.preview.contentSha256.slice(0, 12)}`,
		`Citation: ${citation.citationId} ${citation.sourcePath}`,
		"",
		"## Extracted Notes",
		"",
		input.extraction.excerpt.length > 0 ? firstSentence(input.extraction.excerpt) : "No excerpt was extracted.",
		"",
		"## Citations",
		"",
		...citationLines(input.preview.citationEvidence),
		"",
	].join("\n");

	return {
		artifactKind: "source",
		markdownArtifactKind: "source",
		targetPath: input.preview.targetPaths.source,
		title: input.preview.title,
		sourceType: input.preview.sourceType,
		...(input.preview.sourceUrl === undefined ? {} : { sourceUrl: input.preview.sourceUrl }),
		sourcePaths: [input.preview.sourcePath],
		citations: input.preview.citationEvidence,
		markdown: toAsciiText(markdown),
	};
};

const renderEntityArtifact = (
	input: RenderSourceIngestionArtifactsInput,
	title: string,
	targetPath: NormalizedVaultPath,
): SourceIngestionGeneratedEntityArtifact => {
	const entityTitle = artifactTitle(title, `${input.preview.title} Entity`);
	const markdown = [
		renderFrontmatter({
			"voidbrain-id": `entity-${String(targetPath)
				.replaceAll(/[^a-z0-9]+/gi, "-")
				.toLowerCase()}`,
			"artifact-kind": "entity",
			"created-at": input.createdAt,
			"updated-at": input.createdAt,
			"source-paths": [input.preview.sourcePath],
			tags: ["voidbrain/entity", "source-ingestion"],
			title: entityTitle,
			"entity-type": "other" satisfies EntityType,
			aliases: [entityTitle],
		}),
		`# ${toAsciiText(entityTitle)}`,
		"",
		`Source: ${wikilinkForPath(input.preview.targetPaths.source, input.preview.title)}`,
		`Citation: ${input.preview.citationEvidence[0]?.citationId ?? "source"} ${input.preview.sourcePath}`,
		"",
		"## Evidence",
		"",
		...citationLines(input.preview.citationEvidence),
		"",
	].join("\n");

	return {
		artifactKind: "entity",
		markdownArtifactKind: "entity",
		targetPath,
		title: entityTitle,
		entityType: "other",
		aliases: [entityTitle],
		sourcePaths: [input.preview.sourcePath],
		citations: input.preview.citationEvidence,
		markdown: toAsciiText(markdown),
	};
};

const renderConceptArtifact = (
	input: RenderSourceIngestionArtifactsInput,
	title: string,
	targetPath: NormalizedVaultPath,
): SourceIngestionGeneratedConceptArtifact => {
	const conceptTitle = artifactTitle(title, `${input.preview.title} Topic`);
	const markdown = [
		renderFrontmatter({
			"voidbrain-id": `concept-${String(targetPath)
				.replaceAll(/[^a-z0-9]+/gi, "-")
				.toLowerCase()}`,
			"artifact-kind": "concept",
			"created-at": input.createdAt,
			"updated-at": input.createdAt,
			"source-paths": [input.preview.sourcePath],
			tags: ["voidbrain/concept", "source-ingestion"],
			title: conceptTitle,
			"concept-type": "topic" satisfies ConceptType,
			aliases: [conceptTitle],
			"related-notes": [input.preview.targetPaths.source],
		}),
		`# ${toAsciiText(conceptTitle)}`,
		"",
		`Source: ${wikilinkForPath(input.preview.targetPaths.source, input.preview.title)}`,
		`Citation: ${input.preview.citationEvidence[0]?.citationId ?? "source"} ${input.preview.sourcePath}`,
		"",
		"## Evidence",
		"",
		...citationLines(input.preview.citationEvidence),
		"",
	].join("\n");

	return {
		artifactKind: "concept",
		markdownArtifactKind: "concept",
		targetPath,
		title: conceptTitle,
		conceptType: "topic",
		aliases: [conceptTitle],
		relatedNotes: [input.preview.targetPaths.source],
		sourcePaths: [input.preview.sourcePath],
		citations: input.preview.citationEvidence,
		markdown: toAsciiText(markdown),
	};
};

const renderSummaryArtifact = (input: RenderSourceIngestionArtifactsInput): SourceIngestionGeneratedSummaryArtifact => {
	const summaryTitle = `${input.preview.title} Summary`;
	const summaryLines =
		input.extraction.summarySentences.length === 0
			? [`- ${firstSentence(input.extraction.excerpt)}`]
			: input.extraction.summarySentences.map((sentence) => `- ${firstSentence(sentence)}`);
	const summaryCitationIds = input.preview.citationEvidence.map((citation) => citation.citationId);
	const markdown = [
		renderFrontmatter({
			"voidbrain-id": `summary-${input.preview.contentSha256.slice(0, 12)}`,
			"artifact-kind": "summary",
			"created-at": input.createdAt,
			"updated-at": input.createdAt,
			"source-paths": [input.preview.sourcePath],
			tags: ["voidbrain/summary", "source-ingestion"],
			title: summaryTitle,
			"summary-type": "source-summary",
			"summary-of": input.preview.targetPaths.source,
			citations: summaryCitationIds,
		}),
		`# ${toAsciiText(summaryTitle)}`,
		"",
		`Summary of: ${wikilinkForPath(input.preview.targetPaths.source, input.preview.title)}`,
		"",
		"## Summary",
		"",
		...summaryLines,
		"",
		"## Citations",
		"",
		...citationLines(input.preview.citationEvidence),
		"",
	].join("\n");

	return {
		artifactKind: "summary",
		markdownArtifactKind: "summary",
		targetPath: input.preview.targetPaths.summary,
		title: summaryTitle,
		summaryType: "source-summary",
		summaryOf: input.preview.targetPaths.source,
		summaryCitations: summaryCitationIds,
		sourcePaths: [input.preview.sourcePath],
		citations: input.preview.citationEvidence,
		markdown: toAsciiText(markdown),
	};
};

export const renderSourceIngestionArtifacts = (
	input: RenderSourceIngestionArtifactsInput,
): readonly SourceIngestionGeneratedArtifact[] => {
	const entityArtifacts = input.preview.targetPaths.entities.map((targetPath, index) =>
		renderEntityArtifact(input, input.extraction.entities[index] ?? `${input.preview.title} Entity`, targetPath),
	);
	const conceptArtifacts = input.preview.targetPaths.concepts.map((targetPath, index) =>
		renderConceptArtifact(input, input.extraction.concepts[index] ?? `${input.preview.title} Topic`, targetPath),
	);

	return [renderSourceArtifact(input), ...entityArtifacts, ...conceptArtifacts, renderSummaryArtifact(input)];
};

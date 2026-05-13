import type {
	SourceCitationEvidence,
	SourceIngestionGeneratedArtifact,
	SourceIngestionValidationOutput,
} from "../types/ingestion";
import type { NormalizedVaultPath, ValidationIssue, ValidationResult } from "../types/vault";
import { normalizeVaultPath, validateArtifactPath } from "../utils/vault-paths";

const success = <TValue>(value: TValue): ValidationResult<TValue> => ({ ok: true, value });

const failure = (errors: readonly ValidationIssue[]): ValidationResult<never> => ({ ok: false, errors });

const issue = (
	code: ValidationIssue["code"],
	message: string,
	field?: string,
	path?: NormalizedVaultPath | string,
): ValidationIssue => ({
	code,
	message,
	...(field === undefined ? {} : { field }),
	...(path === undefined ? {} : { path }),
});

const targetArtifactKind = (artifact: SourceIngestionGeneratedArtifact) => {
	switch (artifact.artifactKind) {
		case "source":
			return "source";
		case "entity":
			return "entity";
		case "concept":
			return "concept";
		case "summary":
			return "summary";
		default: {
			const exhaustive: never = artifact;
			throw new Error(`Unhandled ingestion artifact kind: ${String(exhaustive)}`);
		}
	}
};

const isAsciiText = (value: string): boolean => Array.from(value).every((character) => character.charCodeAt(0) <= 127);

export const validateSourceCitationEvidence = (
	citations: readonly SourceCitationEvidence[],
): ValidationResult<readonly SourceCitationEvidence[]> => {
	const errors: ValidationIssue[] = [];

	if (citations.length === 0) {
		errors.push(
			issue(
				"metadata.missing-source-trace",
				"Generated ingestion artifacts require at least one source citation.",
				"citations",
			),
		);
	}

	for (const [index, citation] of citations.entries()) {
		if (citation.citationId.trim().length === 0) {
			errors.push(
				issue(
					"metadata.invalid-type",
					"Citation ID must be a non-empty string.",
					`citations[${index}].citationId`,
				),
			);
		}

		const sourcePath = normalizeVaultPath(citation.sourcePath);
		if (!sourcePath.ok) {
			errors.push(...sourcePath.errors.map((error) => ({ ...error, field: `citations[${index}].sourcePath` })));
		}
	}

	return errors.length === 0 ? success(citations) : failure(errors);
};

const validateArtifact = (artifact: SourceIngestionGeneratedArtifact): readonly ValidationIssue[] => {
	const errors: ValidationIssue[] = [];
	const targetPath = validateArtifactPath(artifact.targetPath, targetArtifactKind(artifact));
	if (!targetPath.ok) {
		errors.push(...targetPath.errors);
	}

	if (artifact.sourcePaths.length === 0) {
		errors.push(
			issue(
				"metadata.missing-source-trace",
				"Generated ingestion artifact must include source paths.",
				"sourcePaths",
				artifact.targetPath,
			),
		);
	}

	for (const [index, sourcePath] of artifact.sourcePaths.entries()) {
		const normalized = normalizeVaultPath(sourcePath);
		if (!normalized.ok) {
			errors.push(...normalized.errors.map((error) => ({ ...error, field: `sourcePaths[${index}]` })));
		}
	}

	const citationResult = validateSourceCitationEvidence(artifact.citations);
	if (!citationResult.ok) {
		errors.push(...citationResult.errors.map((error) => ({ ...error, path: artifact.targetPath })));
	}

	for (const citation of artifact.citations) {
		if (!artifact.sourcePaths.includes(citation.sourcePath)) {
			errors.push(
				issue(
					"metadata.missing-source-trace",
					"Citation source path must be listed in artifact source paths.",
					"citations",
					artifact.targetPath,
				),
			);
		}
		if (!artifact.markdown.includes(citation.citationId) || !artifact.markdown.includes(citation.sourcePath)) {
			errors.push(
				issue(
					"metadata.missing-source-trace",
					"Generated markdown must include citation ID and source path.",
					"markdown",
					artifact.targetPath,
				),
			);
		}
	}

	if (artifact.artifactKind === "summary" && artifact.summaryCitations.length === 0) {
		errors.push(
			issue(
				"metadata.missing-source-trace",
				"Summary artifacts require summary citation IDs.",
				"summaryCitations",
				artifact.targetPath,
			),
		);
	}

	if (!isAsciiText(artifact.markdown)) {
		errors.push(
			issue("metadata.invalid-type", "Generated markdown must be ASCII-only.", "markdown", artifact.targetPath),
		);
	}

	return errors;
};

export const validateGeneratedIngestionArtifacts = (
	artifacts: readonly SourceIngestionGeneratedArtifact[],
): SourceIngestionValidationOutput => {
	const issues = artifacts.flatMap(validateArtifact);
	const checkedArtifactPaths = artifacts
		.map((artifact) => artifact.targetPath)
		.sort((left, right) => left.localeCompare(right));

	return {
		ok: issues.length === 0,
		issues,
		checkedArtifactPaths,
	};
};

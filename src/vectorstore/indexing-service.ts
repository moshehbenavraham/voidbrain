import type {
	IndexJobOptions,
	IndexJobResult,
	IndexProgressSnapshot,
	LexicalIndexSnapshot,
	ParsedMarkdownNote,
} from "../types/retrieval";
import { type NormalizedVaultPath, makeNormalizedVaultPath } from "../types/vault";
import {
	cancelProgressSnapshot,
	completeProgressSnapshot,
	createProgressSnapshot,
	failProgressSnapshot,
	updateProgressSnapshot,
} from "./index-state";
import { buildLexicalIndex } from "./lexical-index";
import { type MarkdownParseOptions, parseMarkdownNote } from "./markdown-parser";

export interface IndexableMarkdownNote {
	readonly path: NormalizedVaultPath | string;
	readonly content: string;
}

export interface IndexingServiceHooks {
	readonly beforeNote?: (note: IndexableMarkdownNote) => void | Promise<void>;
}

export interface IndexingServiceOptions {
	readonly parseOptions?: MarkdownParseOptions;
	readonly hooks?: IndexingServiceHooks;
}

export interface BuildLexicalIndexJobInput extends Omit<IndexJobOptions, "now"> {
	readonly notes: readonly IndexableMarkdownNote[];
	readonly now?: () => Date;
}

const defaultNow = (): Date => new Date();

export class FixtureIndexingService {
	private readonly inFlightIndexIds = new Set<string>();

	public constructor(private readonly options: IndexingServiceOptions = {}) {}

	public async buildLexicalIndexJob(input: BuildLexicalIndexJobInput): Promise<IndexJobResult<LexicalIndexSnapshot>> {
		const now = input.now ?? defaultNow;
		const initialProgress = createProgressSnapshot({
			jobId: input.jobId,
			indexId: input.indexId,
			status: "building",
			totalNotes: input.notes.length,
			indexedNotes: 0,
			now: now(),
		});

		if (this.inFlightIndexIds.has(input.indexId)) {
			const progress = failProgressSnapshot(
				initialProgress,
				`Index ${input.indexId} already has a build in flight.`,
				now(),
			);
			return {
				ok: false,
				status: "error",
				message: progress.errorMessage ?? "Index build already in flight.",
				progress,
			};
		}

		this.inFlightIndexIds.add(input.indexId);
		input.onProgress?.(initialProgress);
		let progress: IndexProgressSnapshot = initialProgress;

		try {
			const parsedNotes: ParsedMarkdownNote[] = [];
			for (const note of input.notes) {
				if (input.signal?.aborted === true) {
					progress = cancelProgressSnapshot(progress, now());
					input.onProgress?.(progress);
					return {
						ok: false,
						status: "canceled",
						message: "Index build was canceled before parsing completed.",
						progress,
					};
				}

				await this.options.hooks?.beforeNote?.(note);

				const parsed = parseMarkdownNote(note.path, note.content, this.options.parseOptions);
				if (!parsed.ok) {
					const message = parsed.errors.map((error) => error.message).join("; ");
					progress = failProgressSnapshot(progress, message, now());
					input.onProgress?.(progress);
					return {
						ok: false,
						status: "error",
						message,
						progress,
					};
				}

				parsedNotes.push(parsed.value);
				progress = updateProgressSnapshot(
					progress,
					{
						indexedNotes: parsedNotes.length,
						currentPath: parsed.value.path,
					},
					now(),
				);
				input.onProgress?.(progress);
			}

			const built = buildLexicalIndex({
				indexId: input.indexId,
				notes: parsedNotes,
				builtAt: now(),
				...(input.signal === undefined ? {} : { signal: input.signal }),
			});

			if (!built.ok) {
				progress = cancelProgressSnapshot(progress, now());
				input.onProgress?.(progress);
				return {
					ok: false,
					status: "canceled",
					message: built.message,
					progress,
				};
			}

			progress = completeProgressSnapshot(progress, now());
			input.onProgress?.(progress);
			return {
				ok: true,
				status: "ready",
				index: built.index,
				progress,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Index build failed for an unknown reason.";
			progress = failProgressSnapshot(progress, message, now());
			input.onProgress?.(progress);
			return {
				ok: false,
				status: "error",
				message,
				progress,
			};
		} finally {
			this.inFlightIndexIds.delete(input.indexId);
		}
	}
}

export const createIndexableMarkdownNote = (path: string, content: string): IndexableMarkdownNote => ({
	path: makeNormalizedVaultPath(path),
	content,
});

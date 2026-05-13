import {
	INGESTION_QUEUE_STATE_SCHEMA_VERSION,
	type SourceIngestionQueueStatusInput,
	type SourceIngestionQueueStoreState,
	type SourceIngestionQueueStoreSubscriber,
	type SourceIngestionQueueStoreUnsubscribe,
	type SourceIngestionQueueSummary,
} from "../types/ingestion-queue";
import type { IsoTimestamp } from "../types/vault";
import { makeIsoTimestamp } from "../types/vault";

export interface PersistedIngestionQueueState {
	readonly schemaVersion: typeof INGESTION_QUEUE_STATE_SCHEMA_VERSION;
	readonly status: SourceIngestionQueueStoreState["status"];
	readonly draftItemCount: number;
	readonly summary: SourceIngestionQueueSummary | null;
	readonly lastFailureMessage: string | null;
	readonly updatedAt: IsoTimestamp;
}

export interface IngestionQueuePersistenceAdapter {
	readonly save: (state: PersistedIngestionQueueState) => Promise<void>;
}

export interface IngestionQueueStore {
	readonly getState: () => SourceIngestionQueueStoreState;
	readonly getStatusInput: () => SourceIngestionQueueStatusInput;
	readonly subscribe: (subscriber: SourceIngestionQueueStoreSubscriber) => SourceIngestionQueueStoreUnsubscribe;
	readonly setDraftItemCount: (count: number) => Promise<void>;
	readonly beginRun: () => Promise<void>;
	readonly applySummary: (summary: SourceIngestionQueueSummary) => Promise<void>;
	readonly requestCancel: () => Promise<void>;
	readonly setFailure: (message: string) => Promise<void>;
	readonly reset: () => Promise<void>;
	readonly clear: () => void;
}

export interface CreateIngestionQueueStoreOptions {
	readonly initialState?: SourceIngestionQueueStoreState;
	readonly initialPersistedState?: PersistedIngestionQueueState;
	readonly now?: () => Date;
	readonly persistence?: IngestionQueuePersistenceAdapter;
}

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const createInitialState = (now: Date): SourceIngestionQueueStoreState => ({
	schemaVersion: INGESTION_QUEUE_STATE_SCHEMA_VERSION,
	status: "idle",
	draftItemCount: 0,
	summary: null,
	lastFailureMessage: null,
	isWriteInFlight: false,
	updatedAt: toIsoTimestamp(now),
});

export const toPersistedIngestionQueueState = (
	state: SourceIngestionQueueStoreState,
): PersistedIngestionQueueState => ({
	schemaVersion: INGESTION_QUEUE_STATE_SCHEMA_VERSION,
	status: state.status,
	draftItemCount: state.draftItemCount,
	summary: state.summary,
	lastFailureMessage: state.lastFailureMessage,
	updatedAt: state.updatedAt,
});

const recoverPersistedState = (persisted: PersistedIngestionQueueState, now: Date): SourceIngestionQueueStoreState => {
	if (persisted.status === "running" || persisted.status === "canceling" || persisted.status === "queued") {
		return {
			...persisted,
			status: "failed",
			lastFailureMessage:
				persisted.lastFailureMessage ??
				"Source ingestion queue was interrupted before completion. No generated notes were applied.",
			isWriteInFlight: false,
			updatedAt: toIsoTimestamp(now),
		};
	}

	return {
		...persisted,
		isWriteInFlight: false,
		updatedAt: toIsoTimestamp(now),
	};
};

const isRunningStatus = (status: SourceIngestionQueueStoreState["status"]): boolean =>
	status === "queued" || status === "running" || status === "canceling";

export const createIngestionQueueStore = (options: CreateIngestionQueueStoreOptions = {}): IngestionQueueStore => {
	const now = options.now ?? (() => new Date());
	let state =
		options.initialState ??
		(options.initialPersistedState === undefined
			? undefined
			: recoverPersistedState(options.initialPersistedState, now())) ??
		createInitialState(now());
	const subscribers = new Set<SourceIngestionQueueStoreSubscriber>();

	const notify = (): void => {
		for (const subscriber of subscribers) {
			subscriber(state);
		}
	};

	const commit = async (nextState: SourceIngestionQueueStoreState): Promise<void> => {
		const previousState = state;
		state = nextState;
		notify();

		try {
			await options.persistence?.save(toPersistedIngestionQueueState(state));
		} catch {
			state = {
				...previousState,
				status: "failed",
				lastFailureMessage: "Source ingestion queue state could not be persisted. No vault files were changed.",
				isWriteInFlight: false,
				updatedAt: toIsoTimestamp(now()),
			};
			notify();
		}
	};

	return {
		getState: () => state,
		getStatusInput: () => ({
			summary: state.summary,
			...(state.lastFailureMessage === null ? {} : { lastFailureMessage: state.lastFailureMessage }),
			isRunning: state.isWriteInFlight || isRunningStatus(state.status),
		}),
		subscribe: (subscriber) => {
			subscribers.add(subscriber);
			subscriber(state);
			return () => {
				subscribers.delete(subscriber);
			};
		},
		setDraftItemCount: (count) =>
			commit({
				...state,
				status: count > 0 && state.status === "idle" ? "queued" : state.status,
				draftItemCount: Math.max(0, Math.trunc(count)),
				updatedAt: toIsoTimestamp(now()),
			}),
		beginRun: () =>
			commit({
				...state,
				status: "running",
				lastFailureMessage: null,
				isWriteInFlight: true,
				updatedAt: toIsoTimestamp(now()),
			}),
		applySummary: (summary) =>
			commit({
				...state,
				status: summary.status,
				draftItemCount: summary.counts.total,
				summary,
				lastFailureMessage:
					summary.status === "failed"
						? (summary.validationOutput[0]?.message ?? "Source ingestion queue failed.")
						: null,
				isWriteInFlight: isRunningStatus(summary.status),
				updatedAt: toIsoTimestamp(now()),
			}),
		requestCancel: () =>
			commit({
				...state,
				status: "canceling",
				isWriteInFlight: true,
				updatedAt: toIsoTimestamp(now()),
			}),
		setFailure: (message) =>
			commit({
				...state,
				status: "failed",
				lastFailureMessage: message,
				isWriteInFlight: false,
				updatedAt: toIsoTimestamp(now()),
			}),
		reset: () => commit(createInitialState(now())),
		clear: () => {
			subscribers.clear();
			state = createInitialState(now());
		},
	};
};

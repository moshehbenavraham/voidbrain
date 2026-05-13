import type {
	HotCacheCaptureResult,
	HotCacheRestoreResult,
	HotCacheSessionSummaryResult,
	HotCacheStatusInput,
	HotCacheStoreState,
	HotCacheStoreSubscriber,
	HotCacheStoreUnsubscribe,
} from "../types/hot-cache";
import type { HotCacheState, IsoTimestamp, NormalizedVaultPath } from "../types/vault";
import { makeIsoTimestamp } from "../types/vault";
import { HOT_CACHE_SUPPORT_PATH } from "../utils/vault-paths";

export interface HotCacheStore {
	readonly getState: () => HotCacheStoreState;
	readonly getStatusInput: () => HotCacheStatusInput;
	readonly subscribe: (subscriber: HotCacheStoreSubscriber) => HotCacheStoreUnsubscribe;
	readonly beginCapture: () => boolean;
	readonly applyCaptureResult: (result: HotCacheCaptureResult) => void;
	readonly applyRestoreResult: (result: HotCacheRestoreResult) => void;
	readonly beginSummaryStaging: () => boolean;
	readonly applySummaryResult: (result: HotCacheSessionSummaryResult) => void;
	readonly setPersisted: (state: HotCacheState) => void;
	readonly setFailure: (message: string) => void;
	readonly setOffline: () => void;
	readonly reset: () => void;
	readonly clear: () => void;
}

export interface CreateHotCacheStoreOptions {
	readonly initialState?: HotCacheStoreState;
	readonly cachePath?: NormalizedVaultPath;
	readonly now?: () => Date;
}

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const createInitialState = (now: Date): HotCacheStoreState => ({
	status: "idle",
	cacheState: null,
	restoreResult: null,
	summaryResult: null,
	lastFailureMessage: null,
	isWriteInFlight: false,
	isSummaryInFlight: false,
	updatedAt: toIsoTimestamp(now),
});

const failureMessageForCapture = (result: HotCacheCaptureResult): string =>
	result.ok ? "" : result.errors.map((error) => error.message).join(" ") || "Hot cache capture failed validation.";

const failureMessageForRestore = (result: HotCacheRestoreResult): string =>
	result.ok ? "" : result.errors.map((error) => error.message).join(" ") || "Hot cache restore failed validation.";

const failureMessageForSummary = (result: HotCacheSessionSummaryResult): string =>
	result.ok ? "" : result.errors.map((error) => error.message).join(" ") || "Session summary staging failed.";

export const createHotCacheStore = (options: CreateHotCacheStoreOptions = {}): HotCacheStore => {
	const now = options.now ?? (() => new Date());
	const cachePath = options.cachePath ?? HOT_CACHE_SUPPORT_PATH;
	let state = options.initialState ?? createInitialState(now());
	const subscribers = new Set<HotCacheStoreSubscriber>();

	const notify = (): void => {
		for (const subscriber of subscribers) {
			subscriber(state);
		}
	};

	const commit = (nextState: HotCacheStoreState): void => {
		state = nextState;
		notify();
	};

	const fail = (message: string): void => {
		commit({
			...state,
			status: "failed",
			lastFailureMessage: message,
			isWriteInFlight: false,
			isSummaryInFlight: false,
			updatedAt: toIsoTimestamp(now()),
		});
	};

	return {
		getState: () => state,
		getStatusInput: () => ({
			state: state.cacheState,
			cachePath,
			...(state.cacheState === null ? {} : { lastPersistedAt: state.cacheState.updatedAt }),
			...(state.restoreResult?.ok === true ? { lastRestoredAt: state.restoreResult.recoveredAt } : {}),
			...(state.lastFailureMessage === null ? {} : { lastFailureMessage: state.lastFailureMessage }),
			isWriteInFlight: state.isWriteInFlight,
		}),
		subscribe: (subscriber) => {
			subscribers.add(subscriber);
			subscriber(state);
			return () => {
				subscribers.delete(subscriber);
			};
		},
		beginCapture: () => {
			if (state.isWriteInFlight) {
				return false;
			}

			commit({
				...state,
				status: "capturing",
				lastFailureMessage: null,
				isWriteInFlight: true,
				updatedAt: toIsoTimestamp(now()),
			});
			return true;
		},
		applyCaptureResult: (result) => {
			if (result.ok) {
				commit({
					...state,
					status: "persisted",
					cacheState: result.state,
					lastFailureMessage: null,
					isWriteInFlight: false,
					updatedAt: toIsoTimestamp(now()),
				});
				return;
			}

			fail(failureMessageForCapture(result));
		},
		applyRestoreResult: (result) => {
			if (result.ok) {
				commit({
					...state,
					status: "restored",
					cacheState: result.state,
					restoreResult: result,
					lastFailureMessage: null,
					updatedAt: toIsoTimestamp(now()),
				});
				return;
			}

			commit({
				...state,
				status: "failed",
				restoreResult: result,
				lastFailureMessage: failureMessageForRestore(result),
				updatedAt: toIsoTimestamp(now()),
			});
		},
		beginSummaryStaging: () => {
			if (state.isSummaryInFlight) {
				return false;
			}

			commit({
				...state,
				status: "staging-summary",
				lastFailureMessage: null,
				isSummaryInFlight: true,
				updatedAt: toIsoTimestamp(now()),
			});
			return true;
		},
		applySummaryResult: (result) => {
			if (result.ok) {
				commit({
					...state,
					status: "persisted",
					summaryResult: result,
					lastFailureMessage: null,
					isSummaryInFlight: false,
					updatedAt: toIsoTimestamp(now()),
				});
				return;
			}

			commit({
				...state,
				status: "failed",
				summaryResult: result,
				lastFailureMessage: failureMessageForSummary(result),
				isSummaryInFlight: false,
				updatedAt: toIsoTimestamp(now()),
			});
		},
		setPersisted: (cacheState) =>
			commit({
				...state,
				status: "persisted",
				cacheState,
				lastFailureMessage: null,
				isWriteInFlight: false,
				updatedAt: toIsoTimestamp(now()),
			}),
		setFailure: fail,
		setOffline: () =>
			commit({
				...state,
				status: "offline",
				isWriteInFlight: false,
				isSummaryInFlight: false,
				updatedAt: toIsoTimestamp(now()),
			}),
		reset: () => commit(createInitialState(now())),
		clear: () => {
			subscribers.clear();
			state = createInitialState(now());
		},
	};
};

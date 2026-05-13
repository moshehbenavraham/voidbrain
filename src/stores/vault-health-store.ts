import type {
	VaultHealthExportResult,
	VaultHealthRepairStageResult,
	VaultHealthRuntimeScanResult,
	VaultHealthStoreState,
	VaultHealthStoreSubscriber,
	VaultHealthStoreUnsubscribe,
} from "../types/health";
import type { IsoTimestamp } from "../types/vault";
import { makeIsoTimestamp } from "../types/vault";

export interface VaultHealthStore {
	readonly getState: () => VaultHealthStoreState;
	readonly subscribe: (subscriber: VaultHealthStoreSubscriber) => VaultHealthStoreUnsubscribe;
	readonly setLoading: () => void;
	readonly applyScanResult: (result: VaultHealthRuntimeScanResult) => void;
	readonly selectGroup: (groupId: string | null) => void;
	readonly setExporting: () => void;
	readonly applyExportResult: (result: VaultHealthExportResult) => void;
	readonly setStaging: () => void;
	readonly applyStageResult: (result: VaultHealthRepairStageResult) => void;
	readonly setFailure: (message: string) => void;
	readonly setOffline: () => void;
	readonly reset: () => void;
	readonly clear: () => void;
}

export interface CreateVaultHealthStoreOptions {
	readonly initialState?: VaultHealthStoreState;
	readonly now?: () => Date;
}

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const createInitialState = (now: Date): VaultHealthStoreState => ({
	status: "idle",
	report: null,
	selectedGroupId: null,
	exportResult: null,
	stagedRepairResult: null,
	failureMessage: null,
	updatedAt: toIsoTimestamp(now),
});

const readyStatusFor = (result: VaultHealthRuntimeScanResult): VaultHealthStoreState["status"] => {
	if (!result.ok) {
		return "failed";
	}

	return result.report.summary.totalFindings === 0 ? "empty" : "ready";
};

export const createVaultHealthStore = (options: CreateVaultHealthStoreOptions = {}): VaultHealthStore => {
	const now = options.now ?? (() => new Date());
	let state = options.initialState ?? createInitialState(now());
	const subscribers = new Set<VaultHealthStoreSubscriber>();

	const notify = (): void => {
		for (const subscriber of subscribers) {
			subscriber(state);
		}
	};

	const commit = (nextState: VaultHealthStoreState): void => {
		state = nextState;
		notify();
	};

	const stableReadyStatus = (): VaultHealthStoreState["status"] =>
		state.report === null ? "idle" : state.report.summary.totalFindings === 0 ? "empty" : "ready";

	return {
		getState: () => state,
		subscribe: (subscriber) => {
			subscribers.add(subscriber);
			subscriber(state);
			return () => {
				subscribers.delete(subscriber);
			};
		},
		setLoading: () =>
			commit({
				...state,
				status: "loading",
				failureMessage: null,
				exportResult: null,
				stagedRepairResult: null,
				updatedAt: toIsoTimestamp(now()),
			}),
		applyScanResult: (result) => {
			if (!result.ok) {
				commit({
					...state,
					status: "failed",
					report: null,
					selectedGroupId: null,
					failureMessage: result.message,
					updatedAt: toIsoTimestamp(now()),
				});
				return;
			}

			const firstGroup = result.report.groups[0] ?? null;
			commit({
				...state,
				status: readyStatusFor(result),
				report: result.report,
				selectedGroupId: firstGroup?.groupId ?? null,
				failureMessage: null,
				exportResult: null,
				stagedRepairResult: null,
				updatedAt: toIsoTimestamp(now()),
			});
		},
		selectGroup: (groupId) => {
			const group = state.report?.groups.find((candidate) => candidate.groupId === groupId) ?? null;
			commit({
				...state,
				selectedGroupId: group?.groupId ?? null,
				failureMessage: null,
				updatedAt: toIsoTimestamp(now()),
			});
		},
		setExporting: () =>
			commit({
				...state,
				status: "exporting",
				failureMessage: null,
				updatedAt: toIsoTimestamp(now()),
			}),
		applyExportResult: (result) =>
			commit({
				...state,
				status: result.ok ? stableReadyStatus() : "failed",
				exportResult: result,
				failureMessage: result.ok ? null : result.message,
				updatedAt: toIsoTimestamp(now()),
			}),
		setStaging: () =>
			commit({
				...state,
				status: "staging",
				failureMessage: null,
				updatedAt: toIsoTimestamp(now()),
			}),
		applyStageResult: (result) =>
			commit({
				...state,
				status: result.ok ? stableReadyStatus() : "failed",
				stagedRepairResult: result,
				failureMessage: result.ok ? null : result.message,
				updatedAt: toIsoTimestamp(now()),
			}),
		setFailure: (message) =>
			commit({
				...state,
				status: "failed",
				failureMessage: message,
				updatedAt: toIsoTimestamp(now()),
			}),
		setOffline: () =>
			commit({
				...state,
				status: "offline",
				failureMessage: "Vault health runtime is offline. No vault files were changed.",
				updatedAt: toIsoTimestamp(now()),
			}),
		reset: () => commit(createInitialState(now())),
		clear: () => {
			subscribers.clear();
			state = createInitialState(now());
		},
	};
};

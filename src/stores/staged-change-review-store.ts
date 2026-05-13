import type {
	StagedReviewAction,
	StagedReviewActionResult,
	StagedReviewApplyOutcome,
	StagedReviewModel,
	StagedReviewStoreState,
	StagedReviewStoreSubscriber,
	StagedReviewStoreUnsubscribe,
} from "../types/staged-review";
import type { IsoTimestamp } from "../types/vault";
import { makeIsoTimestamp } from "../types/vault";

export interface StagedChangeReviewStore {
	readonly getState: () => StagedReviewStoreState;
	readonly subscribe: (subscriber: StagedReviewStoreSubscriber) => StagedReviewStoreUnsubscribe;
	readonly setLoading: () => void;
	readonly setModel: (model: StagedReviewModel) => void;
	readonly selectGroup: (groupId: string | null) => void;
	readonly selectChanges: (changeIds: readonly string[]) => void;
	readonly setConfirmationText: (confirmationText: string) => void;
	readonly setInFlight: (action: StagedReviewAction | null) => void;
	readonly applyActionResult: (result: StagedReviewActionResult) => void;
	readonly applyOutcome: (outcome: StagedReviewApplyOutcome) => void;
	readonly setFailure: (message: string) => void;
	readonly reset: () => void;
	readonly clear: () => void;
}

export interface CreateStagedChangeReviewStoreOptions {
	readonly initialState?: StagedReviewStoreState;
	readonly now?: () => Date;
}

const toIsoTimestamp = (date: Date): IsoTimestamp => makeIsoTimestamp(date.toISOString());

const createInitialState = (now: Date): StagedReviewStoreState => ({
	status: "idle",
	model: null,
	selectedGroupId: null,
	selectedChangeIds: [],
	confirmationText: "",
	inFlightAction: null,
	failureMessage: null,
	lastOutcome: null,
	updatedAt: toIsoTimestamp(now),
});

const sortedUnique = (values: readonly string[]): readonly string[] =>
	[...new Set(values)].sort((left, right) => left.localeCompare(right));

export const createStagedChangeReviewStore = (
	options: CreateStagedChangeReviewStoreOptions = {},
): StagedChangeReviewStore => {
	const now = options.now ?? (() => new Date());
	let state = options.initialState ?? createInitialState(now());
	const subscribers = new Set<StagedReviewStoreSubscriber>();

	const notify = (): void => {
		for (const subscriber of subscribers) {
			subscriber(state);
		}
	};

	const commit = (nextState: StagedReviewStoreState): void => {
		state = nextState;
		notify();
	};

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
				updatedAt: toIsoTimestamp(now()),
			}),
		setModel: (model) => {
			const firstGroup = model.groups[0] ?? null;
			commit({
				...state,
				status: "ready",
				model,
				selectedGroupId: firstGroup?.groupId ?? null,
				selectedChangeIds: firstGroup?.changeIds ?? [],
				confirmationText: "",
				inFlightAction: null,
				failureMessage: null,
				updatedAt: toIsoTimestamp(now()),
			});
		},
		selectGroup: (groupId) => {
			const group = state.model?.groups.find((candidate) => candidate.groupId === groupId) ?? null;
			commit({
				...state,
				selectedGroupId: group?.groupId ?? null,
				selectedChangeIds: group?.changeIds ?? [],
				confirmationText: "",
				failureMessage: null,
				updatedAt: toIsoTimestamp(now()),
			});
		},
		selectChanges: (changeIds) =>
			commit({
				...state,
				selectedChangeIds: sortedUnique(changeIds),
				confirmationText: "",
				failureMessage: null,
				updatedAt: toIsoTimestamp(now()),
			}),
		setConfirmationText: (confirmationText) =>
			commit({
				...state,
				confirmationText,
				updatedAt: toIsoTimestamp(now()),
			}),
		setInFlight: (action) =>
			commit({
				...state,
				status: action === null ? (state.model === null ? "idle" : "ready") : "applying",
				inFlightAction: action,
				failureMessage: null,
				updatedAt: toIsoTimestamp(now()),
			}),
		applyActionResult: (result) =>
			commit({
				...state,
				status: result.ok ? "ready" : "failed",
				model: state.model === null ? null : { ...state.model, groups: state.model.groups },
				inFlightAction: null,
				failureMessage: result.ok
					? null
					: "Staged review action failed. No unconfirmed vault mutation occurred.",
				lastOutcome: result,
				updatedAt: toIsoTimestamp(now()),
			}),
		applyOutcome: (outcome) =>
			commit({
				...state,
				status: outcome.ok ? "ready" : "failed",
				inFlightAction: null,
				failureMessage: outcome.ok ? null : "One or more staged changes failed during apply.",
				lastOutcome: outcome,
				updatedAt: toIsoTimestamp(now()),
			}),
		setFailure: (message) =>
			commit({
				...state,
				status: "failed",
				inFlightAction: null,
				failureMessage: message,
				updatedAt: toIsoTimestamp(now()),
			}),
		reset: () => commit(createInitialState(now())),
		clear: () => {
			subscribers.clear();
			state = createInitialState(now());
		},
	};
};

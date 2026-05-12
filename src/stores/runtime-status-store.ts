import type { RuntimeStatusSnapshot } from "../types/runtime";

export type RuntimeStatusSubscriber = (snapshot: RuntimeStatusSnapshot) => void;
export type RuntimeStatusUpdater = (snapshot: RuntimeStatusSnapshot) => RuntimeStatusSnapshot;
export type RuntimeStatusUnsubscribe = () => void;

export interface RuntimeStatusStore {
	readonly getSnapshot: () => RuntimeStatusSnapshot;
	readonly setSnapshot: (snapshot: RuntimeStatusSnapshot) => void;
	readonly update: (updater: RuntimeStatusUpdater) => void;
	readonly subscribe: (subscriber: RuntimeStatusSubscriber) => RuntimeStatusUnsubscribe;
	readonly clear: () => void;
}

export const createRuntimeStatusStore = (initialSnapshot: RuntimeStatusSnapshot): RuntimeStatusStore => {
	let snapshot = initialSnapshot;
	const subscribers = new Set<RuntimeStatusSubscriber>();

	const notify = (): void => {
		for (const subscriber of subscribers) {
			subscriber(snapshot);
		}
	};

	return {
		getSnapshot: () => snapshot,
		setSnapshot: (nextSnapshot) => {
			snapshot = nextSnapshot;
			notify();
		},
		update: (updater) => {
			snapshot = updater(snapshot);
			notify();
		},
		subscribe: (subscriber) => {
			subscribers.add(subscriber);
			subscriber(snapshot);

			return () => {
				subscribers.delete(subscriber);
			};
		},
		clear: () => {
			subscribers.clear();
		},
	};
};

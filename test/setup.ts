import { afterEach, beforeEach, vi } from "vitest";

const fixedNow = new Date("2026-01-01T00:00:00.000Z");

class MockResizeObserver implements ResizeObserver {
	disconnect = vi.fn();
	observe = vi.fn();
	unobserve = vi.fn();
}

const createMatchMedia = (): typeof window.matchMedia => {
	return (query: string): MediaQueryList => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		addListener: vi.fn(),
		dispatchEvent: vi.fn(() => true),
		removeEventListener: vi.fn(),
		removeListener: vi.fn(),
	});
};

beforeEach(() => {
	vi.useFakeTimers({ now: fixedNow });
	vi.stubGlobal("ResizeObserver", MockResizeObserver);
	vi.stubGlobal("matchMedia", createMatchMedia());
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
	document.body.replaceChildren();
	localStorage.clear();
	sessionStorage.clear();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

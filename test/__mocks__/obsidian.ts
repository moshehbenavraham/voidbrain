import { vi } from "vitest";

export interface Command {
	id: string;
	name: string;
	callback?: () => unknown;
}

export interface PluginManifest {
	id: string;
	name: string;
	version: string;
}

export const notices: Notice[] = [];

export class Plugin {
	app = new App();
	manifest: PluginManifest = {
		id: "voidbrain",
		name: "voidbrain",
		version: "0.1.0",
	};

	readonly commands: Command[] = [];
	private readonly registeredCleanups: Array<() => void> = [];

	loadData = vi.fn(async (): Promise<unknown> => undefined);
	saveData = vi.fn(async (_data: unknown): Promise<void> => undefined);

	addCommand = vi.fn((command: Command): Command => {
		this.commands.push(command);
		return command;
	});

	register = vi.fn((cleanup: () => void): void => {
		this.registeredCleanups.push(cleanup);
	});

	getRegisteredCleanupCount(): number {
		return this.registeredCleanups.length;
	}

	runRegisteredCleanups(): void {
		while (this.registeredCleanups.length > 0) {
			const cleanup = this.registeredCleanups.pop();

			if (cleanup) {
				cleanup();
			}
		}
	}
}

export class App {
	vault = new Vault();
	workspace = new Workspace();
	metadataCache = new MetadataCache();
	appId = "test-vault";
}

export class Vault {
	adapter = {
		exists: vi.fn(async (_path: string): Promise<boolean> => true),
		read: vi.fn(async (_path: string): Promise<string> => ""),
		write: vi.fn(async (_path: string, _data: string): Promise<void> => undefined),
	};

	getFiles = vi.fn((): TFile[] => []);
	getName = vi.fn((): string => "test-vault");
}

export class Workspace {
	getActiveFile = vi.fn((): TFile | null => null);
	on = vi.fn((): EventRef => ({ id: "workspace-event" }));
	offref = vi.fn((_ref: EventRef): void => undefined);
}

export class MetadataCache {
	getFileCache = vi.fn((_file: TFile): CachedMetadata | null => null);
	on = vi.fn((): EventRef => ({ id: "metadata-event" }));
	offref = vi.fn((_ref: EventRef): void => undefined);
}

export class TFile {
	path = "test.md";
	name = "test.md";
	basename = "test";
	extension = "md";
	stat = {
		ctime: 0,
		mtime: 0,
		size: 0,
	};
}

export class Notice {
	readonly message: string;
	readonly timeout: number | undefined;

	constructor(message: string, timeout?: number) {
		this.message = message;
		this.timeout = timeout;
		notices.push(this);
	}

	hide = vi.fn();
}

export interface EventRef {
	id: string;
}

export interface CachedMetadata {
	frontmatter?: Record<string, unknown>;
	headings?: Array<{ heading: string; level: number }>;
	links?: Array<{ link: string; original: string }>;
	tags?: Array<{ tag: string }>;
}

export const normalizePath = (path: string): string => {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
};

export const resetObsidianMockState = (): void => {
	notices.splice(0, notices.length);
};

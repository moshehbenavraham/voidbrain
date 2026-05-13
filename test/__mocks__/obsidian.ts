import { vi } from "vitest";

export type IconName = string;

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

export interface RibbonAction {
	icon: IconName;
	title: string;
	callback: (evt: MouseEvent) => unknown;
	element: HTMLElement;
}

export interface ViewState {
	type: string;
	active?: boolean;
	state?: unknown;
}

export type ViewCreator = (leaf: WorkspaceLeaf) => View;

export const notices: Notice[] = [];

export class Plugin {
	app: App;
	manifest: PluginManifest;

	readonly commands: Command[] = [];
	readonly ribbonActions: RibbonAction[] = [];
	readonly settingTabs: PluginSettingTab[] = [];
	readonly registeredViews: Array<{ type: string; creator: ViewCreator }> = [];
	private readonly registeredCleanups: Array<() => void> = [];

	constructor(app = new App(), manifest: PluginManifest = { id: "voidbrain", name: "voidbrain", version: "0.1.0" }) {
		this.app = app;
		this.manifest = manifest;
	}

	loadData = vi.fn(async (): Promise<unknown> => undefined);
	saveData = vi.fn(async (_data: unknown): Promise<void> => undefined);

	addCommand = vi.fn((command: Command): Command => {
		this.commands.push(command);
		return command;
	});

	register = vi.fn((cleanup: () => void): void => {
		this.registeredCleanups.push(cleanup);
	});

	addRibbonIcon = vi.fn((icon: IconName, title: string, callback: (evt: MouseEvent) => unknown): HTMLElement => {
		const element = document.createElement("button");
		element.type = "button";
		element.setAttribute("aria-label", title);
		this.ribbonActions.push({ icon, title, callback, element });
		return element;
	});

	addSettingTab = vi.fn((settingTab: PluginSettingTab): void => {
		this.settingTabs.push(settingTab);
	});

	registerView = vi.fn((type: string, creator: ViewCreator): void => {
		this.registeredViews.push({ type, creator });
		this.app.workspace.registerView(type, creator);
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
	workspace = new Workspace(this);
	metadataCache = new MetadataCache();
	appId = "test-vault";
}

export class Vault {
	private files: TFile[] = [];
	private readonly readContents = new Map<string, string>();
	private readonly failedReadPaths = new Set<string>();
	private readonly failedCreatePaths = new Set<string>();
	private readonly failedModifyPaths = new Set<string>();
	private readonly failedDeletePaths = new Set<string>();
	private readonly failedRenamePaths = new Set<string>();
	private readonly failedAdapterWritePaths = new Set<string>();

	adapter = {
		exists: vi.fn(async (path: string): Promise<boolean> => this.pathExists(path)),
		read: vi.fn(async (path: string): Promise<string> => {
			if (this.failedReadPaths.has(path)) {
				throw new Error("Synthetic adapter read failed.");
			}

			return this.readContents.get(path) ?? "";
		}),
		write: vi.fn(async (path: string, data: string): Promise<void> => {
			if (this.failedAdapterWritePaths.has(path)) {
				throw new Error("Synthetic adapter write failed.");
			}

			this.readContents.set(path, data);
		}),
	};

	getFiles = vi.fn((): TFile[] => [...this.files]);
	getName = vi.fn((): string => "test-vault");
	read = vi.fn(async (file: TFile): Promise<string> => {
		if (this.failedReadPaths.has(file.path)) {
			throw new Error("Synthetic vault read failed.");
		}

		const content = this.readContents.get(file.path);
		if (content !== undefined) {
			return content;
		}

		return this.adapter.read(file.path);
	});
	create = vi.fn(async (path: string, data: string): Promise<TFile> => {
		if (this.failedCreatePaths.has(path)) {
			throw new Error("Synthetic vault create failed.");
		}

		if (this.pathExists(path)) {
			throw new Error(`Synthetic vault create target already exists: ${path}`);
		}

		const file = new TFile(path, { size: data.length });
		this.files.push(file);
		this.readContents.set(path, data);
		return file;
	});
	modify = vi.fn(async (file: TFile, data: string): Promise<void> => {
		if (this.failedModifyPaths.has(file.path)) {
			throw new Error("Synthetic vault modify failed.");
		}

		if (!this.pathExists(file.path)) {
			throw new Error(`Synthetic vault modify target is missing: ${file.path}`);
		}

		this.readContents.set(file.path, data);
		file.stat = {
			...file.stat,
			mtime: file.stat.mtime + 1,
			size: data.length,
		};
	});
	delete = vi.fn(async (file: TFile): Promise<void> => {
		if (this.failedDeletePaths.has(file.path)) {
			throw new Error("Synthetic vault delete failed.");
		}

		this.files = this.files.filter((candidate) => candidate.path !== file.path);
		this.readContents.delete(file.path);
	});
	rename = vi.fn(async (file: TFile, newPath: string): Promise<void> => {
		if (this.failedRenamePaths.has(file.path) || this.failedRenamePaths.has(newPath)) {
			throw new Error("Synthetic vault rename failed.");
		}

		if (!this.pathExists(file.path)) {
			throw new Error(`Synthetic vault rename target is missing: ${file.path}`);
		}

		if (this.pathExists(newPath)) {
			throw new Error(`Synthetic vault rename destination already exists: ${newPath}`);
		}

		const content = this.readContents.get(file.path) ?? "";
		this.readContents.delete(file.path);
		setTFilePath(file, newPath);
		this.readContents.set(newPath, content);
	});

	setFiles(files: readonly TFile[]): void {
		this.files = [...files];
	}

	setReadContent(path: string, content: string): void {
		this.ensureFile(path, content.length);
		this.readContents.set(path, content);
	}

	getReadContent(path: string): string | undefined {
		return this.readContents.get(path);
	}

	pathExists(path: string): boolean {
		return this.readContents.has(path) || this.files.some((file) => file.path === path);
	}

	setReadFailure(path: string): void {
		this.failedReadPaths.add(path);
	}

	clearReadFailure(path: string): void {
		this.failedReadPaths.delete(path);
	}

	setCreateFailure(path: string): void {
		this.failedCreatePaths.add(path);
	}

	setModifyFailure(path: string): void {
		this.failedModifyPaths.add(path);
	}

	setDeleteFailure(path: string): void {
		this.failedDeletePaths.add(path);
	}

	setRenameFailure(path: string): void {
		this.failedRenamePaths.add(path);
	}

	setAdapterWriteFailure(path: string): void {
		this.failedAdapterWritePaths.add(path);
	}

	setPermissionFailure(path: string): void {
		this.failedCreatePaths.add(path);
		this.failedModifyPaths.add(path);
		this.failedDeletePaths.add(path);
		this.failedRenamePaths.add(path);
		this.failedAdapterWritePaths.add(path);
	}

	clearFailures(path: string): void {
		this.failedReadPaths.delete(path);
		this.failedCreatePaths.delete(path);
		this.failedModifyPaths.delete(path);
		this.failedDeletePaths.delete(path);
		this.failedRenamePaths.delete(path);
		this.failedAdapterWritePaths.delete(path);
	}

	private ensureFile(path: string, size: number): void {
		if (this.files.some((file) => file.path === path)) {
			return;
		}

		this.files.push(new TFile(path, { size }));
	}
}

export class Workspace {
	activeLeaf: WorkspaceLeaf | null = null;
	readonly leaves: WorkspaceLeaf[] = [];
	readonly detachedViewTypes: string[] = [];
	private readonly viewCreators = new Map<string, ViewCreator>();

	constructor(readonly app: App) {}

	getActiveFile = vi.fn((): TFile | null => null);
	on = vi.fn((): EventRef => ({ id: "workspace-event" }));
	offref = vi.fn((_ref: EventRef): void => undefined);
	registerView(type: string, creator: ViewCreator): void {
		this.viewCreators.set(type, creator);
	}

	createView(type: string, leaf: WorkspaceLeaf): View | null {
		const creator = this.viewCreators.get(type);
		return creator === undefined ? null : creator(leaf);
	}

	getLeavesOfType = vi.fn((viewType: string): WorkspaceLeaf[] =>
		this.leaves.filter((leaf) => !leaf.isDetached && leaf.getViewState().type === viewType),
	);

	detachLeavesOfType = vi.fn((viewType: string): void => {
		this.detachedViewTypes.push(viewType);
		for (const leaf of this.getLeavesOfType(viewType)) {
			leaf.detach();
		}
	});

	getRightLeaf = vi.fn((_split: boolean): WorkspaceLeaf => this.createLeaf());
	getLeftLeaf = vi.fn((_split: boolean): WorkspaceLeaf => this.createLeaf());
	getLeaf = vi.fn((_newLeaf?: boolean | string): WorkspaceLeaf => this.createLeaf());
	revealLeaf = vi.fn(async (leaf: WorkspaceLeaf): Promise<void> => {
		this.activeLeaf = leaf;
	});

	private createLeaf(): WorkspaceLeaf {
		const leaf = new WorkspaceLeaf(this);
		this.leaves.push(leaf);
		this.activeLeaf = leaf;
		return leaf;
	}
}

export class MetadataCache {
	private readonly fileCaches = new Map<string, CachedMetadata | null>();

	getFileCache = vi.fn((file: TFile): CachedMetadata | null => this.fileCaches.get(file.path) ?? null);
	on = vi.fn((): EventRef => ({ id: "metadata-event" }));
	offref = vi.fn((_ref: EventRef): void => undefined);

	setFileCache(path: string, cache: CachedMetadata | null): void {
		this.fileCaches.set(path, cache);
	}
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

	constructor(path = "test.md", stat: Partial<TFile["stat"]> = {}) {
		const fileName = path.split("/").at(-1) ?? path;
		const extension = fileName.includes(".") ? (fileName.split(".").at(-1) ?? "") : "";
		this.path = path;
		this.name = fileName;
		this.basename = extension.length === 0 ? fileName : fileName.slice(0, -(extension.length + 1));
		this.extension = extension;
		this.stat = {
			ctime: stat.ctime ?? 0,
			mtime: stat.mtime ?? 0,
			size: stat.size ?? 0,
		};
	}
}

const setTFilePath = (file: TFile, path: string): void => {
	const fileName = path.split("/").at(-1) ?? path;
	const extension = fileName.includes(".") ? (fileName.split(".").at(-1) ?? "") : "";
	file.path = path;
	file.name = fileName;
	file.basename = extension.length === 0 ? fileName : fileName.slice(0, -(extension.length + 1));
	file.extension = extension;
};

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

export class Modal {
	contentEl: HTMLElement;
	modalEl: HTMLElement;
	isOpen = false;

	constructor(readonly app: App) {
		this.modalEl = document.createElement("section");
		this.contentEl = document.createElement("div");
		this.modalEl.append(this.contentEl);
	}

	open(): void {
		if (this.isOpen) {
			return;
		}

		this.isOpen = true;
		document.body.append(this.modalEl);
		this.onOpen();
	}

	close(): void {
		if (!this.isOpen) {
			return;
		}

		this.onClose();
		this.isOpen = false;
		this.modalEl.remove();
	}

	onOpen(): void {}

	onClose(): void {}
}

export class View {
	app: App;
	icon: IconName = "file";
	navigation = false;
	containerEl: HTMLElement;
	scope = null;

	constructor(readonly leaf: WorkspaceLeaf) {
		this.app = leaf.workspace.app;
		this.containerEl = document.createElement("section");
	}

	protected onOpen(): Promise<void> {
		return Promise.resolve();
	}

	protected onClose(): Promise<void> {
		return Promise.resolve();
	}

	getViewType(): string {
		return "mock-view";
	}

	getDisplayText(): string {
		return "Mock view";
	}

	getState(): Record<string, unknown> {
		return {};
	}

	setState(_state: unknown, _result?: unknown): Promise<void> {
		return Promise.resolve();
	}

	getEphemeralState(): Record<string, unknown> {
		return {};
	}

	setEphemeralState(_state: unknown): void {}

	getIcon(): IconName {
		return this.icon;
	}

	onResize(): void {}
}

export class ItemView extends View {
	contentEl: HTMLElement;

	override icon = "panel-right";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.contentEl = document.createElement("div");
		this.containerEl.append(this.contentEl);
	}

	addAction = vi.fn((icon: IconName, title: string, callback: (evt: MouseEvent) => unknown): HTMLElement => {
		const element = document.createElement("button");
		element.type = "button";
		element.setAttribute("aria-label", title);
		element.dataset.icon = icon;
		element.addEventListener("click", callback);
		return element;
	});
}

export class WorkspaceLeaf {
	view: View | null = null;
	isDetached = false;
	private viewState: ViewState = { type: "empty" };

	constructor(readonly workspace: Workspace) {}

	async setViewState(viewState: ViewState): Promise<void> {
		if (this.view !== null) {
			await (this.view as unknown as { onClose: () => Promise<void> }).onClose();
		}

		this.viewState = viewState;
		this.view = this.workspace.createView(viewState.type, this);
		if (this.view !== null) {
			await (this.view as unknown as { onOpen: () => Promise<void> }).onOpen();
		}
	}

	getViewState(): ViewState {
		return this.viewState;
	}

	detach(): void {
		if (this.isDetached) {
			return;
		}

		this.isDetached = true;
		void (this.view as unknown as { onClose?: () => Promise<void> } | null)?.onClose?.();
	}

	getIcon(): IconName {
		return this.view?.getIcon() ?? "file";
	}

	getDisplayText(): string {
		return this.view?.getDisplayText() ?? "Empty";
	}
}

export class PluginSettingTab {
	app: App;
	containerEl: HTMLElement;
	icon: IconName = "settings";

	constructor(
		app: App,
		readonly plugin: Plugin,
	) {
		this.app = app;
		this.containerEl = document.createElement("section");
	}

	display(): void {}

	hide(): void {
		this.containerEl.replaceChildren();
	}
}

class ValueComponent<TValue> {
	protected value: TValue;
	protected changeHandler: ((value: TValue) => unknown) | null = null;

	constructor(
		readonly controlEl: HTMLElement,
		defaultValue: TValue,
	) {
		this.value = defaultValue;
	}

	setValue(value: TValue): this {
		this.value = value;
		return this;
	}

	getValue(): TValue {
		return this.value;
	}

	onChange(callback: (value: TValue) => unknown): this {
		this.changeHandler = callback;
		return this;
	}

	triggerChange(value: TValue): void {
		this.value = value;
		this.changeHandler?.(value);
	}

	setDisabled(_disabled: boolean): this {
		if (_disabled) {
			this.controlEl.setAttribute("disabled", "true");
		} else {
			this.controlEl.removeAttribute("disabled");
		}
		return this;
	}
}

export class ToggleComponent extends ValueComponent<boolean> {
	toggleEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		super(containerEl, false);
		this.toggleEl = document.createElement("input");
		this.toggleEl.setAttribute("type", "checkbox");
		containerEl.append(this.toggleEl);
	}

	setTooltip(_tooltip: string): this {
		return this;
	}
}

export class DropdownComponent extends ValueComponent<string> {
	selectEl: HTMLSelectElement;
	readonly options: Record<string, string> = {};

	constructor(containerEl: HTMLElement) {
		super(containerEl, "");
		this.selectEl = document.createElement("select");
		containerEl.append(this.selectEl);
	}

	addOption(value: string, display: string): this {
		this.options[value] = display;
		const option = document.createElement("option");
		option.value = value;
		option.textContent = display;
		this.selectEl.append(option);
		return this;
	}

	addOptions(options: Record<string, string>): this {
		for (const [value, display] of Object.entries(options)) {
			this.addOption(value, display);
		}

		return this;
	}
}

export class TextComponent extends ValueComponent<string> {
	inputEl: HTMLInputElement;

	constructor(containerEl: HTMLElement) {
		super(containerEl, "");
		this.inputEl = document.createElement("input");
		containerEl.append(this.inputEl);
	}

	setPlaceholder(_placeholder: string): this {
		return this;
	}
}

export class SliderComponent extends ValueComponent<number> {
	sliderEl: HTMLInputElement;

	constructor(containerEl: HTMLElement) {
		super(containerEl, 0);
		this.sliderEl = document.createElement("input");
		this.sliderEl.type = "range";
		containerEl.append(this.sliderEl);
	}

	setLimits(_min: number, _max: number, _step: number): this {
		return this;
	}
}

export class ButtonComponent {
	buttonEl: HTMLButtonElement;

	constructor(readonly controlEl: HTMLElement) {
		this.buttonEl = document.createElement("button");
		this.buttonEl.type = "button";
		controlEl.append(this.buttonEl);
	}

	setButtonText(text: string): this {
		this.buttonEl.textContent = text;
		return this;
	}

	onClick(callback: (evt: MouseEvent) => unknown): this {
		this.buttonEl.addEventListener("click", callback);
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.buttonEl.disabled = disabled;
		return this;
	}

	setTooltip(tooltip: string): this {
		this.buttonEl.title = tooltip;
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;
	infoEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;
	components: unknown[] = [];

	constructor(containerEl: HTMLElement) {
		this.settingEl = document.createElement("div");
		this.infoEl = document.createElement("div");
		this.nameEl = document.createElement("div");
		this.descEl = document.createElement("div");
		this.controlEl = document.createElement("div");
		this.infoEl.append(this.nameEl, this.descEl);
		this.settingEl.append(this.infoEl, this.controlEl);
		containerEl.append(this.settingEl);
	}

	setName(name: string | DocumentFragment): this {
		this.nameEl.replaceChildren(name);
		return this;
	}

	setDesc(desc: string | DocumentFragment): this {
		this.descEl.replaceChildren(desc);
		return this;
	}

	setClass(cls: string): this {
		this.settingEl.classList.add(cls);
		return this;
	}

	setHeading(): this {
		this.settingEl.classList.add("setting-item-heading");
		return this;
	}

	setDisabled(_disabled: boolean): this {
		return this;
	}

	addToggle(callback: (component: ToggleComponent) => unknown): this {
		const component = new ToggleComponent(this.controlEl);
		this.components.push(component);
		callback(component);
		return this;
	}

	addDropdown(callback: (component: DropdownComponent) => unknown): this {
		const component = new DropdownComponent(this.controlEl);
		this.components.push(component);
		callback(component);
		return this;
	}

	addText(callback: (component: TextComponent) => unknown): this {
		const component = new TextComponent(this.controlEl);
		this.components.push(component);
		callback(component);
		return this;
	}

	addSlider(callback: (component: SliderComponent) => unknown): this {
		const component = new SliderComponent(this.controlEl);
		this.components.push(component);
		callback(component);
		return this;
	}

	addButton(callback: (component: ButtonComponent) => unknown): this {
		const component = new ButtonComponent(this.controlEl);
		this.components.push(component);
		callback(component);
		return this;
	}
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

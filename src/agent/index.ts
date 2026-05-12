export {
	AGENT_COMMAND_CATALOG,
	getAgentCommandById,
	getAgentCommandsByStatus,
	getSupportedAgentSurfaces,
	validateAgentCommandCatalog,
} from "./command-catalog";
export {
	findMissingRequiredSafetyPhrases,
	validateAgentSurfaceMarkdown,
	validateAgentSurfaces,
} from "./surface-validation";
export {
	scanFixtureSafetyText,
	scanFixtureSafetyTexts,
	validateFixtureSafetyEntries,
} from "./fixture-safety";
export {
	createFrameworkUpdatePreviewPlanner,
	planFrameworkUpdatePreview,
} from "./framework-update-preview";
export type {
	FrameworkUpdatePreviewPlanner,
	FrameworkUpdatePreviewPlannerOptions,
} from "./framework-update-preview";
export {
	StagedChangeService,
	createContentSha256,
	createDiffContext,
	createLineDiff,
	createStagedChangeId,
	stageCreateNote,
	stageDeleteNote,
	stageFrontmatterEdit,
	stageMoveNote,
	stageUpdateNote,
} from "./staged-change-service";
export type {
	BaseStageChangeInput,
	ExistingVaultNote,
	StageCreateNoteInput,
	StageDeleteNoteInput,
	StageFrontmatterEditInput,
	StageMoveNoteInput,
	StageUpdateNoteInput,
	StagedChangeIdInput,
	StagedChangeServiceHooks,
	StagedChangeServiceOptions,
} from "./staged-change-service";
export {
	createVaultHealthReport,
	scanVaultHealth,
	sortHealthFindings,
	sortParsedNotesByPath,
	summarizeHealthFindings,
} from "./vault-health";
export type { VaultHealthScannerInput } from "./vault-health";

export {
	AGENT_COMMAND_CATALOG,
	getAgentCommandById,
	getAgentCommandsByStatus,
	getSupportedAgentSurfaces,
	validateAgentCommandCatalog,
} from "./command-catalog";
export {
	RuntimeCommandRegistrationError,
	createRuntimeCommandHandlers,
	mapRuntimeCommandError,
} from "./runtime-command-handlers";
export type {
	RuntimeCommandHandlerEntry,
	RuntimeCommandHandlerOptions,
	HealthRuntimeCommandExecutionOptions,
	RecoveryRuntimeCommandExecutionOptions,
	StagedReviewRuntimeCommandExecutionOptions,
} from "./runtime-command-handlers";
export { GroundedVaultChatService } from "./grounded-vault-chat-service";
export type {
	GroundedVaultChatAskFailure,
	GroundedVaultChatAskResult,
	GroundedVaultChatAskSuccess,
	GroundedVaultChatServiceOptions,
} from "./grounded-vault-chat-service";
export {
	HotCacheService,
	captureHotCacheState,
	createHotCacheService,
	restoreHotCacheState,
} from "./hot-cache-service";
export { RecoverSessionService, createRecoverSessionService } from "./recover-session-service";
export type {
	RecoverSessionInput,
	RecoveryAction,
	RecoveryDiagnostic,
	RecoveryEvidenceItem,
	RecoverySupportReadFailure,
	RecoverySummary,
} from "../types/recovery";
export { createRuntimeStatusSnapshot } from "./runtime-status";
export {
	extractAgentCommandReferencesFromMarkdown,
	findMissingRequiredSafetyPhrases,
	findStaleCommandStatusIssues,
	getMarkdownLineContexts,
	validateAgentSurfaceMarkdown,
	validateAgentSurfaces,
} from "./surface-validation";
export {
	scanFixtureSafetyText,
	scanFixtureSafetyTexts,
	validateFixtureSafetyEntries,
} from "./fixture-safety";
export {
	createRedactedLineExcerpt,
	formatAgentValidationIssue,
	redactSensitiveValidationText,
	sortAgentValidationIssues,
} from "./agent-validation-reporting";
export {
	normalizeRepositoryPath,
	isRepositoryPathWithinRoot,
	uniqueRepositoryPaths,
	validateRepositoryScanPath,
} from "./repository-scan-boundary";
export {
	classifyFrameworkUpdateCandidatePath,
	createFrameworkUpdatePreviewPlanner,
	createPreviewContentHash,
	normalizeFrameworkUpdateCandidatePath,
	planFrameworkUpdatePreview,
	sortFrameworkUpdatePreviewActions,
} from "./framework-update-preview";
export type {
	FrameworkUpdatePathClassification,
	FrameworkUpdatePreviewCurrentFileReader,
	FrameworkUpdatePreviewCurrentFileReadResult,
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
	StagedChangeReviewService,
	createStagedChangeReviewService,
	createStagedReviewModel,
} from "./staged-change-review-service";
export type { StagedChangeReviewServiceOptions } from "./staged-change-review-service";
export { validateGeneratedIngestionArtifacts, validateSourceCitationEvidence } from "./source-citation-validation";
export {
	SourceIngestionIntakeService,
	createSourceIngestionPreview,
	slugifyIngestionTitle,
} from "./source-ingestion-intake-service";
export type { SourceIngestionIntakeServiceOptions } from "./source-ingestion-intake-service";
export {
	renderSourceIngestionArtifacts,
	toAsciiText,
} from "./source-ingestion-renderer";
export type {
	RenderSourceIngestionArtifactsInput,
	SourceIngestionExtractionCandidate,
} from "./source-ingestion-renderer";
export { SourceIngestionStagingService, stageSourceIngestion } from "./source-ingestion-staging-service";
export type {
	SourceIngestionProviderExtractionInput,
	SourceIngestionProviderExtractor,
	SourceIngestionStagingServiceOptions,
} from "./source-ingestion-staging-service";
export {
	citationIdsForFinding,
	classifyHealthRepairSafety,
	createVaultHealthReport,
	groupHealthFindings,
	renderVaultHealthMarkdownReport,
	scanVaultHealth,
	sortHealthFindings,
	sortParsedNotesByPath,
	summarizeHealthFindings,
} from "./vault-health";
export type { VaultHealthScannerInput } from "./vault-health";
export {
	VAULT_HEALTH_COMMAND_ID,
	VAULT_HEALTH_REPORT_FOLDER,
	VaultHealthRuntimeService,
	createVaultHealthRuntimeService,
} from "./vault-health-runtime-service";
export type {
	VaultHealthReportExportAdapter,
	VaultHealthReportExportInput,
	VaultHealthRuntimeMarkdownNote,
	VaultHealthRuntimeScanInput,
	VaultHealthRuntimeServiceOptions,
	VaultHealthStageRepairInput,
} from "./vault-health-runtime-service";

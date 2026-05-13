export {
	AGENT_COMMAND_CATALOG,
	AGENT_SURFACES,
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
export {
	MaintenanceRecommendationPlanner,
	createMaintenanceRecommendationPlanner,
	planMaintenanceRecommendations,
} from "./maintenance-recommendation-planner";
export type {
	MaintenanceRecommendationPlannerInput,
	MaintenanceRecommendationPlannerOptions,
	MaintenanceRecommendationRepairService,
	MaintenanceRecommendationStageInput,
} from "./maintenance-recommendation-planner";
export type {
	MaintenanceRecommendation,
	MaintenanceRecommendationCategory,
	MaintenanceRecommendationConfidence,
	MaintenanceRecommendationEvidence,
	MaintenanceRecommendationEvidenceKind,
	MaintenanceRecommendationPlan,
	MaintenanceRecommendationRecovery,
	MaintenanceRecommendationSeverity,
	MaintenanceRecommendationSourceRecord,
	MaintenanceRecommendationStageFailure,
	MaintenanceRecommendationStageFailureReason,
	MaintenanceRecommendationStageResult,
	MaintenanceRecommendationStageSuccess,
	MaintenanceRecommendationStageability,
	MaintenanceRecommendationStageabilityKind,
	MaintenanceRecommendationSummary,
} from "../types/maintenance";
export {
	SIMILAR_NOTE_SUGGESTION_COMMAND_ID,
	SimilarNoteSuggestionService,
	createSimilarNoteSuggestionService,
	planSimilarNoteSuggestions,
} from "./similar-note-suggestion-service";
export type {
	SimilarNoteSuggestionPlannerInput,
	SimilarNoteSuggestionServiceOptions,
	SimilarNoteSuggestionStageInput,
} from "./similar-note-suggestion-service";
export type {
	SimilarNoteCandidate,
	SimilarNoteConfidence,
	SimilarNoteSignalEvidence,
	SimilarNoteSignalKind,
	SimilarNoteSourceKind,
	SimilarNoteSourceRecord,
	SimilarNoteStageFailure,
	SimilarNoteStageFailureReason,
	SimilarNoteStageResult,
	SimilarNoteStageSuccess,
	SimilarNoteStageability,
	SimilarNoteStageabilityKind,
	SimilarNoteSuggestion,
	SimilarNoteSuggestionKind,
	SimilarNoteSuggestionPlan,
	SimilarNoteSuggestionRecovery,
	SimilarNoteSuggestionSummary,
} from "../types/suggestions";
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
	classifyAgentSurfacePackageEcosystem,
	createAgentSurfacePackageChecksum,
	createAgentSurfacePackageDiagnostic,
	createAgentSurfacePackageManifest,
	loadAgentSurfacePackageSurfaces,
	planAgentSurfacePackage,
	scanAgentSurfacePackageContentSafety,
	scanLoadedAgentSurfaceFixtureSafetyForPackage,
	validateAgentSurfacePackageCandidatePaths,
	validateAgentSurfacePackageInput,
	validateAgentSurfacePackageOutputPath,
	validateLoadedAgentSurfaceForPackage,
} from "./agent-surface-packaging";
export type {
	AgentSurfacePackageBlockedResult,
	AgentSurfacePackageChecksum,
	AgentSurfacePackageDiagnostic,
	AgentSurfacePackageEcosystem,
	AgentSurfacePackageEntry,
	AgentSurfacePackageIssue,
	AgentSurfacePackageIssueCode,
	AgentSurfacePackageManifest,
	AgentSurfacePackagePlanningInput,
	AgentSurfacePackagePlanningResult,
	AgentSurfacePackageReadyResult,
	AgentSurfacePackageRecoveryDetails,
	AgentSurfacePackageScriptId,
	AgentSurfacePackageState,
} from "../types/agent-surface-package";
export {
	EcosystemHandoffPlanBuilder,
	createEcosystemHandoffPlanBuilder,
	isEcosystemHandoffMode,
	isEcosystemHandoffOutputKind,
	isLocalEcosystemHandoffMode,
	isReviewEcosystemHandoffMode,
	isUnsupportedEcosystemHandoffMode,
	normalizeEcosystemHandoffSelectedOutputs,
	planEcosystemHandoff,
	sortEcosystemHandoffIssues,
	validateEcosystemHandoffInput,
} from "./ecosystem-handoff-boundaries";
export type {
	EcosystemHandoffAllowedResult,
	EcosystemHandoffBlockedResult,
	EcosystemHandoffChecksum,
	EcosystemHandoffCitationEvidence,
	EcosystemHandoffDiagnostic,
	EcosystemHandoffDisclosureState,
	EcosystemHandoffIssue,
	EcosystemHandoffIssueCode,
	EcosystemHandoffLocalMode,
	EcosystemHandoffMode,
	EcosystemHandoffOutcome,
	EcosystemHandoffOutputKind,
	EcosystemHandoffPlan,
	EcosystemHandoffPlanAction,
	EcosystemHandoffPlanningInput,
	EcosystemHandoffPlanningResult,
	EcosystemHandoffRecoveryRecord,
	EcosystemHandoffReviewMode,
	EcosystemHandoffReviewRequiredResult,
	EcosystemHandoffSelectedOutput,
	EcosystemHandoffUnsupportedMode,
} from "../types/ecosystem-handoff";
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
	SourceIngestionQueueService,
	createSourceIngestionQueueService,
	runSourceIngestionQueue,
} from "./source-ingestion-queue-service";
export type {
	SourceIngestionQueueServiceOptions,
	SourceIngestionQueueStageSource,
} from "./source-ingestion-queue-service";
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

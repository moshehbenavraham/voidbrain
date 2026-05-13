import type { AgentCommand, AgentCommandId } from "./agent-commands";
import type { VaultHealthReport } from "./health";
import type { HotCacheStatusInput } from "./hot-cache";
import type { IndexingPathDiagnostic, IndexingRuntimeReport, SemanticIndexReadiness } from "./indexing-runtime";
import type { SourceIngestionQueueStatusInput } from "./ingestion-queue";
import type { MaintenanceRecommendationPlan } from "./maintenance";
import type { VoidbrainPluginSettings } from "./plugin";
import type { ProviderReadinessGuidance } from "./provider-readiness-guidance";
import type {
	ProviderRoleCapabilitySummary,
	ProviderSetupSummary,
	ProviderTroubleshootingReport,
} from "./provider-setup";
import type { ProviderDefinition } from "./providers";
import type { IndexFreshnessSnapshot, IndexProgressSnapshot, SemanticIndexCompatibility } from "./retrieval";
import type { SimilarNoteSuggestionPlan } from "./suggestions";
import type { IsoTimestamp, NormalizedVaultPath, StagedChangeRecord } from "./vault";

export const RUNTIME_STATUS_AREAS = [
	"provider",
	"index",
	"staged-change",
	"health",
	"hot-cache",
	"ingestion",
	"maintenance",
] as const;
export const RUNTIME_STATUS_SEVERITIES = ["ready", "warning", "error", "missing"] as const;
export const RUNTIME_COMMAND_OUTCOMES = ["opened", "not-ready", "read-only", "dry-run", "error"] as const;

export type RuntimeStatusArea = (typeof RUNTIME_STATUS_AREAS)[number];
export type RuntimeStatusSeverity = (typeof RUNTIME_STATUS_SEVERITIES)[number];
export type RuntimeCommandOutcomeKind = (typeof RUNTIME_COMMAND_OUTCOMES)[number];

export interface RuntimeStatusCounts {
	readonly ready: number;
	readonly warning: number;
	readonly error: number;
	readonly missing: number;
}

export interface RuntimeStatusItem {
	readonly id: string;
	readonly area: RuntimeStatusArea;
	readonly label: string;
	readonly severity: RuntimeStatusSeverity;
	readonly summary: string;
	readonly details: readonly string[];
	readonly paths: readonly NormalizedVaultPath[];
	readonly count?: number;
	readonly providerReadiness?: ProviderReadinessGuidance;
	readonly providerTroubleshooting?: ProviderTroubleshootingReport;
}

export interface RuntimeStatusSnapshot {
	readonly schemaVersion: 1;
	readonly generatedAt: IsoTimestamp;
	readonly overallSeverity: RuntimeStatusSeverity;
	readonly counts: RuntimeStatusCounts;
	readonly items: readonly RuntimeStatusItem[];
}

export interface MaintenanceRecommendationStatusInput {
	readonly plan: MaintenanceRecommendationPlan | null;
}

export interface SimilarNoteSuggestionStatusInput {
	readonly plan: SimilarNoteSuggestionPlan | null;
}

export interface RuntimeStatusInput {
	readonly settings: VoidbrainPluginSettings;
	readonly providers: readonly ProviderDefinition[];
	readonly providerSetup?: ProviderSetupSummary;
	readonly providerRoleCapabilities?: readonly ProviderRoleCapabilitySummary[];
	readonly providerTroubleshooting?: ProviderTroubleshootingReport;
	readonly indexReports?: readonly IndexingRuntimeReport[];
	readonly indexProgress?: readonly IndexProgressSnapshot[];
	readonly indexFreshness?: readonly IndexFreshnessSnapshot[];
	readonly semanticIndexReadiness?: SemanticIndexReadiness | null;
	readonly semanticIndexCompatibility?: SemanticIndexCompatibility | null;
	readonly recentIndexFailures?: readonly IndexingPathDiagnostic[];
	readonly stagedChanges?: readonly StagedChangeRecord[];
	readonly healthReport?: VaultHealthReport | null;
	readonly hotCache?: HotCacheStatusInput | null;
	readonly ingestionQueue?: SourceIngestionQueueStatusInput | null;
	readonly maintenanceRecommendations?: MaintenanceRecommendationStatusInput | null;
	readonly similarNoteSuggestions?: SimilarNoteSuggestionStatusInput | null;
	readonly now?: Date;
}

export interface RuntimeSurfaceState {
	readonly isLoaded: boolean;
	readonly statusViewType: string;
	readonly registeredCommandIds: readonly string[];
	readonly registeredViewTypes: readonly string[];
	readonly ribbonActionCount: number;
	readonly settingsTabCount: number;
	readonly ownedResourceCount: number;
}

export interface RuntimeCommandContext {
	readonly command: AgentCommand;
	readonly settings: VoidbrainPluginSettings;
	readonly statusSnapshot: RuntimeStatusSnapshot;
}

export interface RuntimeCommandOutcome {
	readonly commandId: AgentCommandId;
	readonly kind: RuntimeCommandOutcomeKind;
	readonly severity: RuntimeStatusSeverity;
	readonly userMessage: string;
	readonly recoveryHint: string;
}

<script lang="ts">
import type { RuntimeStatusSeverity, RuntimeStatusSnapshot } from "../types/runtime";

interface Props {
	readonly snapshot: RuntimeStatusSnapshot;
	readonly onRefresh?: () => void;
}

// biome-ignore lint/style/useConst: Svelte props remain reactive through let destructuring.
let { snapshot, onRefresh = () => undefined }: Props = $props();

const severityLabels: Readonly<Record<RuntimeStatusSeverity, string>> = {
	ready: "Ready",
	warning: "Warning",
	error: "Error",
	missing: "Missing setup",
};

const refresh = (): void => {
	onRefresh();
};
</script>

<section class="voidbrain-status-surface" aria-label="Voidbrain runtime readiness" aria-live="polite">
	<header class="voidbrain-status-surface__header">
		<div>
			<h2>Runtime status</h2>
			<p>{severityLabels[snapshot.overallSeverity]}</p>
		</div>
		<button type="button" class="voidbrain-status-surface__refresh" aria-label="Refresh Voidbrain status" onclick={refresh}>
			Refresh
		</button>
	</header>

	{#if snapshot.items.length === 0}
		<p class="voidbrain-status-surface__state" role="status">No status sections are enabled.</p>
	{:else}
		<div class="voidbrain-status-surface__list" role="list">
			{#each snapshot.items as item (item.id)}
				<article
					class={`voidbrain-status-surface__item voidbrain-status-surface__item--${item.severity}`}
					role="listitem"
					aria-label={`${item.label}: ${severityLabels[item.severity]}`}
				>
					<div class="voidbrain-status-surface__item-header">
						<h3>{item.label}</h3>
						<span>{severityLabels[item.severity]}</span>
					</div>
					<p>{item.summary}</p>
					{#if item.area === "hot-cache"}
						<div class="voidbrain-status-surface__cache-state" data-hot-cache-status={item.severity}>
							<span>{item.count ?? 0} cache entr{(item.count ?? 0) === 1 ? "y" : "ies"}</span>
							<span>{item.paths.length === 0 ? "No recovery paths" : `${item.paths.length} recovery path(s)`}</span>
						</div>
						{#if item.paths.length > 0}
							<ul class="voidbrain-status-surface__paths" aria-label="Hot cache recovery paths">
								{#each item.paths as path}
									<li>{path}</li>
								{/each}
							</ul>
						{/if}
					{/if}
					{#if item.area === "provider" && item.providerTroubleshooting !== undefined}
						<div class="voidbrain-status-surface__provider-report" aria-label="Provider troubleshooting">
							<span>{item.providerTroubleshooting.diagnostics.length} diagnostic(s)</span>
							<span>{item.providerTroubleshooting.actions.length} action(s)</span>
							<span>{item.providerTroubleshooting.recovery.commandId}</span>
						</div>
						{#if item.providerTroubleshooting.actions.length > 0}
							<ul class="voidbrain-status-surface__actions" aria-label="Provider troubleshooting actions">
								{#each item.providerTroubleshooting.actions.slice(0, 4) as action}
									<li>{action.label}</li>
								{/each}
							</ul>
						{/if}
					{/if}
					{#if item.details.length > 0}
						<p class="voidbrain-status-surface__details">{item.details.join(" ")}</p>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

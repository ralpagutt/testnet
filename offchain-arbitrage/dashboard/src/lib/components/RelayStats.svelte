<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { formatNumber, formatPercent, formatDuration, calculateSuccessRate } from '$lib/utils';
	import type { RelayStatsMap } from '$lib/types';

	let relayStats: RelayStatsMap = {};
	let loading = true;
	let error = '';

	onMount(async () => {
		await loadStats();

		// Refresh every 5 seconds
		const interval = setInterval(loadStats, 5000);

		return () => clearInterval(interval);
	});

	async function loadStats() {
		try {
			relayStats = await api.getRelayStats();
			loading = false;
			error = '';
		} catch (e) {
			error = 'Failed to load relay stats';
			loading = false;
		}
	}

	$: relayArray = Object.entries(relayStats);
</script>

<div class="card animate-fade-in">
	<div class="card-header">
		<h2 class="text-xl font-bold">📡 Relay Stats</h2>
	</div>

	<div class="card-body">
		{#if loading}
			<div class="text-center py-8">
				<div class="spinner mx-auto mb-2"></div>
				<p class="text-gray-400 text-sm">Loading...</p>
			</div>
		{:else if error}
			<div class="text-center py-8 text-red-400">
				<p>{error}</p>
			</div>
		{:else if relayArray.length > 0}
			<div class="space-y-4">
				{#each relayArray as [name, stats]}
					{@const successRate = calculateSuccessRate(stats.successCount, stats.totalRequests)}
					<div class="glass p-4 rounded-lg">
						<div class="flex items-center justify-between mb-3">
							<h3 class="font-semibold text-lg">{name}</h3>
							<span
								class="badge {successRate >= 80 ? 'badge-success' : successRate >= 50 ? 'badge-warning' : 'badge-error'}"
							>
								{formatPercent(successRate, 1)}
							</span>
						</div>

						<div class="grid grid-cols-2 gap-3 text-sm">
							<div>
								<p class="text-gray-400">Success</p>
								<p class="font-medium text-green-400">{formatNumber(stats.successCount)}</p>
							</div>
							<div>
								<p class="text-gray-400">Failed</p>
								<p class="font-medium text-red-400">{formatNumber(stats.failCount)}</p>
							</div>
							<div>
								<p class="text-gray-400">Avg Latency</p>
								<p class="font-medium">{formatDuration(stats.avgLatency)}</p>
							</div>
							<div>
								<p class="text-gray-400">Total Requests</p>
								<p class="font-medium">{formatNumber(stats.totalRequests)}</p>
							</div>
						</div>

						{#if stats.lastError}
							<div class="mt-3 pt-3 border-t border-gray-700">
								<p class="text-xs text-gray-400">Last Error:</p>
								<p class="text-xs text-red-400 mt-1 truncate" title={stats.lastError}>
									{stats.lastError}
								</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-12 text-gray-500">
				<p class="text-3xl mb-2">📡</p>
				<p class="text-lg">No relay configured</p>
				<p class="text-sm mt-1">Configure relays in .env to enable MEV protection</p>
			</div>
		{/if}
	</div>
</div>

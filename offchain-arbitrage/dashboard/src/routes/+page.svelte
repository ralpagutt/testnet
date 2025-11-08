<script lang="ts">
	import { onMount } from 'svelte';
	import { connected, botStatus, botStats } from '$lib/websocket';
	import BotControl from '$lib/components/BotControl.svelte';
	import Stats from '$lib/components/Stats.svelte';
	import PriceMonitor from '$lib/components/PriceMonitor.svelte';
	import ExecutionLog from '$lib/components/ExecutionLog.svelte';
	import RelayStats from '$lib/components/RelayStats.svelte';
	import ConfigPanel from '$lib/components/ConfigPanel.svelte';
	import OpportunityFeed from '$lib/components/OpportunityFeed.svelte';

	let showConfig = false;
</script>

<div class="min-h-screen bg-gray-900 p-6">
	<!-- Header -->
	<header class="mb-8 animate-fade-in">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-4xl font-bold mb-2">
					<span class="text-gradient">Arbitrage Bot</span>
				</h1>
				<p class="text-gray-400">
					Off-Chain Arbitrage • Arbitrum Mainnet • MEV Protected
				</p>
			</div>

			<!-- Connection Status -->
			<div class="flex items-center space-x-4">
				<div class="flex items-center space-x-2">
					<div class="status-dot {$connected ? 'online' : 'offline'}"></div>
					<span class="text-sm text-gray-400">
						{$connected ? 'Connected' : 'Disconnected'}
					</span>
				</div>

				<button
					class="btn-secondary"
					on:click={() => (showConfig = !showConfig)}
				>
					{showConfig ? '📊 Dashboard' : '⚙️ Settings'}
				</button>
			</div>
		</div>
	</header>

	{#if showConfig}
		<!-- Config Panel -->
		<div class="animate-fade-in">
			<ConfigPanel on:close={() => (showConfig = false)} />
		</div>
	{:else}
		<!-- Dashboard -->
		<div class="space-y-6">
			<!-- Bot Control & Stats -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<BotControl />
				<div class="lg:col-span-2">
					<Stats />
				</div>
			</div>

			<!-- Price Monitor & Opportunities -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<PriceMonitor />
				<OpportunityFeed />
			</div>

			<!-- Execution Log & Relay Stats -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div class="lg:col-span-2">
					<ExecutionLog />
				</div>
				<RelayStats />
			</div>
		</div>
	{/if}

	<!-- Footer -->
	<footer class="mt-12 pt-6 border-t border-gray-800 text-center text-gray-500 text-sm">
		<p>Built with ❤️ for Arbitrum • MEV Protected • Flash Loan Powered</p>
	</footer>
</div>

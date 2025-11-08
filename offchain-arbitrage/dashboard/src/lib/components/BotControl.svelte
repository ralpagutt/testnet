<script lang="ts">
	import { botStatus, isRunning } from '$lib/websocket';
	import { startBot, stopBot } from '$lib/api';
	import { formatTimestamp } from '$lib/utils';

	let loading = false;
	let error = '';

	async function handleStart() {
		loading = true;
		error = '';

		const success = await startBot();

		if (!success) {
			error = 'Failed to start bot';
		}

		loading = false;
	}

	async function handleStop() {
		loading = true;
		error = '';

		const success = await stopBot();

		if (!success) {
			error = 'Failed to stop bot';
		}

		loading = false;
	}
</script>

<div class="card animate-fade-in">
	<div class="card-header">
		<h2 class="text-xl font-bold">Bot Control</h2>
	</div>

	<div class="card-body space-y-4">
		<!-- Status Indicator -->
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-gray-400">Status</p>
				<div class="flex items-center space-x-2 mt-1">
					<div class="status-dot {$isRunning ? 'online' : 'offline'}"></div>
					<span class="text-lg font-semibold">
						{$isRunning ? 'Running' : 'Stopped'}
					</span>
				</div>
			</div>

			{#if $botStatus}
				<div class="text-right">
					<p class="text-sm text-gray-400">Pools</p>
					<p class="text-lg font-semibold">{$botStatus.poolCount}</p>
				</div>
			{/if}
		</div>

		<!-- Control Buttons -->
		<div class="space-y-2">
			{#if $isRunning}
				<button
					class="w-full btn-danger"
					on:click={handleStop}
					disabled={loading}
				>
					{#if loading}
						<span class="spinner mr-2"></span>
					{/if}
					⏹️ Stop Bot
				</button>
			{:else}
				<button
					class="w-full btn-success"
					on:click={handleStart}
					disabled={loading}
				>
					{#if loading}
						<span class="spinner mr-2"></span>
					{/if}
					▶️ Start Bot
				</button>
			{/if}
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="bg-red-500/10 border border-red-500/30 rounded p-3 text-sm text-red-400">
				{error}
			</div>
		{/if}

		<!-- Info -->
		<div class="pt-4 border-t border-gray-700 space-y-2">
			<div class="flex justify-between text-sm">
				<span class="text-gray-400">Flash Loan Provider</span>
				<span class="font-medium">Aave V3</span>
			</div>
			<div class="flex justify-between text-sm">
				<span class="text-gray-400">Network</span>
				<span class="font-medium">Arbitrum (42161)</span>
			</div>
			{#if $botStatus?.config}
				<div class="flex justify-between text-sm">
					<span class="text-gray-400">MEV Protection</span>
					<span class="font-medium">
						{$botStatus.config.enablePrivatePublishing ? '✅ Enabled' : '❌ Disabled'}
					</span>
				</div>
			{/if}
		</div>
	</div>
</div>

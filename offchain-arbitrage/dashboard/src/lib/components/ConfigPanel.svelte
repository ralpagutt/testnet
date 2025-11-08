<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { botStatus } from '$lib/websocket';
	import { updateConfig } from '$lib/api';

	const dispatch = createEventDispatcher();

	let minProfitUSD = 5.0;
	let minSpreadPercent = 0.8;
	let maxSlippage = 0.5;
	let tradeSize = 1000;
	let enablePrivatePublishing = true;
	let saving = false;
	let saveMessage = '';

	// Load current config from bot status
	$: if ($botStatus?.config) {
		minProfitUSD = $botStatus.config.minProfitUSD;
		minSpreadPercent = $botStatus.config.minSpreadPercent;
		maxSlippage = $botStatus.config.maxSlippage;
		tradeSize = $botStatus.config.tradeSize;
		enablePrivatePublishing = $botStatus.config.enablePrivatePublishing;
	}

	async function handleSave() {
		saving = true;
		saveMessage = '';

		const config = {
			minProfitUSD,
			minSpreadPercent,
			maxSlippage,
			tradeSize,
			enablePrivatePublishing
		};

		const success = await updateConfig(config);

		if (success) {
			saveMessage = '✓ Configuration saved successfully';
			setTimeout(() => {
				saveMessage = '';
			}, 3000);
		} else {
			saveMessage = '✗ Failed to save configuration';
		}

		saving = false;
	}
</script>

<div class="card animate-fade-in">
	<div class="card-header">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold">⚙️ Configuration</h2>
			<button class="text-gray-400 hover:text-white" on:click={() => dispatch('close')}>
				✕
			</button>
		</div>
	</div>

	<div class="card-body">
		<form on:submit|preventDefault={handleSave} class="space-y-6">
			<!-- Profit Settings -->
			<div>
				<h3 class="text-lg font-semibold mb-4">💰 Profit Settings</h3>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">
							Minimum Profit (USD)
						</label>
						<input
							type="number"
							class="input"
							bind:value={minProfitUSD}
							step="0.1"
							min="0"
							required
						/>
						<p class="text-xs text-gray-400 mt-1">
							Minimum profit required to execute arbitrage
						</p>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">
							Minimum Spread (%)
						</label>
						<input
							type="number"
							class="input"
							bind:value={minSpreadPercent}
							step="0.1"
							min="0"
							max="100"
							required
						/>
						<p class="text-xs text-gray-400 mt-1">
							Minimum price spread between pools
						</p>
					</div>
				</div>
			</div>

			<!-- Trade Settings -->
			<div class="pt-6 border-t border-gray-700">
				<h3 class="text-lg font-semibold mb-4">📊 Trade Settings</h3>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">
							Trade Size (USDC)
						</label>
						<input
							type="number"
							class="input"
							bind:value={tradeSize}
							step="100"
							min="100"
							max="100000"
							required
						/>
						<p class="text-xs text-gray-400 mt-1">
							Flash loan amount in USDC
						</p>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">
							Max Slippage (%)
						</label>
						<input
							type="number"
							class="input"
							bind:value={maxSlippage}
							step="0.1"
							min="0"
							max="5"
							required
						/>
						<p class="text-xs text-gray-400 mt-1">
							Maximum allowed slippage
						</p>
					</div>
				</div>
			</div>

			<!-- MEV Protection -->
			<div class="pt-6 border-t border-gray-700">
				<h3 class="text-lg font-semibold mb-4">🔒 MEV Protection</h3>

				<div class="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
					<div>
						<p class="font-medium">Private Transaction Publishing</p>
						<p class="text-sm text-gray-400 mt-1">
							Use private relays (bloXroute, Eden, Beaver)
						</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							class="sr-only peer"
							bind:checked={enablePrivatePublishing}
						/>
						<div
							class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"
						></div>
					</label>
				</div>
			</div>

			<!-- Save Button -->
			<div class="pt-6 border-t border-gray-700">
				<button type="submit" class="w-full btn-primary" disabled={saving}>
					{#if saving}
						<span class="spinner mr-2"></span>
						Saving...
					{:else}
						💾 Save Configuration
					{/if}
				</button>

				{#if saveMessage}
					<div
						class="mt-3 p-3 rounded {saveMessage.startsWith('✓') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}"
					>
						{saveMessage}
					</div>
				{/if}
			</div>

			<!-- Info -->
			<div class="pt-6 border-t border-gray-700 text-sm text-gray-400">
				<p class="mb-2">ℹ️ Configuration Tips:</p>
				<ul class="list-disc list-inside space-y-1 text-xs">
					<li>Lower min profit = more opportunities but higher risk</li>
					<li>Higher spread = fewer but safer opportunities</li>
					<li>Larger trade size = higher potential profit but more capital at risk</li>
					<li>MEV protection recommended for production use</li>
				</ul>
			</div>
		</form>
	</div>
</div>

<script lang="ts">
	import { opportunities } from '$lib/websocket';
	import { formatPercent, formatUSD, getRelativeTime } from '$lib/utils';
</script>

<div class="card animate-fade-in">
	<div class="card-header">
		<h2 class="text-xl font-bold">💡 Opportunities</h2>
	</div>

	<div class="card-body">
		{#if $opportunities.length > 0}
			<div class="space-y-3 max-h-96 overflow-y-auto">
				{#each $opportunities as opp}
					<div class="glass p-4 rounded-lg animate-slide-in">
						<div class="flex items-start justify-between mb-2">
							<div>
								<div class="flex items-center space-x-2">
									<span class="text-sm font-medium text-primary-400">{opp.buyDex}</span>
									<span class="text-gray-500">→</span>
									<span class="text-sm font-medium text-primary-400">{opp.sellDex}</span>
								</div>
								<p class="text-xs text-gray-500 mt-1">
									{getRelativeTime(opp.timestamp)}
								</p>
							</div>

							<div class="text-right">
								<p class="text-lg font-bold text-green-400">
									{formatPercent(opp.spreadPercent, 2)}
								</p>
								<p class="text-xs text-gray-400">spread</p>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2 text-sm">
							<div>
								<p class="text-gray-400">Buy Price</p>
								<p class="font-medium">${opp.buyPrice.toFixed(2)}</p>
							</div>
							<div>
								<p class="text-gray-400">Sell Price</p>
								<p class="font-medium">${opp.sellPrice.toFixed(2)}</p>
							</div>
						</div>

						{#if opp.estimatedProfit > 0}
							<div class="mt-2 pt-2 border-t border-gray-700">
								<div class="flex items-center justify-between text-sm">
									<span class="text-gray-400">Est. Profit</span>
									<span class="font-bold text-green-400">
										{formatUSD(opp.estimatedProfit)}
									</span>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-12 text-gray-500">
				<p class="text-3xl mb-2">💡</p>
				<p class="text-lg">No opportunities yet</p>
				<p class="text-sm mt-1">Waiting for price spreads...</p>
			</div>
		{/if}
	</div>
</div>

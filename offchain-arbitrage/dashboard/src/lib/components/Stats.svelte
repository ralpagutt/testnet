<script lang="ts">
	import { botStats } from '$lib/websocket';
	import { formatUSD, formatPercent, formatNumber } from '$lib/utils';
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
	<!-- Total Profit -->
	<div class="stat-card">
		<p class="stat-label">Total Profit</p>
		<p class="stat-value text-green-400">
			{$botStats ? formatUSD($botStats.totalProfit) : '$0.00'}
		</p>
		<p class="text-xs text-gray-500 mt-1">All-time earnings</p>
	</div>

	<!-- Opportunities Detected -->
	<div class="stat-card">
		<p class="stat-label">Opportunities</p>
		<p class="stat-value">
			{$botStats ? formatNumber($botStats.opportunitiesDetected) : '0'}
		</p>
		<p class="text-xs text-gray-500 mt-1">
			{$botStats ? formatNumber($botStats.opportunitiesExecuted) : '0'} executed
		</p>
	</div>

	<!-- Success Rate -->
	<div class="stat-card">
		<p class="stat-label">Success Rate</p>
		<p class="stat-value {$botStats && $botStats.successRate >= 80 ? 'text-green-400' : $botStats && $botStats.successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}">
			{$botStats ? formatPercent($botStats.successRate, 1) : '0%'}
		</p>
		<p class="text-xs text-gray-500 mt-1">
			{$botStats ? $botStats.successfulExecutions : 0}/{$botStats ? $botStats.opportunitiesExecuted : 0} trades
		</p>
	</div>

	<!-- Failed Executions -->
	<div class="stat-card">
		<p class="stat-label">Failed</p>
		<p class="stat-value text-red-400">
			{$botStats ? formatNumber($botStats.failedExecutions) : '0'}
		</p>
		<p class="text-xs text-gray-500 mt-1">Unsuccessful trades</p>
	</div>
</div>

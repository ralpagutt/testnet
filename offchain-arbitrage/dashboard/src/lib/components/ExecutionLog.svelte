<script lang="ts">
	import { executions } from '$lib/websocket';
	import { formatUSD, formatTime, formatGas, shortenTxHash, copyToClipboard } from '$lib/utils';

	let copiedHash = '';

	async function handleCopy(hash: string) {
		const success = await copyToClipboard(hash);
		if (success) {
			copiedHash = hash;
			setTimeout(() => (copiedHash = ''), 2000);
		}
	}
</script>

<div class="card animate-fade-in">
	<div class="card-header">
		<h2 class="text-xl font-bold">📋 Execution Log</h2>
	</div>

	<div class="card-body">
		{#if $executions.length > 0}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Time</th>
							<th>Status</th>
							<th>TX Hash</th>
							<th>Profit</th>
							<th>Gas Used</th>
						</tr>
					</thead>
					<tbody>
						{#each $executions as exec}
							<tr class="animate-fade-in">
								<td class="text-gray-400 text-xs">
									{formatTime(exec.timestamp)}
								</td>
								<td>
									{#if exec.success}
										<span class="badge-success">✓ Success</span>
									{:else}
										<span class="badge-error">✗ Failed</span>
									{/if}
								</td>
								<td>
									{#if exec.txHash}
										<button
											class="flex items-center space-x-1 hover:text-primary-400 transition-colors"
											on:click={() => handleCopy(exec.txHash || '')}
											title="Click to copy"
										>
											<span class="font-mono text-sm">
												{shortenTxHash(exec.txHash)}
											</span>
											{#if copiedHash === exec.txHash}
												<span class="text-green-400 text-xs">✓</span>
											{:else}
												<span class="text-gray-500 text-xs">📋</span>
											{/if}
										</button>
									{:else}
										<span class="text-gray-600">—</span>
									{/if}
								</td>
								<td>
									{#if exec.profit !== undefined}
										<span class="font-medium {exec.profit > 0 ? 'text-green-400' : 'text-gray-400'}">
											{formatUSD(exec.profit)}
										</span>
									{:else}
										<span class="text-gray-600">—</span>
									{/if}
								</td>
								<td class="text-gray-400 text-sm">
									{#if exec.gasUsed}
										{formatGas(exec.gasUsed)}
									{:else}
										<span class="text-gray-600">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="text-center py-12 text-gray-500">
				<p class="text-3xl mb-2">📋</p>
				<p class="text-lg">No executions yet</p>
				<p class="text-sm mt-1">Trade history will appear here</p>
			</div>
		{/if}
	</div>
</div>

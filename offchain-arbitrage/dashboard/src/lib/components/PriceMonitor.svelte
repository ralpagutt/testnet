<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { priceUpdates } from '$lib/websocket';
	import { formatNumber, formatTime } from '$lib/utils';
	import { createChart, type IChartApi, type ISeriesApi, ColorType } from 'lightweight-charts';

	let chartContainer: HTMLDivElement;
	let chart: IChartApi | null = null;
	let lineSeries: ISeriesApi<'Line'> | null = null;
	let selectedPool = '';
	let pools = new Map<string, { dex: string; price: number; timestamp: number }>();

	// Subscribe to price updates
	$: {
		$priceUpdates.forEach((update) => {
			pools.set(update.poolAddress, {
				dex: update.dex,
				price: update.price,
				timestamp: update.timestamp
			});

			// Update chart if this is the selected pool
			if (selectedPool === update.poolAddress && lineSeries) {
				lineSeries.update({
					time: Math.floor(update.timestamp / 1000) as any,
					value: update.price
				});
			}

			// Auto-select first pool
			if (!selectedPool && pools.size > 0) {
				selectedPool = Array.from(pools.keys())[0];
			}
		});
	}

	onMount(() => {
		// Initialize chart
		chart = createChart(chartContainer, {
			width: chartContainer.clientWidth,
			height: 300,
			layout: {
				background: { type: ColorType.Solid, color: '#1f2937' },
				textColor: '#9ca3af'
			},
			grid: {
				vertLines: { color: '#374151' },
				horzLines: { color: '#374151' }
			},
			timeScale: {
				borderColor: '#374151',
				timeVisible: true
			},
			rightPriceScale: {
				borderColor: '#374151'
			}
		});

		lineSeries = chart.addLineSeries({
			color: '#10b981',
			lineWidth: 2,
			priceFormat: {
				type: 'price',
				precision: 6,
				minMove: 0.000001
			}
		});

		// Handle window resize
		const handleResize = () => {
			if (chart && chartContainer) {
				chart.applyOptions({ width: chartContainer.clientWidth });
			}
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});

	onDestroy(() => {
		if (chart) {
			chart.remove();
		}
	});

	function selectPool(poolAddress: string) {
		selectedPool = poolAddress;

		// Clear chart
		if (lineSeries) {
			lineSeries.setData([]);
		}
	}

	$: selectedPoolData = pools.get(selectedPool);
	$: poolArray = Array.from(pools.entries());
</script>

<div class="card animate-fade-in">
	<div class="card-header">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold">📊 Live Prices</h2>

			{#if selectedPoolData}
				<div class="text-right">
					<p class="text-sm text-gray-400">{selectedPoolData.dex}</p>
					<p class="text-lg font-bold text-green-400">
						${formatNumber(selectedPoolData.price, 2)}
					</p>
				</div>
			{/if}
		</div>
	</div>

	<div class="card-body space-y-4">
		<!-- Pool Selector -->
		{#if poolArray.length > 0}
			<div class="flex space-x-2 overflow-x-auto pb-2">
				{#each poolArray as [address, data]}
					<button
						class="px-3 py-2 rounded text-sm whitespace-nowrap transition-all {selectedPool === address ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
						on:click={() => selectPool(address)}
					>
						{data.dex}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Chart -->
		<div bind:this={chartContainer} class="rounded overflow-hidden"></div>

		<!-- No Data Message -->
		{#if poolArray.length === 0}
			<div class="text-center py-12 text-gray-500">
				<p class="text-lg mb-2">📊</p>
				<p>Waiting for price updates...</p>
				<p class="text-sm mt-1">Start the bot to see live prices</p>
			</div>
		{/if}
	</div>
</div>

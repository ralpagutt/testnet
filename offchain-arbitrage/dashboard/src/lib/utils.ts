/**
 * Utility Functions
 */

// Format USD amount
export function formatUSD(amount: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}

// Format percentage
export function formatPercent(value: number, decimals: number = 2): string {
	return `${value.toFixed(decimals)}%`;
}

// Format number with commas
export function formatNumber(num: number, decimals: number = 0): string {
	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(num);
}

// Format timestamp to readable date/time
export function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

// Format timestamp to time only
export function formatTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

// Format duration from milliseconds
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${(ms / 60000).toFixed(1)}m`;
}

// Shorten address
export function shortenAddress(address: string, chars: number = 4): string {
	if (!address) return '';
	return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Shorten transaction hash
export function shortenTxHash(hash: string): string {
	return shortenAddress(hash, 6);
}

// Get relative time
export function getRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 1000) return 'just now';
	if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
	return `${Math.floor(diff / 86400000)}d ago`;
}

// Color based on value
export function getColorClass(value: number, threshold: number = 0): string {
	if (value > threshold) return 'text-green-400';
	if (value < threshold) return 'text-red-400';
	return 'text-gray-400';
}

// Success rate color
export function getSuccessRateColor(rate: number): string {
	if (rate >= 80) return 'text-green-400';
	if (rate >= 50) return 'text-yellow-400';
	return 'text-red-400';
}

// Get status badge color
export function getStatusColor(isRunning: boolean): string {
	return isRunning ? 'bg-green-500' : 'bg-gray-500';
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		console.error('Failed to copy:', error);
		return false;
	}
}

// Format gas amount
export function formatGas(gas: number): string {
	return formatNumber(gas, 0);
}

// Calculate success rate
export function calculateSuccessRate(success: number, total: number): number {
	if (total === 0) return 0;
	return (success / total) * 100;
}

// Truncate string
export function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength) + '...';
}

// Parse error message
export function parseError(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	return 'Unknown error';
}

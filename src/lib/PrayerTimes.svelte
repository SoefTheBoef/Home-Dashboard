<script lang="ts">
	import { BRUSSELS_TZ } from './format';

	interface PrayerEntry {
		name: string;
		time: string;
	}

	let {
		today,
		nextFajr,
		size = 'full'
	}: { today: PrayerEntry[]; nextFajr: string; size?: 'full' | 'compact' } = $props();

	function pad(n: number): string {
		return String(n).padStart(2, '0');
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString('en-GB', {
			timeZone: BRUSSELS_TZ,
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	let now = $state(new Date());
	$effect(() => {
		const timer = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(timer);
	});

	// The first entry (chronologically) that hasn't happened yet — falls through to tomorrow's
	// Fajr once tonight's Isha has passed.
	const next = $derived.by(() => {
		const nowMs = now.getTime();
		for (const entry of today) {
			if (new Date(entry.time).getTime() > nowMs) return entry;
		}
		return { name: 'Fajr', time: nextFajr };
	});

	const countdown = $derived.by(() => {
		const ms = Math.max(0, new Date(next.time).getTime() - now.getTime());
		const totalSeconds = Math.floor(ms / 1000);
		return {
			hours: Math.floor(totalSeconds / 3600),
			minutes: Math.floor((totalSeconds % 3600) / 60),
			seconds: totalSeconds % 60
		};
	});
</script>

{#if size === 'compact'}
	<a href="/calendar?tab=prayer" class="card flex items-center gap-3">
		<span class="text-2xl">🕌</span>
		<div>
			<p class="text-xs text-gray-500">Next: {next.name}</p>
			<p class="font-mono text-lg font-bold tabular-nums text-wood-600 dark:text-wood-300">
				{pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
			</p>
		</div>
	</a>
{:else}
	<div class="card">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<span class="text-4xl">🕌</span>
				<div>
					<p class="text-sm font-medium text-gray-500">Prayer times</p>
					<p class="text-xl font-bold text-gray-900">Aartselaar</p>
				</div>
			</div>
			<div class="text-center">
				<p class="font-mono text-3xl font-black leading-none tabular-nums text-wood-600 sm:text-4xl dark:text-wood-300">
					{pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
				</p>
				<p class="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">until {next.name}</p>
			</div>
		</div>

		<div class="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
			{#each today as entry (entry.name)}
				<div class="rounded-lg p-1.5 {entry.name === next.name ? 'bg-wood-50 dark:bg-wood-900/40' : ''}">
					<p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{entry.name}</p>
					<p
						class="font-mono text-sm font-bold tabular-nums {entry.name === next.name
							? 'text-wood-600 dark:text-wood-300'
							: 'text-gray-900'}"
					>
						{formatTime(entry.time)}
					</p>
				</div>
			{/each}
		</div>
	</div>
{/if}

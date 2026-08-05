<script lang="ts">
	import { formatDate } from './format';

	interface Trip {
		id: number;
		name: string;
		start_date: string;
		end_date: string | null;
	}

	let { trip, size = 'full' }: { trip: Trip | null; size?: 'full' | 'compact' } = $props();

	const MILESTONES = [30, 21, 14, 7, 3, 1, 0];

	function daysUntil(dateStr: string): number {
		const [y, m, d] = dateStr.split('-').map(Number);
		const target = Date.UTC(y, m - 1, d);
		const now = new Date();
		const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
		return Math.round((target - today) / 86_400_000);
	}

	function pickIcon(name: string): string {
		const n = name.toLowerCase();
		if (n.includes('beach') || n.includes('island') || n.includes('coast')) return '🏖️';
		if (n.includes('mountain') || n.includes('ski') || n.includes('hike')) return '🏔️';
		if (n.includes('city') || n.includes('weekend')) return '🏙️';
		if (n.includes('camp')) return '🏕️';
		return '✈️';
	}

	function pad(n: number): string {
		return String(n).padStart(2, '0');
	}

	// Live ticking countdown, re-derived every second from the trip's start-of-day local time.
	let now = $state(new Date());
	$effect(() => {
		const timer = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(timer);
	});

	const remainingMs = $derived(
		trip ? new Date(`${trip.start_date}T00:00:00`).getTime() - now.getTime() : 0
	);
	const countdown = $derived.by(() => {
		const ms = Math.max(0, remainingMs);
		const totalSeconds = Math.floor(ms / 1000);
		return {
			days: Math.floor(totalSeconds / 86_400),
			hours: Math.floor((totalSeconds % 86_400) / 3600),
			minutes: Math.floor((totalSeconds % 3600) / 60),
			seconds: totalSeconds % 60
		};
	});

	const days = $derived(trip ? daysUntil(trip.start_date) : 0);
	const isToday = $derived(days <= 0);
	const icon = $derived(trip ? pickIcon(trip.name) : '✈️');

	const reachedMilestones = $derived(MILESTONES.filter((m) => days <= m));
	const milestoneTrack = $derived(MILESTONES.slice().reverse());
</script>

{#if trip}
	{#if size === 'compact'}
		<a href="/calendar?tab=travel" class="card flex items-center gap-3">
			<span class="text-2xl">{icon}</span>
			<div>
				<p class="text-xs text-gray-500">{trip.name}</p>
				{#if isToday}
					<p class="text-lg font-bold text-wood-600 dark:text-wood-300">Today!</p>
				{:else}
					<p class="font-mono text-lg font-bold tabular-nums text-wood-600 dark:text-wood-300">
						{countdown.days}d {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
					</p>
				{/if}
			</div>
		</a>
	{:else}
		<div class="card overflow-hidden">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="flex items-center gap-4">
					<span class="animate-bounce-slow text-5xl">{icon}</span>
					<div>
						<p class="text-sm font-medium text-gray-500">Next trip</p>
						<p class="text-xl font-bold text-gray-900">{trip.name}</p>
						<p class="text-xs text-gray-500">
							{formatDate(trip.start_date)}{trip.end_date ? ` – ${formatDate(trip.end_date)}` : ''}
						</p>
					</div>
				</div>
				{#if isToday}
					<div class="text-center">
						<p class="text-4xl font-black text-wood-600 dark:text-wood-300">🎉</p>
						<p class="text-sm font-semibold text-wood-600 dark:text-wood-300">Happening now!</p>
					</div>
				{/if}
			</div>

			{#if !isToday}
				<div class="mt-4 grid grid-cols-4 gap-2 text-center">
					{#each [['days', countdown.days], ['hours', countdown.hours], ['min', countdown.minutes], ['sec', countdown.seconds]] as [label, value] (label)}
						<div>
							<p class="font-mono text-3xl font-black leading-none tabular-nums text-wood-600 sm:text-4xl dark:text-wood-300">
								{pad(Number(value))}
							</p>
							<p class="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
						</div>
					{/each}
				</div>

				<div class="mt-4 flex items-center">
					{#each milestoneTrack as m, i (m)}
						{@const reached = reachedMilestones.includes(m)}
						<div class="flex flex-col items-center gap-1">
							<div
								class="h-2.5 w-2.5 rounded-full transition-colors {reached
									? 'bg-wood-500'
									: 'bg-gray-200 dark:bg-gray-700'}"
							></div>
							<span class="text-[10px] text-gray-400">{m === 0 ? 'go!' : m}</span>
						</div>
						{#if i < milestoneTrack.length - 1}
							<div class="mb-3.5 h-0.5 flex-1 {reached ? 'bg-wood-500' : 'bg-gray-200 dark:bg-gray-700'}"></div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/if}
{:else if size === 'full'}
	<div class="card text-center">
		<span class="text-4xl">🧳</span>
		<p class="mt-2 text-sm text-gray-400">No trips planned — add one below.</p>
	</div>
{/if}

<style>
	@keyframes bounce-slow {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}
	:global(.animate-bounce-slow) {
		animation: bounce-slow 2.5s ease-in-out infinite;
	}
</style>

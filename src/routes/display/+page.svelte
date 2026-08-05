<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PhotoSlideshow from '$lib/PhotoSlideshow.svelte';
	import PersonBadge from '$lib/PersonBadge.svelte';
	import ThemeToggle from '$lib/ThemeToggle.svelte';
	import TravelCountdown from '$lib/TravelCountdown.svelte';
	import PrayerTimes from '$lib/PrayerTimes.svelte';
	import SpotifyWidget from '$lib/SpotifyWidget.svelte';
	import { formatCurrency, formatDate, formatLongDate, formatWeekdayShort, todayYmdBrussels } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function timeLabel(ev: (typeof data.todaysEvents)[number]): string {
		if (ev.all_day) return 'All day';
		const start = ev.start_at.includes('T') ? ev.start_at.slice(11, 16) : '';
		const end = ev.end_at?.includes('T') ? ev.end_at.slice(11, 16) : '';
		return end ? `${start} – ${end}` : start;
	}

	function isOverdue(dateStr: string): boolean {
		return dateStr < todayYmdBrussels();
	}

	function relativeNoteTime(iso: string): string {
		const then = new Date(iso.replace(' ', 'T') + 'Z');
		const mins = Math.round((Date.now() - then.getTime()) / 60_000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.round(hours / 24)}d ago`;
	}

	function relativeUpdatedLabel(then: Date): string {
		const secs = Math.round((clock.getTime() - then.getTime()) / 1000);
		if (secs < 10) return 'just now';
		if (secs < 60) return `${secs}s ago`;
		return `${Math.round(secs / 60)}m ago`;
	}

	function brusselsTime(d: Date): string {
		return d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false });
	}

	function wasteTypeLabel(code: string): string {
		return data.wasteTypes.find((t) => t.code === code)?.label.split(' (')[0] ?? code.toUpperCase();
	}

	function relativeDayLabel(dateStr: string): string {
		const today = todayYmdBrussels();
		const tomorrow = new Date(`${today}T00:00:00`);
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
		if (dateStr === today) return 'Today';
		if (dateStr === tomorrowStr) return 'Tomorrow';
		return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
	}

	let clock = $state(new Date());
	let lastUpdated = $state(new Date());

	$effect(() => {
		const timer = setInterval(() => (clock = new Date()), 15_000);
		return () => clearInterval(timer);
	});

	// Keep the kiosk fresh (weather, bills, notes, etc.) without anyone touching it.
	$effect(() => {
		const timer = setInterval(async () => {
			await invalidateAll();
			lastUpdated = new Date();
		}, 5 * 60_000);
		return () => clearInterval(timer);
	});

	// Screensaver: fall back to a full-screen photo slideshow after a few idle minutes; any touch wakes it.
	const IDLE_MS = 5 * 60_000;
	let screensaverActive = $state(false);
	let idleTimer: ReturnType<typeof setTimeout> | undefined;

	function resetIdle() {
		screensaverActive = false;
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => (screensaverActive = true), IDLE_MS);
	}

	$effect(() => {
		resetIdle();
		const events: (keyof WindowEventMap)[] = ['pointerdown', 'touchstart', 'mousemove', 'keydown'];
		for (const evt of events) window.addEventListener(evt, resetIdle);
		return () => {
			clearTimeout(idleTimer);
			for (const evt of events) window.removeEventListener(evt, resetIdle);
		};
	});
</script>

<svelte:head>
	<title>Living Room Display</title>
</svelte:head>

{#if screensaverActive}
	<button
		type="button"
		class="fixed inset-0 z-50 h-full w-full cursor-pointer bg-black"
		onpointerdown={resetIdle}
		aria-label="Wake display"
	>
		<PhotoSlideshow photos={data.photos} intervalMs={10000} />
	</button>
{/if}

<div class="min-h-screen bg-wood-800 p-2 sm:p-4 dark:bg-black">
	<div class="mx-auto max-w-6xl rounded-2xl border-4 border-wood-600 bg-gray-50 p-4 text-lg shadow-2xl sm:p-6 dark:border-wood-800 dark:bg-gray-950">
		<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-3xl font-bold text-gray-900">{brusselsTime(clock)}</p>
				<p class="text-base text-gray-500">{formatLongDate(clock)}</p>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-xs text-gray-400">Updated {relativeUpdatedLabel(lastUpdated)}</span>
				<ThemeToggle />
				<a href="/" class="text-sm text-gray-400 underline-offset-2 hover:text-gray-700 hover:underline">
					Full dashboard
				</a>
			</div>
		</div>

		{#if data.weather}
			<div class="card mb-6">
				<div class="flex flex-wrap items-center justify-between gap-4">
					<div class="flex items-center gap-3">
						<span class="text-5xl">{data.weather.current.icon}</span>
						<div>
							<p class="text-3xl font-bold text-gray-900">{data.weather.current.temp}°C</p>
							<p class="text-sm text-gray-500">{data.weather.current.description} · Aartselaar</p>
						</div>
					</div>
					<div class="flex gap-4 border-l border-gray-200 pl-4 dark:border-gray-800">
						{#each data.weather.daily.slice(1, 5) as d (d.date)}
							<div class="flex flex-col items-center text-sm text-gray-500">
								<span>{formatWeekdayShort(d.date)}</span>
								<span class="text-2xl">{d.icon}</span>
								<span class="text-gray-900">{d.tempMax}°/{d.tempMin}°</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		{#if data.nextCollection}
			<div class="mb-6 rounded-xl border-2 border-wood-600 bg-wood-600 p-4 text-white dark:border-wood-500 dark:bg-wood-700">
				<p class="text-xl font-bold">
					🗑️ Next: {data.nextCollection.types.map(wasteTypeLabel).join(', ')}, {relativeDayLabel(data.nextCollection.date)}
				</p>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="card">
				<h2 class="mb-3 text-xl font-semibold text-gray-900">Today's Schedule</h2>
				{#if data.todaysEvents.length === 0}
					<p class="text-base text-gray-400">Nothing scheduled today.</p>
				{:else}
					<ul class="space-y-3">
						{#each data.todaysEvents as ev (ev.id)}
							<li class="flex items-start gap-3">
								<span
									class="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full"
									style="background-color:{ev.user_color ?? '#6b7280'}"
								></span>
								<div>
									<p class="text-base font-medium text-gray-900">{ev.title}</p>
									<p class="text-sm text-gray-500">{timeLabel(ev)}{ev.location ? ` · ${ev.location}` : ''}</p>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="card">
				<h2 class="mb-3 text-xl font-semibold text-gray-900">Bills</h2>
				{#if data.unpaidBills.length === 0}
					<p class="text-base text-gray-400">Nothing due soon.</p>
				{:else}
					<ul class="space-y-3">
						{#each data.unpaidBills as b (b.id)}
							<li class="flex items-center justify-between">
								<span class="text-base text-gray-900">
									{b.name}
									{#if isOverdue(b.due_date)}<span class="badge-strong ml-1">Overdue</span>{/if}
								</span>
								<span class="text-sm text-gray-500">{formatDate(b.due_date)} · {formatCurrency(b.amount)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="card">
				<h2 class="mb-3 text-xl font-semibold text-gray-900">Today's Meal</h2>
				{#if data.todaysMeal}
					<p class="text-base font-medium text-gray-900">{data.todaysMeal.title}</p>
					{#if data.todaysMeal.ingredients}
						<p class="mt-1 whitespace-pre-line text-sm text-gray-500">{data.todaysMeal.ingredients}</p>
					{/if}
				{:else}
					<p class="text-base text-gray-400">Nothing planned — <a href="/meals" class="link">add one</a>.</p>
				{/if}
			</div>

			<div class="card">
				<h2 class="mb-3 text-xl font-semibold text-gray-900">To-Dos</h2>
				{#if data.openTodos.length === 0}
					<p class="text-base text-gray-400">All caught up!</p>
				{:else}
					<ul class="space-y-3">
						{#each data.openTodos as t (t.id)}
							<li class="flex items-center gap-3">
								<form method="POST" action="?/toggleTodo" use:enhance>
									<input type="hidden" name="id" value={t.id} />
									<input
										type="checkbox"
										onchange={(e) => e.currentTarget.form?.requestSubmit()}
										class="checkbox-touch h-8 w-8"
										aria-label="Mark {t.title} complete"
									/>
								</form>
								<div>
									<p class="text-base text-gray-900">{t.title}</p>
									<span class="flex items-center gap-1.5">
										<PersonBadge name={t.assignee_name} color={t.assignee_color} size="md" />
										{#if t.due_date}<span class="text-sm text-gray-500">· {formatDate(t.due_date)}</span>{/if}
									</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="card">
				<h2 class="mb-3 text-xl font-semibold text-gray-900">Shopping List</h2>
				{#if data.shoppingItems.length === 0}
					<p class="text-base text-gray-400">Nothing to buy.</p>
				{:else}
					<ul class="space-y-3">
						{#each data.shoppingItems as item (item.id)}
							<li class="flex items-center gap-3">
								<form method="POST" action="?/toggleShopping" use:enhance>
									<input type="hidden" name="id" value={item.id} />
									<input
										type="checkbox"
										onchange={(e) => e.currentTarget.form?.requestSubmit()}
										class="checkbox-touch h-8 w-8"
										aria-label="Mark {item.name} purchased"
									/>
								</form>
								<p class="text-base text-gray-900">
									{item.name}{#if item.quantity}<span class="text-gray-500"> · {item.quantity}</span>{/if}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<TravelCountdown trip={data.nextTrip} size="compact" />
		</div>

		<div class="mt-4">
			<PrayerTimes today={data.prayerTimes.today} nextFajr={data.prayerTimes.nextFajr} />
		</div>

		<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="lg:col-span-2">
				<PhotoSlideshow photos={data.photos} intervalMs={8000} />
			</div>

			<div class="card flex flex-col">
				<h2 class="mb-3 text-xl font-semibold text-gray-900">Notes</h2>
				<form
					method="POST"
					action="?/addNote"
					use:enhance={() => async ({ update, formElement }) => {
						await update();
						formElement.reset();
					}}
					class="mb-3 flex gap-2"
				>
					<input name="body" placeholder="Leave a note…" required class="input flex-1 text-base" />
					<button type="submit" class="btn-primary px-3">Post</button>
				</form>
				{#if data.notes.length === 0}
					<p class="text-base text-gray-400">No notes yet.</p>
				{:else}
					<ul class="space-y-2 overflow-y-auto">
						{#each data.notes as n (n.id)}
							<li class="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
								<p class="text-sm text-gray-900">{n.body}</p>
								<p class="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
									{#if n.author_name}
										<span class="inline-block h-2 w-2 rounded-full" style="background-color:{n.author_color}"
										></span>{n.author_name} ·
									{/if}
									{relativeNoteTime(n.created_at)}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<div class="mt-4">
			<SpotifyWidget />
		</div>

		<div class="mt-4 card flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-wrap items-center gap-4">
				<span class="text-base font-semibold text-gray-900">Guest wifi:</span>
				{#if data.wifiInfo.length === 0}
					<span class="text-base text-gray-400">Not set — add it in Emergency Info.</span>
				{:else}
					{#each data.wifiInfo as w (w.id)}
						<span class="text-base text-gray-900">{w.label}: <strong>{w.value}</strong></span>
					{/each}
				{/if}
			</div>
			<a href="/emergency" class="btn-outline text-base">Emergency & Important Info</a>
		</div>
	</div>
</div>

<script lang="ts">
	import PhotoSlideshow from '$lib/PhotoSlideshow.svelte';
	import PersonBadge from '$lib/PersonBadge.svelte';
	import TravelCountdown from '$lib/TravelCountdown.svelte';
	import SpotifyWidget from '$lib/SpotifyWidget.svelte';
	import { formatCurrency, formatDate, formatWeekdayShort } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function timeLabel(ev: (typeof data.todaysEvents)[number]): string {
		if (ev.all_day) return 'All day';
		const start = ev.start_at.includes('T') ? ev.start_at.slice(11, 16) : '';
		const end = ev.end_at?.includes('T') ? ev.end_at.slice(11, 16) : '';
		return end ? `${start} – ${end}` : start;
	}

	const nothingTodayAtAll = $derived(
		data.todaysEvents.length === 0 &&
			!data.todaysMeal &&
			data.billsDueToday.length === 0 &&
			data.wasteToday.length === 0 &&
			data.notesToday.length === 0
	);
</script>

<svelte:head>
	<title>Home Dashboard</title>
</svelte:head>

<h1 class="mb-4 text-xl font-semibold text-gray-900">Home</h1>

<div class="card mb-6">
	<h2 class="mb-3 text-base font-semibold text-gray-900">Today at a glance</h2>

	{#if nothingTodayAtAll}
		<p class="text-sm text-gray-400">Nothing on the books today — enjoy the quiet.</p>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#if data.todaysEvents.length > 0}
				<div>
					<p class="mb-1 text-xs font-semibold uppercase text-gray-400">Schedule</p>
					<ul class="space-y-1">
						{#each data.todaysEvents as ev (ev.id)}
							<li class="flex items-start gap-2 text-sm">
								<span
									class="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
									style="background-color:{ev.user_color ?? '#6b7280'}"
								></span>
								<span class="text-gray-900">{ev.title}</span>
								<span class="text-gray-500">{timeLabel(ev)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if data.todaysMeal}
				<div>
					<p class="mb-1 text-xs font-semibold uppercase text-gray-400">Tonight's meal</p>
					<p class="text-sm text-gray-900">{data.todaysMeal.title}</p>
				</div>
			{/if}

			{#if data.billsDueToday.length > 0}
				<div>
					<p class="mb-1 text-xs font-semibold uppercase text-gray-400">Bills due today</p>
					<ul class="space-y-1">
						{#each data.billsDueToday as b (b.id)}
							<li class="flex items-center justify-between text-sm">
								<span class="text-gray-900">{b.name}</span>
								<span class="badge-strong">{formatCurrency(b.amount)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if data.wasteToday.length > 0}
				<div>
					<p class="mb-1 text-xs font-semibold uppercase text-gray-400">Collection today</p>
					<ul class="space-y-1">
						{#each data.wasteToday as w (w.id)}
							<li class="flex items-center gap-2 text-sm text-gray-900">
								<span class="inline-block h-2 w-2 rounded-full" style="background-color:{w.color}"
								></span>
								🗑️ {w.label}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if data.notesToday.length > 0}
				<div>
					<p class="mb-1 text-xs font-semibold uppercase text-gray-400">New notes</p>
					<ul class="space-y-1">
						{#each data.notesToday as n (n.id)}
							<li class="text-sm text-gray-900">
								{n.body}
								{#if n.author_name}<span class="text-gray-500">— {n.author_name}</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>

<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
	<a href="/finances" class="card p-3">
		<p class="text-xs text-gray-500">Balance</p>
		<p class="text-lg font-semibold text-gray-900">{formatCurrency(data.balance)}</p>
	</a>
	<a href="/finances?tab=bills" class="card p-3">
		<p class="text-xs text-gray-500">Bills due soon</p>
		<p class="text-lg font-semibold text-gray-900">{data.unpaidBillsDueSoon.length}</p>
	</a>
	<a href="/todos" class="card p-3">
		<p class="text-xs text-gray-500">Open to-dos</p>
		<p class="text-lg font-semibold text-gray-900">{data.openTodos.length}</p>
	</a>
	<a href="/shopping" class="card p-3">
		<p class="text-xs text-gray-500">Shopping list</p>
		<p class="text-lg font-semibold text-gray-900">{data.shoppingCount}</p>
	</a>
</div>

<div class="mb-6">
	<TravelCountdown trip={data.nextTrip} size="compact" />
</div>

{#if data.weather}
	<div class="card mb-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<span class="text-3xl">{data.weather.current.icon}</span>
				<div>
					<p class="text-lg font-semibold text-gray-900">{data.weather.current.temp}°C</p>
					<p class="text-xs text-gray-500">{data.weather.current.description} · Aartselaar</p>
				</div>
			</div>
			<div class="flex gap-3">
				{#each data.weather.daily.slice(1, 5) as d (d.date)}
					<div class="flex flex-col items-center text-xs text-gray-500">
						<span>{formatWeekdayShort(d.date)}</span>
						<span class="text-lg">{d.icon}</span>
						<span class="text-gray-900">{d.tempMax}°</span>
						<span>{d.tempMin}°</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<div class="mb-6">
	<SpotifyWidget />
</div>

<div class="mb-6">
	<div class="mb-2 flex items-center justify-between">
		<h2 class="text-sm font-semibold text-gray-900">Photos</h2>
		<a href="/photos" class="link text-xs">Manage photos</a>
	</div>
	<PhotoSlideshow photos={data.photos} />
</div>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
	<div class="card">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-900">Today's schedule</h2>
			<a href="/calendar" class="link text-xs">View calendar</a>
		</div>
		{#if data.todaysEvents.length === 0}
			<p class="text-sm text-gray-400">Nothing scheduled today.</p>
		{:else}
			<ul class="space-y-2">
				{#each data.todaysEvents as ev (ev.id)}
					<li class="flex items-start gap-2">
						<span
							class="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
							style="background-color:{ev.user_color ?? '#6b7280'}"
						></span>
						<div>
							<p class="text-sm font-medium text-gray-900">{ev.title}</p>
							<p class="text-xs text-gray-500">{timeLabel(ev)}{ev.location ? ` · ${ev.location}` : ''}</p>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="card">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-900">Bills due soon</h2>
			<a href="/finances?tab=bills" class="link text-xs">View bills</a>
		</div>
		{#if data.unpaidBillsDueSoon.length === 0}
			<p class="text-sm text-gray-400">Nothing due in the next 7 days.</p>
		{:else}
			<ul class="space-y-2">
				{#each data.unpaidBillsDueSoon as b (b.id)}
					<li class="flex items-center justify-between text-sm">
						<span class="text-gray-900">{b.name}</span>
						<span class="text-xs text-gray-500">{formatDate(b.due_date)} · {formatCurrency(b.amount)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="card">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-900">Open to-dos</h2>
			<a href="/todos" class="link text-xs">View to-dos</a>
		</div>
		{#if data.openTodos.length === 0}
			<p class="text-sm text-gray-400">All caught up!</p>
		{:else}
			<ul class="space-y-2">
				{#each data.openTodos as t (t.id)}
					<li class="flex items-center justify-between gap-2 text-sm">
						<span class="text-gray-900">{t.title}</span>
						<span class="flex shrink-0 items-center gap-1.5">
							<PersonBadge name={t.assignee_name} color={t.assignee_color} />
							{#if t.due_date}<span class="text-xs text-gray-500">· {formatDate(t.due_date)}</span>{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

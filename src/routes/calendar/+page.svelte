<script lang="ts">
	import { enhance } from '$app/forms';
	import { MONTH_NAMES, WEEKDAY_NAMES, todayYmd } from '$lib/calendar-date';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import { formatDate } from '$lib/format';
	import TravelCountdown from '$lib/TravelCountdown.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const TABS = [
		{ id: 'calendar', label: 'Calendar' },
		{ id: 'waste', label: 'Recycling' },
		{ id: 'travel', label: 'Travel' }
	] as const;

	const undoDeleteEvent = createUndoDelete('?/deleteEvent');
	const undoDeleteSeries = createUndoDelete('?/deleteSeries');

	function ymdLocal(iso: string): string {
		return iso.slice(0, 10);
	}

	let selectedDate = $state(todayYmd());
	let editingEventId = $state<number | null>(null);
	let showAddForm = $state(false);
	let showSeriesForm = $state(false);
	let editingSeriesId = $state<number | null>(null);

	const WEEKDAY_OPTIONS = [
		{ value: 1, label: 'Mon' },
		{ value: 2, label: 'Tue' },
		{ value: 3, label: 'Wed' },
		{ value: 4, label: 'Thu' },
		{ value: 5, label: 'Fri' },
		{ value: 6, label: 'Sat' },
		{ value: 0, label: 'Sun' }
	];

	function weekdaysLabel(weekdays: string): string {
		const set = new Set(weekdays.split(',').map(Number));
		return WEEKDAY_OPTIONS.filter((w) => set.has(w.value))
			.map((w) => w.label)
			.join(', ');
	}

	const visibleEvents = $derived(data.events.filter((ev) => !undoDeleteEvent.isPending(ev.id)));
	const visibleSeries = $derived(data.series.filter((s) => !undoDeleteSeries.isPending(s.id)));

	const eventsByDate = $derived.by(() => {
		const map = new Map<string, typeof data.events>();
		for (const ev of visibleEvents) {
			const key = ymdLocal(ev.start_at);
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(ev);
		}
		return map;
	});

	function userFor(appliesTo: string) {
		if (appliesTo === 'both') return null;
		return data.users.find((u) => String(u.id) === appliesTo) ?? null;
	}

	function eventColor(appliesTo: string): string {
		const u = userFor(appliesTo);
		return u ? u.color : '#6b7280';
	}

	function tabHref(tab: string) {
		return `?tab=${tab}&year=${data.year}&month=${data.month}`;
	}
	function prevMonthHref() {
		const m = data.month - 1;
		return m < 0 ? `?tab=calendar&year=${data.year - 1}&month=11` : `?tab=calendar&year=${data.year}&month=${m}`;
	}
	function nextMonthHref() {
		const m = data.month + 1;
		return m > 11 ? `?tab=calendar&year=${data.year + 1}&month=0` : `?tab=calendar&year=${data.year}&month=${m}`;
	}

	const selectedEvents = $derived(eventsByDate.get(selectedDate) ?? []);

	function timeLabel(ev: (typeof data.events)[number]): string {
		if (ev.all_day) return 'All day';
		const start = ev.start_at.includes('T') ? ev.start_at.slice(11, 16) : '';
		const end = ev.end_at && ev.end_at.includes('T') ? ev.end_at.slice(11, 16) : '';
		return end ? `${start} – ${end}` : start;
	}

	// --- Recycling / waste ---
	let showWasteForm = $state(false);
	let editingWasteId = $state<number | null>(null);
	const undoDeleteWaste = createUndoDelete('?/deleteWaste');
	const visibleSchedules = $derived(data.wasteSchedules.filter((s) => !undoDeleteWaste.isPending(s.id)));
	const WASTE_WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	function relativeLabel(dateStr: string | null): string {
		if (!dateStr) return '';
		const today = todayYmd();
		if (dateStr === today) return 'Today';
		return formatDate(dateStr);
	}

	// --- Travel ---
	let showTripForm = $state(false);
	let editingTripId = $state<number | null>(null);
	const undoDeleteTrip = createUndoDelete('?/deleteTrip');
	const visibleTrips = $derived(data.trips.filter((t) => !undoDeleteTrip.isPending(t.id)));
	const upcomingTrips = $derived(visibleTrips.filter((t) => (t.end_date ?? t.start_date) >= todayYmd()));
	const pastTrips = $derived(visibleTrips.filter((t) => (t.end_date ?? t.start_date) < todayYmd()));

	function daysUntil(dateStr: string): number {
		const [y, m, d] = dateStr.split('-').map(Number);
		const target = Date.UTC(y, m - 1, d);
		const now = new Date();
		const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
		return Math.round((target - today) / 86_400_000);
	}
</script>

<svelte:head>
	<title>Calendar — Home Dashboard</title>
</svelte:head>

<h1 class="mb-4 text-xl font-semibold text-gray-900">Calendar</h1>

<nav class="mb-6 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
	{#each TABS as t (t.id)}
		<a
			href={tabHref(t.id)}
			class="rounded-t-md px-3 py-2 text-sm font-medium {data.tab === t.id
				? 'border-b-2 border-wood-600 text-wood-700 dark:text-wood-300'
				: 'text-gray-500 hover:text-gray-800'}"
		>
			{t.label}
		</a>
	{/each}
</nav>

{#if data.tab === 'waste'}
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-sm font-semibold text-gray-900">Recycling & Waste Collection</h2>
		<button type="button" onclick={() => (showWasteForm = !showWasteForm)} class="btn-primary">
			{showWasteForm ? 'Cancel' : '+ Add collection'}
		</button>
	</div>

	{#if showWasteForm}
		<form
			method="POST"
			action="?/createWaste"
			use:enhance={() => async ({ update }) => {
				await update();
				showWasteForm = false;
			}}
			class="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2"
		>
			<input name="label" placeholder="Label (e.g. General waste)" required class="input" />
			<select name="weekday" class="input">
				{#each WASTE_WEEKDAY_NAMES as name, i (name)}
					<option value={i}>{name}</option>
				{/each}
			</select>
			<select name="cadence" class="input">
				<option value="weekly">Weekly</option>
				<option value="biweekly">Every 2 weeks</option>
			</select>
			<input type="date" name="anchor_date" value={todayYmd()} required class="input" />
			<p class="col-span-2 -mt-1 text-xs text-gray-500">
				For "every 2 weeks", the reference date should be one of the actual collection dates.
			</p>
			<input type="color" name="color" value="#6b7280" class="input col-span-2 h-10" />
			<button type="submit" class="btn-primary col-span-2 py-2 text-sm">Save</button>
		</form>
	{/if}

	{#if visibleSchedules.length === 0}
		<p class="empty-state">No collections set up yet — add general waste or recycling above.</p>
	{:else}
		<ul class="space-y-2">
			{#each visibleSchedules as s (s.id)}
				<li class="rounded-lg border border-gray-200 p-3">
					{#if editingWasteId === s.id}
						<form
							method="POST"
							action="?/updateWaste"
							use:enhance={() => async ({ update }) => {
								await update();
								editingWasteId = null;
							}}
							class="grid grid-cols-1 gap-2 sm:grid-cols-2"
						>
							<input type="hidden" name="id" value={s.id} />
							<input name="label" value={s.label} required class="input" />
							<select name="weekday" class="input" value={s.weekday}>
								{#each WASTE_WEEKDAY_NAMES as name, i (name)}
									<option value={i}>{name}</option>
								{/each}
							</select>
							<select name="cadence" class="input" value={s.cadence}>
								<option value="weekly">Weekly</option>
								<option value="biweekly">Every 2 weeks</option>
							</select>
							<input type="date" name="anchor_date" value={s.anchor_date} required class="input" />
							<input type="color" name="color" value={s.color} class="input col-span-2 h-10" />
							<div class="col-span-2 flex gap-2">
								<button type="submit" class="btn-primary">Save</button>
								<button type="button" onclick={() => (editingWasteId = null)} class="btn-outline">Cancel</button>
							</div>
						</form>
					{:else}
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-3">
								<span class="inline-block h-3 w-3 rounded-full" style="background-color:{s.color}"></span>
								<div>
									<p class="text-sm font-medium text-gray-900">{s.label}</p>
									<p class="text-xs text-gray-500">
										{WASTE_WEEKDAY_NAMES[s.weekday]} · {s.cadence === 'weekly' ? 'Weekly' : 'Every 2 weeks'}
										{#if s.next_date}
											· Next: {relativeLabel(s.next_date)}
										{/if}
									</p>
								</div>
							</div>
							<div class="flex shrink-0 gap-1">
								<button type="button" onclick={() => (editingWasteId = s.id)} class="btn-outline">Edit</button>
								<button type="button" onclick={() => undoDeleteWaste.requestDelete(s.id, 'Collection')} class="btn-danger">
									Delete
								</button>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{:else if data.tab === 'travel'}
	<div class="mb-6">
		<TravelCountdown trip={data.nextTrip} />
	</div>

	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-sm font-semibold text-gray-900">All trips</h2>
		<button type="button" onclick={() => (showTripForm = !showTripForm)} class="btn-primary">
			{showTripForm ? 'Cancel' : '+ Add trip'}
		</button>
	</div>

	{#if showTripForm}
		<form
			method="POST"
			action="?/createTrip"
			use:enhance={() => async ({ update }) => {
				await update();
				showTripForm = false;
			}}
			class="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2"
		>
			<input name="name" placeholder="Trip name (e.g. Japan)" required class="input col-span-2" />
			<input type="date" name="start_date" required class="input" />
			<input type="date" name="end_date" class="input" />
			<textarea name="notes" placeholder="Notes (optional)" class="input col-span-2" rows="2"></textarea>
			<button type="submit" class="btn-primary col-span-2 py-2 text-sm"> Save </button>
		</form>
	{/if}

	{#snippet tripItem(t: (typeof data.trips)[number])}
		<li class="rounded-lg border border-gray-200 p-3">
			{#if editingTripId === t.id}
				<form
					method="POST"
					action="?/updateTrip"
					use:enhance={() => async ({ update }) => {
						await update();
						editingTripId = null;
					}}
					class="grid grid-cols-1 gap-2 sm:grid-cols-2"
				>
					<input type="hidden" name="id" value={t.id} />
					<input name="name" value={t.name} required class="input col-span-2" />
					<input type="date" name="start_date" value={t.start_date} required class="input" />
					<input type="date" name="end_date" value={t.end_date ?? ''} class="input" />
					<textarea name="notes" class="input col-span-2" rows="2">{t.notes ?? ''}</textarea>
					<div class="col-span-2 flex gap-2">
						<button type="submit" class="btn-primary">Save</button>
						<button type="button" onclick={() => (editingTripId = null)} class="btn-outline">Cancel</button>
					</div>
				</form>
			{:else}
				<div class="flex items-start justify-between gap-2">
					<div>
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-gray-900">{t.name}</span>
							{#if t.start_date >= todayYmd()}
								<span class="badge-strong">{daysUntil(t.start_date)}d</span>
							{/if}
						</div>
						<p class="text-xs text-gray-500">
							{formatDate(t.start_date)}{t.end_date ? ` – ${formatDate(t.end_date)}` : ''}
						</p>
						{#if t.notes}<p class="mt-1 text-xs text-gray-500">{t.notes}</p>{/if}
					</div>
					<div class="flex shrink-0 gap-1">
						<button type="button" onclick={() => (editingTripId = t.id)} class="btn-outline">Edit</button>
						<button type="button" onclick={() => undoDeleteTrip.requestDelete(t.id, 'Trip')} class="btn-danger">
							Delete
						</button>
					</div>
				</div>
			{/if}
		</li>
	{/snippet}

	{#if upcomingTrips.length === 0}
		<p class="empty-state">No upcoming trips planned — add one above.</p>
	{:else}
		<ul class="space-y-2">
			{#each upcomingTrips as t (t.id)}
				{@render tripItem(t)}
			{/each}
		</ul>
	{/if}

	{#if pastTrips.length > 0}
		<h2 class="mb-2 mt-6 text-xs font-semibold uppercase text-gray-400">Past trips</h2>
		<ul class="space-y-2">
			{#each pastTrips as t (t.id)}
				{@render tripItem(t)}
			{/each}
		</ul>
	{/if}
{:else}
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-semibold text-gray-900">
			{MONTH_NAMES[data.month]}
			{data.year}
		</h2>
		<div class="flex gap-1">
			<a href={prevMonthHref()} class="btn-outline py-1.5">‹</a>
			<a href="?tab=calendar&year={new Date().getFullYear()}&month={new Date().getMonth()}" class="btn-outline py-1.5"
				>Today</a
			>
			<a href={nextMonthHref()} class="btn-outline py-1.5">›</a>
		</div>
	</div>

	<div class="mb-6">
		<div class="mb-3 flex items-center justify-between">
			<div>
				<h2 class="text-sm font-semibold text-gray-900">Recurring work schedule</h2>
				<p class="text-xs text-gray-500">Generates individual shifts automatically; each one can still be edited or deleted on its own.</p>
			</div>
			<button
				type="button"
				onclick={() => {
					showSeriesForm = !showSeriesForm;
					editingSeriesId = null;
				}}
				class="btn-outline"
			>
				{showSeriesForm ? 'Cancel' : '+ Add recurring schedule'}
			</button>
		</div>

		{#if showSeriesForm}
			<form
				method="POST"
				action="?/createSeries"
				use:enhance={() => async ({ update }) => {
					await update();
					showSeriesForm = false;
				}}
				class="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2"
			>
				<input name="title" placeholder="Title (e.g. Work)" value="Work" required class="input col-span-2" />
				<div class="col-span-2 flex flex-wrap gap-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
					{#each WEEKDAY_OPTIONS as w (w.value)}
						<label class="flex items-center gap-1">
							<input type="checkbox" name="weekdays" value={w.value} />
							{w.label}
						</label>
					{/each}
				</div>
				<input type="time" name="start_time" class="input" placeholder="Start time" />
				<input type="time" name="end_time" class="input" placeholder="End time" />
				<select name="applies_to" class="input">
					<option value="both">Both</option>
					{#each data.users as u (u.id)}
						<option value={u.id}>{u.display_name}</option>
					{/each}
				</select>
				<input type="date" name="series_start_date" value={todayYmd()} required class="input" />
				<input type="date" name="series_end_date" class="input" placeholder="End date (blank = indefinite)" />
				<input name="location" placeholder="Location (optional)" class="input" />
				<textarea name="notes" placeholder="Notes (optional)" class="input col-span-2" rows="2"></textarea>
				<button type="submit" class="btn-primary col-span-2 py-2 text-sm">Save recurring schedule</button>
			</form>
		{/if}

		{#if visibleSeries.length > 0}
			<ul class="space-y-2">
				{#each visibleSeries as s (s.id)}
					<li class="rounded-lg border border-gray-200 p-3 {s.active ? '' : 'opacity-60'}">
						{#if editingSeriesId === s.id}
							<form
								method="POST"
								action="?/updateSeries"
								use:enhance={() => async ({ update }) => {
									await update();
									editingSeriesId = null;
								}}
								class="grid grid-cols-1 gap-2 sm:grid-cols-2"
							>
								<input type="hidden" name="id" value={s.id} />
								<input name="title" value={s.title} required class="input col-span-2" />
								<div class="col-span-2 flex flex-wrap gap-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
									{#each WEEKDAY_OPTIONS as w (w.value)}
										{@const checked = new Set(s.weekdays.split(',').map(Number)).has(w.value)}
										<label class="flex items-center gap-1">
											<input type="checkbox" name="weekdays" value={w.value} {checked} />
											{w.label}
										</label>
									{/each}
								</div>
								<input type="time" name="start_time" value={s.start_time ?? ''} class="input" />
								<input type="time" name="end_time" value={s.end_time ?? ''} class="input" />
								<select name="applies_to" class="input" value={s.applies_to}>
									<option value="both">Both</option>
									{#each data.users as u (u.id)}
										<option value={u.id}>{u.display_name}</option>
									{/each}
								</select>
								<input type="date" name="series_start_date" value={s.series_start_date} required class="input" />
								<input type="date" name="series_end_date" value={s.series_end_date ?? ''} class="input" />
								<input name="location" value={s.location ?? ''} class="input" />
								<textarea name="notes" class="input col-span-2" rows="2">{s.notes ?? ''}</textarea>
								<div class="col-span-2 flex gap-2">
									<button type="submit" class="btn-primary">Save</button>
									<button type="button" onclick={() => (editingSeriesId = null)} class="btn-outline">Cancel</button>
								</div>
							</form>
						{:else}
							<div class="flex items-center justify-between gap-2">
								<div>
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-2.5 w-2.5 rounded-full"
											style="background-color:{eventColor(s.applies_to)}"
										></span>
										<span class="text-sm font-medium text-gray-900">{s.title}</span>
										{#if !s.active}<span class="badge-neutral">Paused</span>{/if}
									</div>
									<p class="text-xs text-gray-500">
										{weekdaysLabel(s.weekdays)}{s.start_time ? ` · ${s.start_time}${s.end_time ? `–${s.end_time}` : ''}` : ''}
									</p>
									<p class="text-xs text-gray-500">
										From {formatDate(s.series_start_date)}{s.series_end_date ? ` to ${formatDate(s.series_end_date)}` : ' (indefinitely)'}
									</p>
								</div>
								<div class="flex items-center gap-1">
									<button type="button" onclick={() => (editingSeriesId = s.id)} class="btn-outline">Edit</button>
									<form method="POST" action="?/toggleSeriesActive" use:enhance>
										<input type="hidden" name="id" value={s.id} />
										<button type="submit" class="btn-outline">{s.active ? 'Pause' : 'Resume'}</button>
									</form>
									<button
										type="button"
										onclick={() => undoDeleteSeries.requestDelete(s.id, 'Recurring schedule')}
										class="btn-danger"
									>
										Delete
									</button>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="mb-2 flex gap-3 text-xs text-gray-500">
		{#each data.users as u (u.id)}
			<span class="flex items-center gap-1"
				><span class="inline-block h-2.5 w-2.5 rounded-full" style="background-color:{u.color}"
				></span>{u.display_name}</span
			>
		{/each}
		<span class="flex items-center gap-1"
			><span class="inline-block h-2.5 w-2.5 rounded-full bg-gray-500"></span>Both</span
		>
	</div>

	<div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
		<div class="grid grid-cols-7 border-b border-gray-200 text-center text-xs font-medium text-gray-500">
			{#each WEEKDAY_NAMES as d (d)}
				<div class="py-2">{d}</div>
			{/each}
		</div>
		<div class="grid grid-cols-7">
			{#each data.grid as isoDate (isoDate)}
				{@const dateStr = ymdLocal(isoDate)}
				{@const dayNum = Number(dateStr.slice(8, 10))}
				{@const inMonth = Number(dateStr.slice(5, 7)) - 1 === data.month}
				{@const dayEvents = eventsByDate.get(dateStr) ?? []}
				<button
					type="button"
					onclick={() => (selectedDate = dateStr)}
					class="min-h-[4.5rem] border-b border-r border-gray-100 p-1 text-left align-top last:border-r-0 {inMonth
						? ''
						: 'bg-gray-50'} {selectedDate === dateStr ? 'ring-2 ring-inset ring-wood-500' : ''}"
				>
					<div
						class="text-xs {inMonth ? 'text-gray-700' : 'text-gray-400'} {dateStr === todayYmd()
							? 'font-bold text-gray-900'
							: ''}"
					>
						{dayNum}
					</div>
					<div class="mt-1 flex flex-col gap-0.5">
						{#each dayEvents.slice(0, 3) as ev (ev.id)}
							<span
								class="truncate rounded px-1 py-0.5 text-[10px] text-white"
								style="background-color:{eventColor(ev.applies_to)}"
							>
								{ev.title}
							</span>
						{/each}
						{#if dayEvents.length > 3}
							<span class="text-[10px] text-gray-400">+{dayEvents.length - 3} more</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	</div>

	<div class="mt-6 card">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-900">
				{formatDate(selectedDate)}
			</h2>
			<button
				type="button"
				onclick={() => {
					showAddForm = !showAddForm;
					editingEventId = null;
				}}
				class="btn-primary"
			>
				{showAddForm ? 'Cancel' : '+ Add event'}
			</button>
		</div>

		{#if showAddForm}
			<form
				method="POST"
				action="?/createEvent"
				use:enhance={() => async ({ update }) => {
					await update();
					showAddForm = false;
				}}
				class="mb-4 grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-2"
			>
				<input type="hidden" name="date" value={selectedDate} />
				<input name="title" placeholder="Title" required class="input col-span-2" />
				<label class="col-span-2 flex items-center gap-2 text-xs text-gray-600">
					<input type="checkbox" name="all_day" /> All day
				</label>
				<input type="time" name="time" class="input" />
				<input type="time" name="end_time" class="input" placeholder="End time" />
				<select name="applies_to" class="input">
					<option value="both">Both</option>
					{#each data.users as u (u.id)}
						<option value={u.id}>{u.display_name}</option>
					{/each}
				</select>
				<select name="event_type" class="input">
					<option value="event">Appointment / Event</option>
					<option value="work">Work shift</option>
				</select>
				<input name="location" placeholder="Location (optional)" class="input col-span-2" />
				<textarea name="notes" placeholder="Notes (optional)" class="input col-span-2" rows="2"
				></textarea>
				<button type="submit" class="btn-primary col-span-2 py-2 text-sm"> Save event </button>
			</form>
		{/if}

		{#if selectedEvents.length === 0}
			<p class="text-sm text-gray-400">No events on this day.</p>
		{:else}
			<ul class="space-y-2">
				{#each selectedEvents as ev (ev.id)}
					<li class="rounded-lg border border-gray-200 p-3">
						{#if editingEventId === ev.id}
							<form
								method="POST"
								action="?/updateEvent"
								use:enhance={() => async ({ update }) => {
									await update();
									editingEventId = null;
								}}
								class="grid grid-cols-1 gap-2 sm:grid-cols-2"
							>
								<input type="hidden" name="id" value={ev.id} />
								<input type="hidden" name="date" value={selectedDate} />
								<input name="title" value={ev.title} required class="input col-span-2" />
								<label class="col-span-2 flex items-center gap-2 text-xs text-gray-600">
									<input type="checkbox" name="all_day" checked={!!ev.all_day} /> All day
								</label>
								<input
									type="time"
									name="time"
									value={ev.start_at.includes('T') ? ev.start_at.slice(11, 16) : ''}
									class="input"
								/>
								<input
									type="time"
									name="end_time"
									value={ev.end_at?.includes('T') ? ev.end_at.slice(11, 16) : ''}
									class="input"
								/>
								<select name="applies_to" class="input" value={ev.applies_to}>
									<option value="both">Both</option>
									{#each data.users as u (u.id)}
										<option value={u.id}>{u.display_name}</option>
									{/each}
								</select>
								<select name="event_type" class="input" value={ev.event_type}>
									<option value="event">Appointment / Event</option>
									<option value="work">Work shift</option>
								</select>
								<input name="location" value={ev.location ?? ''} class="input col-span-2" />
								<textarea name="notes" class="input col-span-2" rows="2">{ev.notes ?? ''}</textarea>
								<div class="col-span-2 flex gap-2">
									<button type="submit" class="btn-primary">Save</button>
									<button type="button" onclick={() => (editingEventId = null)} class="btn-outline"
										>Cancel</button
									>
								</div>
							</form>
						{:else}
							<div class="flex items-start justify-between gap-2">
								<div>
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-2.5 w-2.5 rounded-full"
											style="background-color:{eventColor(ev.applies_to)}"
										></span>
										<span class="text-sm font-medium text-gray-900">{ev.title}</span>
										{#if ev.event_type === 'work'}
											<span class="badge-neutral">Work</span>
										{/if}
									</div>
									<p class="mt-0.5 text-xs text-gray-500">{timeLabel(ev)}</p>
									{#if ev.location}<p class="text-xs text-gray-500">{ev.location}</p>{/if}
									{#if ev.notes}<p class="mt-1 text-xs text-gray-500">{ev.notes}</p>{/if}
								</div>
								<div class="flex shrink-0 gap-1">
									<button
										type="button"
										onclick={() => {
											editingEventId = ev.id;
											showAddForm = false;
										}}
										class="btn-outline">Edit</button
									>
									<button
										type="button"
										onclick={() => undoDeleteEvent.requestDelete(ev.id, 'Event')}
										class="btn-danger"
									>
										Delete
									</button>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

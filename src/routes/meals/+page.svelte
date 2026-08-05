<script lang="ts">
	import { enhance } from '$app/forms';
	import { addDays, todayYmd } from '$lib/calendar-date';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import { toasts } from '$lib/toastStore.svelte';
	import { formatDate } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let editingDate = $state<string | null>(null);

	const undoDelete = createUndoDelete('?/delete');
	const visibleEntries = $derived(data.entries.filter((e) => !undoDelete.isPending(e.id)));

	const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

	const entryByDate = $derived.by(() => {
		const map = new Map<string, (typeof data.entries)[number]>();
		for (const e of visibleEntries) map.set(e.date, e);
		return map;
	});

	function prevWeekHref() {
		return `?start=${addDays(data.start, -7)}`;
	}
	function nextWeekHref() {
		return `?start=${addDays(data.start, 7)}`;
	}
</script>

<svelte:head>
	<title>Meal Plan — Home Dashboard</title>
</svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-gray-900">Meal Plan</h1>
	<div class="flex gap-1">
		<a href={prevWeekHref()} class="btn-outline py-1.5">‹ Prev</a>
		<a href="?start={todayYmd()}" class="btn-outline py-1.5">This week</a>
		<a href={nextWeekHref()} class="btn-outline py-1.5">Next ›</a>
	</div>
</div>

<ul class="space-y-2">
	{#each data.weekDates as date, i (date)}
		{@const entry = entryByDate.get(date)}
		<li class="card {date === todayYmd() ? 'ring-2 ring-inset ring-wood-500' : ''}">
			{#if editingDate === date}
				<form
					method="POST"
					action="?/save"
					use:enhance={() => async ({ update }) => {
						await update();
						editingDate = null;
					}}
					class="grid grid-cols-1 gap-2"
				>
					<input type="hidden" name="date" value={date} />
					<div class="flex items-center justify-between">
						<span class="text-sm font-semibold text-gray-900">{DAY_NAMES[i]} · {formatDate(date)}</span>
					</div>
					<input name="title" value={entry?.title ?? ''} placeholder="What's for dinner?" required class="input" />
					<textarea
						name="ingredients"
						placeholder="Ingredients (one per line, optional)"
						class="input"
						rows="4">{entry?.ingredients ?? ''}</textarea
					>
					<textarea name="notes" placeholder="Notes (optional)" class="input" rows="2"
						>{entry?.notes ?? ''}</textarea
					>
					<div class="flex gap-2">
						<button type="submit" class="btn-primary">Save</button>
						<button type="button" onclick={() => (editingDate = null)} class="btn-outline">Cancel</button>
					</div>
				</form>
			{:else}
				<div class="flex items-start justify-between gap-2">
					<div class="flex-1">
						<p class="text-xs font-semibold uppercase text-gray-400">{DAY_NAMES[i]} · {formatDate(date)}</p>
						{#if entry}
							<p class="mt-1 text-sm font-medium text-gray-900">{entry.title}</p>
							{#if entry.ingredients}
								<p class="mt-1 whitespace-pre-line text-xs text-gray-500">{entry.ingredients}</p>
							{/if}
							{#if entry.notes}<p class="mt-1 text-xs text-gray-500">{entry.notes}</p>{/if}
						{:else}
							<p class="mt-1 text-sm text-gray-400">Nothing planned yet.</p>
						{/if}
					</div>
					<div class="flex shrink-0 flex-col items-end gap-1">
						<button type="button" onclick={() => (editingDate = date)} class="btn-outline">
							{entry ? 'Edit' : '+ Add'}
						</button>
						{#if entry}
							{#if entry.ingredients}
								<form
									method="POST"
									action="?/confirmCooked"
									use:enhance={() => async ({ update, result }) => {
										await update();
										if (result.type === 'success') {
											const decremented = (result.data?.decremented as number) ?? 0;
											toasts.info(
												decremented > 0
													? `Decremented ${decremented} inventory item${decremented === 1 ? '' : 's'}`
													: 'No matching inventory items found'
											);
										}
									}}
								>
									<input type="hidden" name="id" value={entry.id} />
									<button type="submit" class="btn-outline">Confirm cooked</button>
								</form>
								<form
									method="POST"
									action="?/addMissingToShopping"
									use:enhance={() => async ({ update, result }) => {
										await update();
										if (result.type === 'success') {
											const added = (result.data?.added as number) ?? 0;
											toasts.info(added > 0 ? `Added ${added} missing item${added === 1 ? '' : 's'} to shopping list` : 'Nothing missing');
										}
									}}
								>
									<input type="hidden" name="id" value={entry.id} />
									<button type="submit" class="btn-outline">Add missing to shopping</button>
								</form>
								<form
									method="POST"
									action="?/addIngredientsToShopping"
									use:enhance={() => async ({ update }) => {
										await update();
										toasts.info('Ingredients added to shopping list');
									}}
								>
									<input type="hidden" name="id" value={entry.id} />
									<button type="submit" class="btn-outline">Add all to shopping list</button>
								</form>
							{/if}
							<button type="button" onclick={() => undoDelete.requestDelete(entry.id, 'Meal')} class="btn-danger">
								Delete
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</li>
	{/each}
</ul>

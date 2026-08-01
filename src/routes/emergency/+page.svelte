<script lang="ts">
	import { enhance } from '$app/forms';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let showAddForm = $state(false);
	let editingId = $state<number | null>(null);

	const undoDelete = createUndoDelete('?/delete');
	const visibleEntries = $derived(data.entries.filter((e) => !undoDelete.isPending(e.id)));

	const CATEGORY_LABELS: Record<string, string> = {
		doctor: 'Doctors',
		insurance: 'Insurance',
		wifi: 'Wifi',
		other: 'Other'
	};
	const CATEGORY_ORDER = ['doctor', 'insurance', 'wifi', 'other'];

	const grouped = $derived.by(() => {
		const map = new Map<string, typeof data.entries>();
		for (const cat of CATEGORY_ORDER) map.set(cat, []);
		for (const e of visibleEntries) {
			if (!map.has(e.category)) map.set(e.category, []);
			map.get(e.category)!.push(e);
		}
		return map;
	});
</script>

<svelte:head>
	<title>Emergency Info — Home Dashboard</title>
</svelte:head>

<div class="mb-4 flex items-center justify-between">
	<div>
		<h1 class="text-xl font-semibold text-gray-900">Emergency & Important Info</h1>
		<p class="text-xs text-gray-500">Doctors, insurance, wifi — the stuff you need in a hurry.</p>
	</div>
	<button type="button" onclick={() => (showAddForm = !showAddForm)} class="btn-primary">
		{showAddForm ? 'Cancel' : '+ Add entry'}
	</button>
</div>

{#if showAddForm}
	<form
		method="POST"
		action="?/create"
		use:enhance={() => async ({ update }) => {
			await update();
			showAddForm = false;
		}}
		class="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2"
	>
		<select name="category" class="input">
			<option value="doctor">Doctor</option>
			<option value="insurance">Insurance</option>
			<option value="wifi">Wifi</option>
			<option value="other">Other</option>
		</select>
		<input name="label" placeholder="Label (e.g. Dr. Smith — GP)" required class="input" />
		<input name="value" placeholder="Value (e.g. phone number, policy #, password)" required class="input col-span-2" />
		<textarea name="notes" placeholder="Notes (optional)" class="input col-span-2" rows="2"></textarea>
		<button type="submit" class="btn-primary col-span-2 py-2 text-sm">Save</button>
	</form>
{/if}

{#each CATEGORY_ORDER as cat (cat)}
	{@const entries = grouped.get(cat) ?? []}
	{#if entries.length > 0}
		<h2 class="mb-2 mt-6 text-xs font-semibold uppercase text-gray-400">{CATEGORY_LABELS[cat]}</h2>
		<ul class="space-y-2">
			{#each entries as e (e.id)}
				<li class="card">
					{#if editingId === e.id}
						<form
							method="POST"
							action="?/update"
							use:enhance={() => async ({ update }) => {
								await update();
								editingId = null;
							}}
							class="grid grid-cols-1 gap-2 sm:grid-cols-2"
						>
							<input type="hidden" name="id" value={e.id} />
							<select name="category" class="input" value={e.category}>
								<option value="doctor">Doctor</option>
								<option value="insurance">Insurance</option>
								<option value="wifi">Wifi</option>
								<option value="other">Other</option>
							</select>
							<input name="label" value={e.label} required class="input" />
							<input name="value" value={e.value} required class="input col-span-2" />
							<textarea name="notes" class="input col-span-2" rows="2">{e.notes ?? ''}</textarea>
							<div class="col-span-2 flex gap-2">
								<button type="submit" class="btn-primary">Save</button>
								<button type="button" onclick={() => (editingId = null)} class="btn-outline">Cancel</button>
							</div>
						</form>
					{:else}
						<div class="flex items-start justify-between gap-2">
							<div>
								<p class="text-sm font-medium text-gray-900">{e.label}</p>
								<p class="mt-1 text-lg font-semibold tracking-wide text-gray-900">{e.value}</p>
								{#if e.notes}<p class="mt-1 text-xs text-gray-500">{e.notes}</p>{/if}
							</div>
							<div class="flex shrink-0 gap-1">
								<button type="button" onclick={() => (editingId = e.id)} class="btn-outline">Edit</button>
								<button type="button" onclick={() => undoDelete.requestDelete(e.id, 'Entry')} class="btn-danger">
									Delete
								</button>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/each}

{#if visibleEntries.length === 0}
	<p class="empty-state">Nothing saved yet — add doctors, insurance and wifi info above.</p>
{/if}

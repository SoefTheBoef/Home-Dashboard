<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showAddForm = $state(false);
	let editingId = $state<number | null>(null);
	let suggesting = $state(false);

	const undoDelete = createUndoDelete('?/delete');
	const visibleItems = $derived(data.items.filter((i) => !undoDelete.isPending(i.id)));

	const itemsByCategory = $derived.by(() => {
		const map = new Map<string, typeof data.items>();
		for (const i of visibleItems) {
			if (!map.has(i.category)) map.set(i.category, []);
			map.get(i.category)!.push(i);
		}
		return map;
	});

	async function adjust(id: number, delta: number) {
		const fd = new FormData();
		fd.set('id', String(id));
		fd.set('delta', String(delta));
		await fetch('?/adjust', { method: 'POST', body: fd });
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Food Inventory — Home Dashboard</title>
</svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-gray-900">Food Inventory</h1>
	<button type="button" onclick={() => (showAddForm = !showAddForm)} class="btn-primary">
		{showAddForm ? 'Cancel' : '+ Add item'}
	</button>
</div>

{#if data.aiConfigured}
	<div class="card mb-6">
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-sm font-semibold text-gray-900">What can we cook?</h2>
			<form
				method="POST"
				action="?/suggestDishes"
				use:enhance={() => {
					suggesting = true;
					return async ({ update }) => {
						await update();
						suggesting = false;
					};
				}}
			>
				<button type="submit" class="btn-primary" disabled={suggesting}>
					{suggesting ? 'Thinking…' : 'Suggest dishes'}
				</button>
			</form>
		</div>
		{#if form?.suggestion}
			<p class="mt-3 whitespace-pre-line text-sm text-gray-900">{form.suggestion}</p>
		{/if}
		{#if form?.error}
			<p class="mt-3 text-xs text-red-600">{form.error}</p>
		{/if}
		<p class="mt-2 text-xs text-gray-500">
			Plan a suggested dish on the <a href="/meals" class="link">meal planner</a> — once it's confirmed
			cooked, you can decrement the ingredients used from this list and add anything missing to the
			shopping list from there.
		</p>
	</div>
{/if}

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
		<input name="category" placeholder="Category (e.g. Diepvries)" required class="input" />
		<input name="item" placeholder="Item name" required class="input" />
		<input type="number" name="quantity" placeholder="Quantity" min="0" step="1" value="1" required class="input" />
		<label class="flex items-center gap-2 text-xs text-gray-600">
			<input type="checkbox" name="low_stock" /> Low stock
		</label>
		<button type="submit" class="btn-primary col-span-2 py-2 text-sm">Save</button>
	</form>
{/if}

{#if visibleItems.length === 0}
	<p class="empty-state">No inventory yet — add an item above.</p>
{:else}
	{#each [...itemsByCategory.entries()] as [category, items] (category)}
		<h2 class="mb-2 mt-4 text-xs font-semibold uppercase text-gray-400">{category}</h2>
		<ul class="space-y-2">
			{#each items as i (i.id)}
				<li class="rounded-lg border border-gray-200 p-3">
					{#if editingId === i.id}
						<form
							method="POST"
							action="?/update"
							use:enhance={() => async ({ update }) => {
								await update();
								editingId = null;
							}}
							class="grid grid-cols-1 gap-2 sm:grid-cols-2"
						>
							<input type="hidden" name="id" value={i.id} />
							<input name="category" value={i.category} required class="input" />
							<input name="item" value={i.item} required class="input" />
							<input type="number" name="quantity" value={i.quantity} min="0" step="1" required class="input" />
							<label class="flex items-center gap-2 text-xs text-gray-600">
								<input type="checkbox" name="low_stock" checked={!!i.low_stock} /> Low stock
							</label>
							<div class="col-span-2 flex gap-2">
								<button type="submit" class="btn-primary">Save</button>
								<button type="button" onclick={() => (editingId = null)} class="btn-outline">Cancel</button>
							</div>
						</form>
					{:else}
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-900">{i.item}</span>
								{#if i.low_stock}<span class="badge-strong">Low stock</span>{/if}
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<button type="button" onclick={() => adjust(i.id, -1)} class="btn-outline px-2" aria-label="Decrease">
									−
								</button>
								<span class="w-6 text-center text-sm font-semibold text-gray-900">{i.quantity}</span>
								<button type="button" onclick={() => adjust(i.id, 1)} class="btn-outline px-2" aria-label="Increase">
									+
								</button>
								<button type="button" onclick={() => (editingId = i.id)} class="btn-outline">Edit</button>
								<button type="button" onclick={() => undoDelete.requestDelete(i.id, 'Item')} class="btn-danger">
									Delete
								</button>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/each}
{/if}

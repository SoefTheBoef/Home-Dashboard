<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import SwipeableRow from '$lib/SwipeableRow.svelte';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const undoDelete = createUndoDelete('?/delete');

	const visibleItems = $derived(data.items.filter((i) => !undoDelete.isPending(i.id)));
	const toBuy = $derived(visibleItems.filter((i) => !i.purchased));
	const purchased = $derived(visibleItems.filter((i) => i.purchased));

	async function toggleItem(id: number) {
		const fd = new FormData();
		fd.set('id', String(id));
		await fetch('?/toggle', { method: 'POST', body: fd });
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Shopping List — Home Dashboard</title>
</svelte:head>

<h1 class="mb-4 text-xl font-semibold text-gray-900">Shopping List</h1>

<form
	method="POST"
	action="?/create"
	use:enhance={() => async ({ update, formElement }) => {
		await update();
		formElement.reset();
	}}
	class="mb-4 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row"
>
	<input name="name" placeholder="Add an item…" required class="input flex-1 text-base" />
	<input name="quantity" placeholder="Qty (optional)" class="input sm:w-28" />
	<input name="note" placeholder="Note (optional)" class="input sm:w-40" />
	<button type="submit" class="btn-primary px-4 py-2 text-sm">Add</button>
</form>

{#if toBuy.length === 0}
	<p class="empty-state">Nothing on the list right now.</p>
{:else}
	<ul class="space-y-2">
		{#each toBuy as item (item.id)}
			<li class="overflow-hidden rounded-lg border border-gray-200">
				<SwipeableRow onComplete={() => toggleItem(item.id)} onDelete={() => undoDelete.requestDelete(item.id, 'Item')}>
					<div class="flex items-center justify-between gap-2 p-3">
						<div class="flex items-center gap-3">
							<input
								type="checkbox"
								onchange={() => toggleItem(item.id)}
								class="checkbox-touch"
								aria-label="Mark {item.name} purchased"
							/>
							<div>
								<span class="text-sm font-medium text-gray-900">{item.name}</span>
								{#if item.quantity}<span class="ml-2 text-xs text-gray-500">{item.quantity}</span>{/if}
								{#if item.note}<p class="text-xs text-gray-500">{item.note}</p>{/if}
							</div>
						</div>
						<button type="button" onclick={() => undoDelete.requestDelete(item.id, 'Item')} class="btn-danger">
							Delete
						</button>
					</div>
				</SwipeableRow>
			</li>
		{/each}
	</ul>
{/if}

{#if purchased.length > 0}
	<div class="mb-2 mt-6 flex items-center justify-between">
		<h2 class="text-xs font-semibold uppercase text-gray-400">Purchased</h2>
		<form method="POST" action="?/clearPurchased" use:enhance>
			<button type="submit" class="link text-xs">Clear all</button>
		</form>
	</div>
	<ul class="space-y-2">
		{#each purchased as item (item.id)}
			<li class="overflow-hidden rounded-lg border border-gray-200 opacity-60">
				<SwipeableRow onComplete={() => toggleItem(item.id)} onDelete={() => undoDelete.requestDelete(item.id, 'Item')}>
					<div class="flex items-center justify-between gap-2 p-3">
						<div class="flex items-center gap-3">
							<input
								type="checkbox"
								checked
								onchange={() => toggleItem(item.id)}
								class="checkbox-touch"
								aria-label="Mark {item.name} not purchased"
							/>
							<span class="text-sm text-gray-500 line-through">{item.name}</span>
							{#if item.quantity}<span class="ml-2 text-xs text-gray-400">{item.quantity}</span>{/if}
						</div>
						<button type="button" onclick={() => undoDelete.requestDelete(item.id, 'Item')} class="btn-danger">
							Delete
						</button>
					</div>
				</SwipeableRow>
			</li>
		{/each}
	</ul>
{/if}

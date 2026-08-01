<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PersonBadge from '$lib/PersonBadge.svelte';
	import SwipeableRow from '$lib/SwipeableRow.svelte';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import { formatDate } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let showMore = $state(false);
	let editingId = $state<number | null>(null);

	const undoDelete = createUndoDelete('?/delete');

	const visibleTodos = $derived(data.todos.filter((t) => !undoDelete.isPending(t.id)));
	const openTodos = $derived(visibleTodos.filter((t) => !t.completed));
	const doneTodos = $derived(visibleTodos.filter((t) => t.completed));

	async function toggleTodo(id: number) {
		const fd = new FormData();
		fd.set('id', String(id));
		await fetch('?/toggle', { method: 'POST', body: fd });
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>To-Dos — Home Dashboard</title>
</svelte:head>

<h1 class="mb-4 text-xl font-semibold text-gray-900">Household To-Dos</h1>

<form
	method="POST"
	action="?/create"
	use:enhance={() => async ({ update, formElement }) => {
		await update();
		formElement.reset();
		showMore = false;
	}}
	class="mb-4 rounded-lg border border-gray-200 bg-white p-3"
>
	<div class="flex gap-2">
		<input name="title" placeholder="Add a task…" required class="input flex-1 text-base" />
		<button type="submit" class="btn-primary px-4 text-sm">Add</button>
	</div>
	<button
		type="button"
		onclick={() => (showMore = !showMore)}
		class="mt-2 text-xs text-gray-500 hover:text-gray-800"
	>
		{showMore ? '− Fewer options' : '+ Due date, assignee, notes'}
	</button>
	{#if showMore}
		<div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
			<input type="date" name="due_date" class="input" />
			<select name="assignee_id" class="input">
				<option value="">Either</option>
				{#each data.users as u (u.id)}
					<option value={u.id}>{u.display_name}</option>
				{/each}
			</select>
			<textarea name="notes" placeholder="Notes (optional)" class="input col-span-2" rows="2"></textarea>
		</div>
	{/if}
</form>

{#snippet todoItem(t: (typeof data.todos)[number])}
	<li class="overflow-hidden rounded-lg border border-gray-200">
		{#if editingId === t.id}
			<form
				method="POST"
				action="?/update"
				use:enhance={() => async ({ update }) => {
					await update();
					editingId = null;
				}}
				class="grid grid-cols-1 gap-2 rounded-lg p-3 sm:grid-cols-2"
			>
				<input type="hidden" name="id" value={t.id} />
				<input name="title" value={t.title} required class="input col-span-2" />
				<input type="date" name="due_date" value={t.due_date ?? ''} class="input" />
				<select name="assignee_id" class="input" value={t.assignee_id ?? ''}>
					<option value="">Either</option>
					{#each data.users as u (u.id)}
						<option value={u.id}>{u.display_name}</option>
					{/each}
				</select>
				<textarea name="notes" class="input col-span-2" rows="2">{t.notes ?? ''}</textarea>
				<div class="col-span-2 flex gap-2">
					<button type="submit" class="btn-primary">Save</button>
					<button type="button" onclick={() => (editingId = null)} class="btn-outline">Cancel</button>
				</div>
			</form>
		{:else}
			<SwipeableRow onComplete={() => toggleTodo(t.id)} onDelete={() => undoDelete.requestDelete(t.id, 'Task')}>
				<div class="flex items-start justify-between gap-2 p-3">
					<div class="flex items-start gap-3">
						<input
							type="checkbox"
							checked={!!t.completed}
							onchange={() => toggleTodo(t.id)}
							class="checkbox-touch mt-0.5"
							aria-label="Mark {t.title} complete"
						/>
						<div>
							<p class="text-sm font-medium {t.completed ? 'text-gray-400 line-through' : 'text-gray-900'}">
								{t.title}
							</p>
							<div class="mt-0.5 flex flex-wrap items-center gap-2">
								{#if t.due_date}<span class="text-xs text-gray-500">Due {formatDate(t.due_date)}</span>{/if}
								<PersonBadge name={t.assignee_name} color={t.assignee_color} />
							</div>
							{#if t.notes}<p class="mt-1 text-xs text-gray-500">{t.notes}</p>{/if}
						</div>
					</div>
					<div class="flex shrink-0 gap-1">
						<button type="button" onclick={() => (editingId = t.id)} class="btn-outline">Edit</button>
						<button type="button" onclick={() => undoDelete.requestDelete(t.id, 'Task')} class="btn-danger">
							Delete
						</button>
					</div>
				</div>
			</SwipeableRow>
		{/if}
	</li>
{/snippet}

{#if openTodos.length === 0 && doneTodos.length === 0}
	<p class="empty-state">No tasks yet — add your first one above.</p>
{:else}
	<ul class="space-y-2">
		{#each openTodos as t (t.id)}
			{@render todoItem(t)}
		{/each}
	</ul>

	{#if doneTodos.length > 0}
		<h2 class="mb-2 mt-6 text-xs font-semibold uppercase text-gray-400">Completed</h2>
		<ul class="space-y-2">
			{#each doneTodos as t (t.id)}
				{@render todoItem(t)}
			{/each}
		</ul>
	{/if}
{/if}

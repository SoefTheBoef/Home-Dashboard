<script lang="ts">
	import { enhance } from '$app/forms';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let editingId = $state<number | null>(null);

	const undoDelete = createUndoDelete('?/delete');
	const visibleNotes = $derived(data.notes.filter((n) => !undoDelete.isPending(n.id)));

	function relativeTime(iso: string): string {
		const then = new Date(iso.replace(' ', 'T') + 'Z');
		const diffMs = Date.now() - then.getTime();
		const mins = Math.round(diffMs / 60_000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.round(hours / 24);
		return `${days}d ago`;
	}
</script>

<svelte:head>
	<title>Notes — Home Dashboard</title>
</svelte:head>

<h1 class="mb-4 text-xl font-semibold text-gray-900">Shared Notes</h1>

<form
	method="POST"
	action="?/create"
	use:enhance={() => async ({ update, formElement }) => {
		await update();
		formElement.reset();
	}}
	class="mb-4 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-start"
>
	<textarea name="body" placeholder="Leave a note for each other…" required class="input flex-1" rows="2"
	></textarea>
	<button type="submit" class="btn-primary px-3 py-2 text-sm">Post note</button>
</form>

{#if visibleNotes.length === 0}
	<p class="empty-state">No notes yet — leave one above.</p>
{:else}
	<ul class="space-y-2">
		{#each visibleNotes as n (n.id)}
			<li class="card">
				{#if editingId === n.id}
					<form
						method="POST"
						action="?/update"
						use:enhance={() => async ({ update }) => {
							await update();
							editingId = null;
						}}
						class="flex flex-col gap-2"
					>
						<input type="hidden" name="id" value={n.id} />
						<textarea name="body" class="input" rows="2" required>{n.body}</textarea>
						<div class="flex gap-2">
							<button type="submit" class="btn-primary">Save</button>
							<button type="button" onclick={() => (editingId = null)} class="btn-outline">Cancel</button>
						</div>
					</form>
				{:else}
					<div class="flex items-start justify-between gap-2">
						<div>
							<p class="text-sm text-gray-900">{n.body}</p>
							<p class="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
								{#if n.author_name}
									<span class="inline-block h-2 w-2 rounded-full" style="background-color:{n.author_color}"
									></span>{n.author_name} ·
								{/if}
								{relativeTime(n.created_at)}
								{#if n.updated_at !== n.created_at}(edited){/if}
							</p>
						</div>
						<div class="flex shrink-0 gap-1">
							<button type="button" onclick={() => (editingId = n.id)} class="btn-outline">Edit</button>
							<button type="button" onclick={() => undoDelete.requestDelete(n.id, 'Note')} class="btn-danger">
								Delete
							</button>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

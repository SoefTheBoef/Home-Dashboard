<script lang="ts">
	import { enhance } from '$app/forms';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let uploading = $state(false);

	const undoDelete = createUndoDelete('?/delete');
	const visiblePhotos = $derived(data.photos.filter((p) => !undoDelete.isPending(p.id)));
</script>

<svelte:head>
	<title>Photos — Home Dashboard</title>
</svelte:head>

<div class="mb-4 flex items-center justify-between">
	<div>
		<h1 class="text-xl font-semibold text-gray-900">Photos</h1>
		<p class="text-xs text-gray-500">Shown as a rotating slideshow on the dashboard.</p>
	</div>
</div>

<form
	method="POST"
	action="?/upload"
	enctype="multipart/form-data"
	use:enhance={() => {
		uploading = true;
		return async ({ update, formElement }) => {
			await update();
			formElement.reset();
			uploading = false;
		};
	}}
	class="mb-4 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center"
>
	<input
		type="file"
		name="photo"
		accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
		required
		class="input flex-1"
	/>
	<button type="submit" disabled={uploading} class="btn-primary px-3 py-2 text-sm">
		{uploading ? 'Uploading…' : 'Upload photo'}
	</button>
</form>

{#if form?.error}
	<p class="mb-4 text-sm font-medium text-gray-800">{form.error}</p>
{/if}

{#if visiblePhotos.length === 0}
	<p class="empty-state">No photos yet — upload one above.</p>
{:else}
	<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each visiblePhotos as p (p.id)}
			<li class="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
				<img src="/photos/file/{p.filename}" alt={p.original_name ?? ''} class="aspect-square w-full object-cover" />
				<button
					type="button"
					onclick={() => undoDelete.requestDelete(p.id, 'Photo')}
					class="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-gray-700 shadow hover:bg-white"
					aria-label="Delete photo"
				>
					Delete
				</button>
			</li>
		{/each}
	</ul>
{/if}

<script lang="ts">
	interface Photo {
		id: number;
		filename: string;
	}

	let { photos, intervalMs = 5000 }: { photos: Photo[]; intervalMs?: number } = $props();

	let index = $state(0);

	$effect(() => {
		if (photos.length <= 1) return;
		const timer = setInterval(() => {
			index = (index + 1) % photos.length;
		}, intervalMs);
		return () => clearInterval(timer);
	});
</script>

{#if photos.length === 0}
	<div class="flex aspect-video items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
		<p class="text-sm text-gray-400">No photos yet</p>
	</div>
{:else}
	<div class="relative aspect-video overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
		{#each photos as p, i (p.id)}
			<img
				src="/photos/file/{p.filename}"
				alt=""
				class="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out"
				style="opacity: {i === index ? 1 : 0}"
			/>
		{/each}
	</div>
{/if}

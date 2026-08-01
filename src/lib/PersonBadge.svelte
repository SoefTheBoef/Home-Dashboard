<script lang="ts">
	let {
		name,
		color,
		size = 'sm'
	}: { name: string | null | undefined; color: string | null | undefined; size?: 'sm' | 'md' } =
		$props();

	const dotSize = $derived(size === 'md' ? 'h-3 w-3' : 'h-2 w-2');
	const textSize = $derived(size === 'md' ? 'text-sm' : 'text-xs');
</script>

{#if name}
	<span class="inline-flex items-center gap-1.5 {textSize} text-gray-500">
		<span class="inline-block {dotSize} shrink-0 rounded-full" style="background-color:{color ?? '#6b7280'}"
		></span>
		{name}
	</span>
{:else}
	<span class="inline-flex items-center gap-1.5 {textSize} text-gray-400">
		<span class="inline-block {dotSize} shrink-0 rounded-full border border-dashed border-gray-400"
		></span>
		Either
	</span>
{/if}

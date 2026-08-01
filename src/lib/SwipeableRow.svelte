<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		onComplete,
		onDelete,
		children
	}: {
		onComplete?: () => void;
		onDelete?: () => void;
		children: Snippet;
	} = $props();

	const THRESHOLD = 72;
	let dragX = $state(0);
	let dragging = $state(false);
	let startX = 0;
	let pointerId: number | null = null;

	function onPointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		// Let taps on real controls (buttons, checkboxes, links) behave normally — only a drag that
		// starts on the row's background should be treated as a swipe gesture.
		const target = e.target as HTMLElement;
		if (target.closest('button, a, input, textarea, select, label')) return;
		dragging = true;
		startX = e.clientX;
		pointerId = e.pointerId;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		let dx = e.clientX - startX;
		if (!onComplete) dx = Math.min(dx, 0);
		if (!onDelete) dx = Math.max(dx, 0);
		dragX = dx;
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		dragging = false;
		pointerId = null;
		if (dragX > THRESHOLD && onComplete) {
			onComplete();
		} else if (dragX < -THRESHOLD && onDelete) {
			onDelete();
		}
		dragX = 0;
	}
</script>

<div class="relative overflow-hidden rounded-lg">
	{#if onComplete || onDelete}
		<div class="absolute inset-0 flex items-center justify-between px-4 text-sm font-semibold text-white">
			<span
				class="rounded-md bg-wood-600 px-2 py-1 transition-opacity"
				style="opacity: {Math.min(Math.max(dragX / THRESHOLD, 0), 1)}"
			>
				✓ Done
			</span>
			<span
				class="rounded-md bg-gray-700 px-2 py-1 transition-opacity"
				style="opacity: {Math.min(Math.max(-dragX / THRESHOLD, 0), 1)}"
			>
				Delete
			</span>
		</div>
	{/if}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative touch-pan-y bg-white dark:bg-gray-900 {dragging
			? ''
			: 'transition-transform duration-200'}"
		style="transform: translateX({dragX}px)"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		{@render children()}
	</div>
</div>

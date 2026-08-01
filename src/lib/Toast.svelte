<script lang="ts">
	import { toasts } from './toastStore.svelte';
</script>

{#if toasts.items.length > 0}
	<div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
		{#each toasts.items as t (t.id)}
			<div
				class="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700"
			>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm text-gray-900">{t.message}</p>
					{#if t.showUndo}
						<div class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
							<div
								class="h-full bg-wood-500"
								style="animation: toast-shrink {t.durationMs}ms linear forwards"
							></div>
						</div>
					{/if}
				</div>
				{#if t.showUndo}
					<button
						type="button"
						onclick={() => toasts.undo(t.id)}
						class="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-wood-700 hover:bg-wood-50 dark:text-wood-300 dark:hover:bg-gray-800"
					>
						Undo
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	@keyframes toast-shrink {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}
</style>

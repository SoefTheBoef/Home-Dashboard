<script lang="ts">
	interface ActivityRow {
		id: number;
		summary: string;
		actor_name: string | null;
		actor_color: string | null;
		created_at: string;
	}

	let { activity, unreadCount }: { activity: ActivityRow[]; unreadCount: number } = $props();

	let open = $state(false);
	let cleared = $state(false);
	const displayedUnread = $derived(cleared ? 0 : unreadCount);

	function relativeTime(iso: string): string {
		const then = new Date(iso.replace(' ', 'T') + 'Z');
		const mins = Math.round((Date.now() - then.getTime()) / 60_000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.round(hours / 24)}d ago`;
	}

	async function toggle() {
		open = !open;
		if (open && displayedUnread > 0) {
			cleared = true;
			await fetch('/notifications', { method: 'POST' });
		}
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={toggle}
		class="relative rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
		aria-label="Notifications"
	>
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
			<path
				d="M12 2a6 6 0 0 0-6 6v3.09c0 .5-.17.99-.49 1.38L4 14.5c-.8.98-.12 2.5 1.14 2.5h13.72c1.26 0 1.94-1.52 1.14-2.5l-1.51-2.03A2.25 2.25 0 0 1 18 11.09V8a6 6 0 0 0-6-6ZM9.5 19a2.5 2.5 0 0 0 5 0h-5Z"
			/>
		</svg>
		{#if displayedUnread > 0}
			<span
				class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-wood-600 px-1 text-[10px] font-bold text-white"
			>
				{displayedUnread > 9 ? '9+' : displayedUnread}
			</span>
		{/if}
	</button>

	{#if open}
		<button type="button" class="fixed inset-0 z-10 cursor-default" onclick={() => (open = false)} aria-label="Close"
		></button>
		<div
			class="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800"
		>
			<p class="px-2 py-1 text-xs font-semibold uppercase text-gray-400">Recent activity</p>
			{#if activity.length === 0}
				<p class="p-3 text-sm text-gray-400">Nothing yet.</p>
			{:else}
				<ul class="max-h-80 space-y-0.5 overflow-y-auto">
					{#each activity as a (a.id)}
						<li class="rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
							<p class="text-sm text-gray-900">{a.summary}</p>
							<p class="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
								{#if a.actor_name}
									<span class="inline-block h-2 w-2 rounded-full" style="background-color:{a.actor_color}"
									></span>{a.actor_name} ·
								{/if}
								{relativeTime(a.created_at)}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

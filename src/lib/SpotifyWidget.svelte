<script lang="ts">
	interface PlaybackState {
		connected: boolean;
		hasActiveDevice?: boolean;
		isPlaying?: boolean;
		trackName?: string | null;
		artistName?: string | null;
		albumImage?: string | null;
		volumePercent?: number | null;
		playlist?: { id: string; name: string; image: string | null } | null;
	}

	let playbackState = $state<PlaybackState | null>(null);
	let busy = $state(false);
	let errorMsg = $state('');

	async function refresh() {
		try {
			const res = await fetch('/spotify/state');
			playbackState = await res.json();
		} catch {
			// transient network hiccup — keep last known state
		}
	}

	async function sendAction(action: string, volume?: number) {
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch('/spotify/playback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, volume })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				errorMsg = body.error ?? 'Playback action failed.';
			}
		} finally {
			busy = false;
			setTimeout(refresh, 500);
		}
	}

	$effect(() => {
		refresh();
		const timer = setInterval(refresh, 10_000);
		return () => clearInterval(timer);
	});
</script>

{#if playbackState?.connected}
	<div class="card flex flex-wrap items-center justify-between gap-4">
		<div class="flex min-w-0 items-center gap-3">
			{#if playbackState.albumImage}
				<img src={playbackState.albumImage} alt="" class="h-12 w-12 shrink-0 rounded-md object-cover" />
			{:else}
				<span class="text-2xl">🎵</span>
			{/if}
			<div class="min-w-0">
				{#if playbackState.trackName}
					<p class="truncate text-sm font-medium text-gray-900">{playbackState.trackName}</p>
					<p class="truncate text-xs text-gray-500">{playbackState.artistName}</p>
				{:else}
					<p class="text-sm font-medium text-gray-900">{playbackState.playlist?.name ?? 'Spotify'}</p>
					<p class="text-xs text-gray-500">
						{playbackState.hasActiveDevice ? 'Ready to play' : 'Open Spotify on a device to control playback'}
					</p>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				disabled={busy}
				onclick={() => sendAction('previous')}
				class="btn-outline px-2.5"
				aria-label="Previous track"
			>
				⏮
			</button>
			<button
				type="button"
				disabled={busy}
				onclick={() => sendAction(playbackState?.isPlaying ? 'pause' : 'play')}
				class="btn-primary px-3"
				aria-label={playbackState.isPlaying ? 'Pause' : 'Play'}
			>
				{playbackState.isPlaying ? '⏸' : '▶'}
			</button>
			<button
				type="button"
				disabled={busy}
				onclick={() => sendAction('next')}
				class="btn-outline px-2.5"
				aria-label="Next track"
			>
				⏭
			</button>
			{#if playbackState.volumePercent !== null && playbackState.volumePercent !== undefined}
				<input
					type="range"
					min="0"
					max="100"
					value={playbackState.volumePercent}
					onchange={(e) => sendAction('volume', Number(e.currentTarget.value))}
					class="ml-1 w-20 accent-wood-600"
					aria-label="Volume"
				/>
			{/if}
		</div>
	</div>
	{#if errorMsg}
		<p class="mt-1 text-xs text-gray-500">{errorMsg}</p>
	{/if}
{:else if playbackState && !playbackState.connected}
	<a href="/spotify" class="card flex items-center gap-3 text-sm text-gray-500 hover:text-gray-800">
		<span class="text-2xl">🎵</span>
		Connect Spotify to play music from here
	</a>
{/if}

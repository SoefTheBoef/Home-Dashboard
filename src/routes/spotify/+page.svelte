<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const errorMessages: Record<string, string> = {
		access_denied: 'Spotify authorization was cancelled.',
		state_mismatch: 'Something went wrong during sign-in — please try again.',
		token_exchange_failed: 'Could not complete sign-in with Spotify — please try again.'
	};
</script>

<svelte:head>
	<title>Spotify — Home Dashboard</title>
</svelte:head>

<h1 class="mb-4 text-xl font-semibold text-gray-900">Spotify</h1>

{#if data.error}
	<p class="empty-state mb-4 border-wood-400 text-wood-700 dark:text-wood-300">
		{errorMessages[data.error] ?? 'Something went wrong.'}
	</p>
{/if}

{#if !data.configured}
	<div class="empty-state">
		<p class="mb-1 font-medium text-gray-600">Spotify isn't set up yet.</p>
		<p>
			Create an app at
			<span class="font-mono text-xs">developer.spotify.com/dashboard</span>, then set
			<span class="font-mono text-xs">SPOTIFY_CLIENT_ID</span>,
			<span class="font-mono text-xs">SPOTIFY_CLIENT_SECRET</span> and
			<span class="font-mono text-xs">SPOTIFY_REDIRECT_URI</span> in your <span class="font-mono text-xs">.env</span> file.
		</p>
	</div>
{:else if !data.connected}
	<div class="card text-center">
		<span class="text-4xl">🎵</span>
		<p class="mt-2 mb-4 text-sm text-gray-500">Connect a Spotify account to play a playlist from the dashboard.</p>
		<a href="/spotify/connect" class="btn-primary inline-block px-4 py-2 text-sm">Connect Spotify</a>
	</div>
{:else}
	<div class="card mb-6 flex items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			{#if data.playlist?.image}
				<img src={data.playlist.image} alt="" class="h-14 w-14 rounded-md object-cover" />
			{:else}
				<span class="text-3xl">🎵</span>
			{/if}
			<div>
				<p class="text-xs text-gray-500">Selected playlist</p>
				<p class="text-sm font-semibold text-gray-900">{data.playlist?.name ?? 'None selected yet'}</p>
			</div>
		</div>
		<form method="POST" action="?/disconnect" use:enhance>
			<button type="submit" class="btn-outline">Disconnect</button>
		</form>
	</div>

	<h2 class="mb-2 text-sm font-semibold text-gray-900">Choose a playlist</h2>
	{#if data.playlistError}
		<p class="empty-state border-wood-400 text-wood-700 dark:text-wood-300">{data.playlistError}</p>
	{:else if data.playlists.length === 0}
		<p class="empty-state">No playlists found on this Spotify account.</p>
	{:else}
		<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{#each data.playlists as p (p.id)}
				<li>
					<form method="POST" action="?/selectPlaylist" use:enhance>
						<input type="hidden" name="id" value={p.id} />
						<input type="hidden" name="name" value={p.name} />
						<input type="hidden" name="image" value={p.image ?? ''} />
						<button
							type="submit"
							class="w-full overflow-hidden rounded-lg border p-2 text-left transition-colors {data.playlist?.id ===
							p.id
								? 'border-wood-500 bg-wood-50 dark:bg-wood-900/20'
								: 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800'}"
						>
							{#if p.image}
								<img src={p.image} alt="" class="mb-2 aspect-square w-full rounded object-cover" />
							{:else}
								<div class="mb-2 flex aspect-square w-full items-center justify-center rounded bg-gray-100 text-2xl dark:bg-gray-800">
									🎵
								</div>
							{/if}
							<p class="truncate text-xs font-medium text-gray-900">{p.name}</p>
							<p class="text-[10px] text-gray-500">{p.trackCount} tracks</p>
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

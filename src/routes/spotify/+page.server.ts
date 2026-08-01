import type { Actions, PageServerLoad } from './$types';
import {
	disconnect as disconnectSpotify,
	getConnection,
	getValidAccessToken,
	isConfigured,
	savePlaylist,
	spotifyFetch
} from '$lib/server/spotify';

export interface PlaylistOption {
	id: string;
	name: string;
	image: string | null;
	trackCount: number;
}

export const load: PageServerLoad = async ({ url }) => {
	const configured = isConfigured();
	const connection = await getConnection();
	const connected = Boolean(connection?.refresh_token);

	let playlists: PlaylistOption[] = [];
	let playlistError: string | null = null;
	if (connected) {
		const token = await getValidAccessToken();
		if (!token) {
			playlistError = 'Could not refresh your Spotify session — try disconnecting and reconnecting.';
		} else {
			const res = await spotifyFetch('/me/playlists?limit=50', token);
			if (res.ok) {
				const data = await res.json();
				playlists = (data.items ?? []).map(
					(p: { id: string; name: string; images?: { url: string }[]; tracks?: { total: number } }) => ({
						id: p.id,
						name: p.name,
						image: p.images?.[0]?.url ?? null,
						trackCount: p.tracks?.total ?? 0
					})
				);
			} else {
				const body = await res.text();
				playlistError = `Spotify couldn't load your playlists (${res.status}): ${body || 'no details returned'}`;
			}
		}
	}

	return {
		configured,
		connected,
		playlist:
			connected && connection?.playlist_id
				? { id: connection.playlist_id, name: connection.playlist_name, image: connection.playlist_image }
				: null,
		playlists,
		playlistError,
		error: url.searchParams.get('error')
	};
};

export const actions: Actions = {
	selectPlaylist: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '');
		const image = String(form.get('image') ?? '') || null;
		if (id) await savePlaylist(id, name, image);
		return { success: true };
	},

	disconnect: async () => {
		await disconnectSpotify();
		return { success: true };
	}
};

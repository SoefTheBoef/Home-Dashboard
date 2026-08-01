import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection, getValidAccessToken, spotifyFetch } from '$lib/server/spotify';

export const POST: RequestHandler = async ({ request }) => {
	const token = await getValidAccessToken();
	if (!token) {
		return json({ error: 'Spotify is not connected.' }, { status: 400 });
	}

	const body = await request.json();
	const action = String(body.action ?? '');

	if (action === 'play') {
		const connection = await getConnection();
		const playlistUri = connection?.playlist_id ? `spotify:playlist:${connection.playlist_id}` : null;

		// Resume in place if we're already playing this playlist; otherwise start it from the top.
		const stateRes = await spotifyFetch('/me/player', token);
		let alreadyOnPlaylist = false;
		if (stateRes.ok && stateRes.status !== 204) {
			const state = await stateRes.json();
			alreadyOnPlaylist = state?.context?.uri === playlistUri;
		}

		const res = await spotifyFetch('/me/player/play', token, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: alreadyOnPlaylist || !playlistUri ? undefined : JSON.stringify({ context_uri: playlistUri })
		});

		if (!res.ok && res.status !== 204) {
			return json({ error: 'No active Spotify device — open Spotify on a speaker or device first.' }, { status: 409 });
		}
		return json({ success: true });
	}

	if (action === 'pause') {
		const res = await spotifyFetch('/me/player/pause', token, { method: 'PUT' });
		if (!res.ok && res.status !== 204) {
			return json({ error: 'No active Spotify device.' }, { status: 409 });
		}
		return json({ success: true });
	}

	if (action === 'next') {
		await spotifyFetch('/me/player/next', token, { method: 'POST' });
		return json({ success: true });
	}

	if (action === 'previous') {
		await spotifyFetch('/me/player/previous', token, { method: 'POST' });
		return json({ success: true });
	}

	if (action === 'volume') {
		const volume = Math.max(0, Math.min(100, Number(body.volume)));
		await spotifyFetch(`/me/player/volume?volume_percent=${volume}`, token, { method: 'PUT' });
		return json({ success: true });
	}

	return json({ error: 'Unknown action.' }, { status: 400 });
};

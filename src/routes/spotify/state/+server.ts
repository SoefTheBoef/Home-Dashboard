import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection, getValidAccessToken, spotifyFetch } from '$lib/server/spotify';

export interface PlaybackState {
	connected: boolean;
	hasActiveDevice: boolean;
	isPlaying: boolean;
	trackName: string | null;
	artistName: string | null;
	albumImage: string | null;
	volumePercent: number | null;
	playlist: { id: string; name: string; image: string | null } | null;
}

export const GET: RequestHandler = async () => {
	const connection = await getConnection();
	if (!connection?.refresh_token) {
		return json({ connected: false } satisfies Partial<PlaybackState>);
	}

	const playlist = connection.playlist_id
		? { id: connection.playlist_id, name: connection.playlist_name ?? '', image: connection.playlist_image }
		: null;

	const token = await getValidAccessToken();
	if (!token) {
		return json({ connected: false } satisfies Partial<PlaybackState>);
	}

	const res = await spotifyFetch('/me/player', token);

	if (res.status === 204 || !res.ok) {
		return json({
			connected: true,
			hasActiveDevice: false,
			isPlaying: false,
			trackName: null,
			artistName: null,
			albumImage: null,
			volumePercent: null,
			playlist
		} satisfies PlaybackState);
	}

	const data = await res.json();

	return json({
		connected: true,
		hasActiveDevice: Boolean(data.device),
		isPlaying: Boolean(data.is_playing),
		trackName: data.item?.name ?? null,
		artistName: data.item?.artists?.map((a: { name: string }) => a.name).join(', ') ?? null,
		albumImage: data.item?.album?.images?.[0]?.url ?? null,
		volumePercent: data.device?.volume_percent ?? null,
		playlist
	} satisfies PlaybackState);
};

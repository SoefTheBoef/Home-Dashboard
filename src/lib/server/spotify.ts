import { db } from './db';
import { env } from '$env/dynamic/private';

export const SPOTIFY_SCOPES = [
	'streaming',
	'user-read-playback-state',
	'user-modify-playback-state',
	'user-read-currently-playing',
	'playlist-read-private',
	'playlist-read-collaborative'
].join(' ');

interface ConnectionRow {
	access_token: string | null;
	refresh_token: string | null;
	expires_at: number | null;
	playlist_id: string | null;
	playlist_name: string | null;
	playlist_image: string | null;
}

export async function getConnection(): Promise<ConnectionRow | null> {
	const row = (await db
		.prepare(
			'SELECT access_token, refresh_token, expires_at, playlist_id, playlist_name, playlist_image FROM spotify_connection WHERE id = 1'
		)
		.get()) as ConnectionRow | undefined;
	return row ?? null;
}

export function isConfigured(): boolean {
	return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REDIRECT_URI);
}

export async function saveTokens(
	accessToken: string,
	refreshToken: string | null,
	expiresInSeconds: number,
	connectedBy: number
): Promise<void> {
	const expiresAt = Date.now() + expiresInSeconds * 1000;
	await db
		.prepare(
			`INSERT INTO spotify_connection (id, access_token, refresh_token, expires_at, connected_by)
			 VALUES (1, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   access_token = excluded.access_token,
			   refresh_token = COALESCE(excluded.refresh_token, spotify_connection.refresh_token),
			   expires_at = excluded.expires_at,
			   connected_by = excluded.connected_by`
		)
		.run(accessToken, refreshToken, expiresAt, connectedBy);
}

export async function savePlaylist(id: string, name: string, image: string | null): Promise<void> {
	await db
		.prepare('UPDATE spotify_connection SET playlist_id = ?, playlist_name = ?, playlist_image = ? WHERE id = 1')
		.run(id, name, image);
}

export async function disconnect(): Promise<void> {
	await db.prepare('DELETE FROM spotify_connection WHERE id = 1').run();
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
	const basicAuth = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${basicAuth}`
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		})
	});

	if (!res.ok) return null;
	return res.json();
}

/** Returns a valid access token, refreshing it first if it's expired or about to expire. */
export async function getValidAccessToken(): Promise<string | null> {
	const conn = await getConnection();
	if (!conn?.access_token || !conn.refresh_token) return null;

	const expiresSoon = !conn.expires_at || conn.expires_at < Date.now() + 60_000;
	if (!expiresSoon) return conn.access_token;

	const refreshed = await refreshAccessToken(conn.refresh_token);
	if (!refreshed) return null;

	await db
		.prepare('UPDATE spotify_connection SET access_token = ?, expires_at = ? WHERE id = 1')
		.run(refreshed.access_token, Date.now() + refreshed.expires_in * 1000);

	return refreshed.access_token;
}

export async function spotifyFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
	return fetch(`https://api.spotify.com/v1${path}`, {
		...init,
		headers: {
			...init?.headers,
			Authorization: `Bearer ${token}`
		}
	});
}

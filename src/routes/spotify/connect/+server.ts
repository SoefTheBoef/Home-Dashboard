import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { isConfigured, SPOTIFY_SCOPES } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ cookies, url }) => {
	if (!isConfigured()) {
		throw error(500, 'Spotify is not configured. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REDIRECT_URI.');
	}

	const state = randomBytes(16).toString('hex');
	cookies.set('spotify_oauth_state', state, {
		path: '/',
		httpOnly: true,
		maxAge: 600,
		sameSite: 'lax',
		secure: url.protocol === 'https:'
	});

	const params = new URLSearchParams({
		response_type: 'code',
		client_id: env.SPOTIFY_CLIENT_ID ?? '',
		scope: SPOTIFY_SCOPES,
		redirect_uri: env.SPOTIFY_REDIRECT_URI ?? '',
		state
	});

	throw redirect(302, `https://accounts.spotify.com/authorize?${params.toString()}`);
};

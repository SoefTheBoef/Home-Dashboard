import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { saveTokens } from '$lib/server/spotify';

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
}

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('spotify_oauth_state');
	cookies.delete('spotify_oauth_state', { path: '/' });

	if (url.searchParams.get('error')) {
		throw redirect(303, '/spotify?error=access_denied');
	}

	if (!code || !state || state !== storedState) {
		throw redirect(303, '/spotify?error=state_mismatch');
	}

	const basicAuth = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${basicAuth}`
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: env.SPOTIFY_REDIRECT_URI ?? ''
		})
	});

	if (!res.ok) {
		throw redirect(303, '/spotify?error=token_exchange_failed');
	}

	const json = (await res.json()) as TokenResponse;
	saveTokens(json.access_token, json.refresh_token ?? null, json.expires_in, locals.user!.id);

	throw redirect(303, '/spotify');
};

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (sessionId) {
		await invalidateSession(sessionId);
		cookies.delete(SESSION_COOKIE, { path: '/' });
	}
	throw redirect(303, '/login');
};

import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, SESSION_DURATION_MS, validateSession } from '$lib/server/auth';
import '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(SESSION_COOKIE);
	const user = sessionId ? await validateSession(sessionId) : null;
	event.locals.user = user;

	if (user && sessionId) {
		// Keep the browser-side cookie in step with the sliding server-side session expiry so an
		// actively-used device (e.g. a living-room display) never gets logged out on its own.
		event.cookies.set(SESSION_COOKIE, sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:',
			expires: new Date(Date.now() + SESSION_DURATION_MS)
		});
	}

	const isLoginRoute = event.url.pathname === '/login';

	if (!user && !isLoginRoute) {
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
	}

	if (user && isLoginRoute) {
		throw redirect(303, '/');
	}

	return resolve(event);
};

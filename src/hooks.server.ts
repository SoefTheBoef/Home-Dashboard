import { isRedirect, redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { SESSION_COOKIE, SESSION_DURATION_MS, validateSession } from '$lib/server/auth';
import { warmup } from '$lib/server/db';
import { withTimeout } from '$lib/server/timeout';

// Kick off schema setup/seeding the moment the server process boots, instead of leaving it to
// block whichever request happens to run the first database query (previously that was almost
// always the first login attempt after a deploy).
warmup();

// AI-backed routes (Claude API calls, PDF text extraction) can legitimately take longer than a
// normal page/action — give them more room before the safety-net timeout below kicks in.
const SLOW_ROUTES = ['/assistant/ask', '/calendar'];
const DEFAULT_TIMEOUT_MS = 25_000;
const SLOW_ROUTE_TIMEOUT_MS = 60_000;

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	const label = `${event.request.method} ${event.url.pathname}`;
	const timeoutMs = SLOW_ROUTES.includes(event.url.pathname) ? SLOW_ROUTE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

	// Logged before anything else runs so a request that never completes still shows up in
	// Render's logs — previously only the completion log existed, so a hang was invisible.
	console.log(`${label} received`);

	try {
		const response = await withTimeout(Promise.resolve(handleRequest({ event, resolve })), timeoutMs, label);
		console.log(`${label} -> ${response.status} (${Date.now() - start}ms)`);
		return response;
	} catch (err) {
		// redirect() throws by design as SvelteKit's control-flow mechanism — not a real failure.
		if (isRedirect(err)) throw err;

		console.error(`${label} -> threw after ${Date.now() - start}ms:`, err);

		if (err instanceof Error && err.message.endsWith('timed out')) {
			return new Response('The server took too long to respond. Please try again.', {
				status: 504,
				headers: { 'content-type': 'text/plain' }
			});
		}
		throw err;
	}
};

/** Handles auth + routing; separated from the logging wrapper above for readability. */
const handleRequest: Handle = async ({ event, resolve }) => {
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

/** Catches anything the app didn't handle itself (e.g. a DB query timing out) so it shows up in
 *  Render's logs with a stack trace instead of the request just hanging or a bare 500. */
export const handleError: HandleServerError = ({ error, event }) => {
	console.error(`Unhandled error on ${event.request.method} ${event.url.pathname}:`, error);
	return { message: 'Something went wrong on our end — please try again in a moment.' };
};

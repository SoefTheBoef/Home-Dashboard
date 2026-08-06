import { fail, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { SESSION_COOKIE, createSession, findUserByUsername, verifyPassword } from '$lib/server/auth';
import { logWhenSettled, withTimeout } from '$lib/server/timeout';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/');
	}
	return {};
};

// Deliberately set above the DB layer's own connect+query timeouts (10s + 10s in
// src/lib/server/db.ts) rather than below them. An outer timeout smaller than the layers beneath
// it always fires first and only ever reports its own fixed value — which is exactly what made
// every failed login look identical at ~8000ms regardless of what was actually happening
// underneath. Once the real cause is fixed, this can come back down for snappier user-facing
// failures; for now it's set to let the inner timeout's true duration/error surface instead of
// masking it.
const DB_TIMEOUT_MS = 22_000;

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		try {
			if (!username || !password) {
				return fail(400, { error: 'Username and password are required.', username });
			}

			const user = await withTimeout(
				logWhenSettled(findUserByUsername(username), 'Login user lookup (raw)'),
				DB_TIMEOUT_MS,
				'Login user lookup'
			);

			if (!user || !(await verifyPassword(password, user.password_hash))) {
				return fail(400, { error: 'Invalid username or password.', username });
			}

			const session = await withTimeout(createSession(user.id), DB_TIMEOUT_MS, 'Login session creation');
			cookies.set(SESSION_COOKIE, session.id, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				expires: new Date(session.expiresAt)
			});

			const redirectTo = url.searchParams.get('redirectTo');
			throw redirect(303, redirectTo && redirectTo.startsWith('/') ? redirectTo : '/');
		} catch (err) {
			// redirect() above throws by design — let it through, it's not a failure.
			if (isRedirect(err)) throw err;

			console.error('Login action failed:', err);

			const timedOut = err instanceof Error && err.message.endsWith('timed out');
			return fail(timedOut ? 504 : 500, {
				error: timedOut
					? "Couldn't reach the database in time — please try again in a moment."
					: 'Something went wrong signing you in — please try again.',
				username
			});
		}
	}
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { markActivitySeen } from '$lib/server/activity';

export const POST: RequestHandler = async ({ locals }) => {
	if (locals.user) await markActivitySeen(locals.user.id);
	return json({ success: true });
};

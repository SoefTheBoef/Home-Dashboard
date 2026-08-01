import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { listNotes } from '$lib/server/notes';
import { logActivity } from '$lib/server/activity';

export const load: PageServerLoad = async () => {
	return { notes: await listNotes() };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();

		if (!body) {
			return fail(400, { error: 'Note can’t be empty.' });
		}

		await db.prepare('INSERT INTO notes (body, author_id) VALUES (?, ?)').run(body, locals.user!.id);
		await logActivity(locals.user!.id, 'posted a note');

		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const body = String(form.get('body') ?? '').trim();

		if (!id || !body) {
			return fail(400, { error: 'Note can’t be empty.' });
		}

		await db
			.prepare("UPDATE notes SET body = ?, updated_at = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?")
			.run(body, id);

		return { success: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM notes WHERE id = ?').run(id);
		}
		return { success: true };
	}
};

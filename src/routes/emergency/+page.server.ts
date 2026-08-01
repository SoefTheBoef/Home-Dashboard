import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { listEmergencyInfo } from '$lib/server/emergency-info';

export const load: PageServerLoad = async () => {
	return { entries: await listEmergencyInfo() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const category = String(form.get('category') ?? 'other');
		const label = String(form.get('label') ?? '').trim();
		const value = String(form.get('value') ?? '').trim();
		const notes = String(form.get('notes') ?? '').trim() || null;

		if (!label || !value) {
			return fail(400, { error: 'Label and value are required.' });
		}

		await db
			.prepare('INSERT INTO emergency_info (category, label, value, notes) VALUES (?, ?, ?, ?)')
			.run(category, label, value, notes);

		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const category = String(form.get('category') ?? 'other');
		const label = String(form.get('label') ?? '').trim();
		const value = String(form.get('value') ?? '').trim();
		const notes = String(form.get('notes') ?? '').trim() || null;

		if (!id || !label || !value) {
			return fail(400, { error: 'Label and value are required.' });
		}

		await db
			.prepare('UPDATE emergency_info SET category = ?, label = ?, value = ?, notes = ? WHERE id = ?')
			.run(category, label, value, notes, id);

		return { success: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM emergency_info WHERE id = ?').run(id);
		}
		return { success: true };
	}
};

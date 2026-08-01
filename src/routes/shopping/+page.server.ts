import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export interface ShoppingItemRow {
	id: number;
	name: string;
	quantity: string | null;
	note: string | null;
	purchased: number;
}

export const load: PageServerLoad = async () => {
	const items = (await db
		.prepare(
			`SELECT id, name, quantity, note, purchased
			 FROM shopping_items
			 ORDER BY purchased ASC, id DESC`
		)
		.all()) as unknown as ShoppingItemRow[];

	return { items };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const quantity = String(form.get('quantity') ?? '').trim() || null;
		const note = String(form.get('note') ?? '').trim() || null;

		if (!name) {
			return fail(400, { error: 'Item name is required.' });
		}

		await db
			.prepare('INSERT INTO shopping_items (name, quantity, note) VALUES (?, ?, ?)')
			.run(name, quantity, note);

		return { success: true };
	},

	toggle: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const item = (await db.prepare('SELECT purchased FROM shopping_items WHERE id = ?').get(id)) as
			| { purchased: number }
			| undefined;
		if (!item) return fail(404, { error: 'Item not found.' });

		await db.prepare('UPDATE shopping_items SET purchased = ? WHERE id = ?').run(
			item.purchased ? 0 : 1,
			id
		);
		return { success: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM shopping_items WHERE id = ?').run(id);
		}
		return { success: true };
	},

	clearPurchased: async () => {
		await db.prepare('DELETE FROM shopping_items WHERE purchased = 1').run();
		return { success: true };
	}
};

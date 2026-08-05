import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { listFoodInventory } from '$lib/server/food';
import { isAiConfigured, suggestDishes } from '$lib/server/ai';

export const load: PageServerLoad = async () => {
	return {
		items: await listFoodInventory(),
		aiConfigured: isAiConfigured()
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const category = String(form.get('category') ?? '').trim();
		const item = String(form.get('item') ?? '').trim();
		const quantity = Number(form.get('quantity') ?? 0);
		const lowStock = form.get('low_stock') === 'on';

		if (!category || !item || Number.isNaN(quantity)) {
			return fail(400, { error: 'Category, item name and quantity are required.' });
		}

		await db
			.prepare('INSERT INTO food_inventory (category, item, quantity, low_stock) VALUES (?, ?, ?, ?)')
			.run(category, item, quantity, lowStock ? 1 : 0);

		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const category = String(form.get('category') ?? '').trim();
		const item = String(form.get('item') ?? '').trim();
		const quantity = Number(form.get('quantity') ?? 0);
		const lowStock = form.get('low_stock') === 'on';

		if (!id || !category || !item || Number.isNaN(quantity)) {
			return fail(400, { error: 'Category, item name and quantity are required.' });
		}

		await db
			.prepare(
				`UPDATE food_inventory SET category = ?, item = ?, quantity = ?, low_stock = ?,
				 updated_at = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?`
			)
			.run(category, item, quantity, lowStock ? 1 : 0, id);

		return { success: true };
	},

	adjust: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const delta = Number(form.get('delta'));

		const row = (await db.prepare('SELECT quantity FROM food_inventory WHERE id = ?').get(id)) as
			| { quantity: number }
			| undefined;
		if (!row) return fail(404, { error: 'Item not found.' });

		const nextQuantity = Math.max(0, row.quantity + delta);
		await db
			.prepare(
				`UPDATE food_inventory SET quantity = ?, low_stock = CASE WHEN ? <= 0 THEN 1 ELSE low_stock END,
				 updated_at = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?`
			)
			.run(nextQuantity, nextQuantity, id);

		return { success: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM food_inventory WHERE id = ?').run(id);
		}
		return { success: true };
	},

	suggestDishes: async () => {
		try {
			const suggestion = await suggestDishes();
			return { suggestion };
		} catch (err) {
			return fail(502, { error: err instanceof Error ? err.message : 'The assistant request failed.' });
		}
	}
};

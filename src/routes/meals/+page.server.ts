import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { addDays, mondayOf, todayYmd } from '$lib/calendar-date';

/** Inventory item names are often qualified ("Eieren (12 stuks)") — match on the core noun only. */
function coreName(name: string): string {
	return name.split('(')[0].trim().toLowerCase();
}

function matchesInventory(ingredientLine: string, inventoryItemName: string): boolean {
	const line = ingredientLine.toLowerCase();
	const core = coreName(inventoryItemName);
	return core.length > 0 && (line.includes(core) || core.includes(line));
}

export interface MealEntryRow {
	id: number;
	date: string;
	title: string;
	ingredients: string | null;
	notes: string | null;
}

export const load: PageServerLoad = async ({ url }) => {
	const requestedStart = url.searchParams.get('start');
	const start = mondayOf(requestedStart || todayYmd());
	const weekDates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
	const end = weekDates[6] as string;

	const entries = (await db
		.prepare(
			`SELECT id, date, title, ingredients, notes
			 FROM meal_plan_entries
			 WHERE date BETWEEN ? AND ?
			 ORDER BY date ASC`
		)
		.all(start, end)) as unknown as MealEntryRow[];

	return { start, weekDates, entries };
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const date = String(form.get('date') ?? '');
		const title = String(form.get('title') ?? '').trim();
		const ingredients = String(form.get('ingredients') ?? '').trim() || null;
		const notes = String(form.get('notes') ?? '').trim() || null;

		if (!date || !title) {
			return fail(400, { error: 'A date and a title are required.' });
		}

		await db
			.prepare(
				`INSERT INTO meal_plan_entries (date, title, ingredients, notes) VALUES (?, ?, ?, ?)
				 ON CONFLICT(date) DO UPDATE SET title = excluded.title, ingredients = excluded.ingredients, notes = excluded.notes`
			)
			.run(date, title, ingredients, notes);

		return { success: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM meal_plan_entries WHERE id = ?').run(id);
		}
		return { success: true };
	},

	addIngredientsToShopping: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const entry = (await db.prepare('SELECT ingredients FROM meal_plan_entries WHERE id = ?').get(id)) as
			| { ingredients: string | null }
			| undefined;
		if (!entry?.ingredients) return { success: true };

		const items = entry.ingredients
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);

		const insert = db.prepare('INSERT INTO shopping_items (name) VALUES (?)');
		for (const item of items) {
			await insert.run(item);
		}

		return { success: true, added: items.length };
	},

	confirmCooked: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const entry = (await db.prepare('SELECT ingredients FROM meal_plan_entries WHERE id = ?').get(id)) as
			| { ingredients: string | null }
			| undefined;
		if (!entry?.ingredients) return { success: true, decremented: 0 };

		const lines = entry.ingredients
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);

		const inventory = (await db.prepare('SELECT id, item, quantity FROM food_inventory').all()) as unknown as {
			id: number;
			item: string;
			quantity: number;
		}[];

		let decremented = 0;
		for (const line of lines) {
			const match = inventory.find((i) => matchesInventory(line, i.item));
			if (!match) continue;
			const nextQuantity = Math.max(0, match.quantity - 1);
			await db
				.prepare(
					`UPDATE food_inventory SET quantity = ?, low_stock = CASE WHEN ? <= 0 THEN 1 ELSE low_stock END,
					 updated_at = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?`
				)
				.run(nextQuantity, nextQuantity, match.id);
			decremented++;
		}

		return { success: true, decremented };
	},

	addMissingToShopping: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const entry = (await db.prepare('SELECT ingredients FROM meal_plan_entries WHERE id = ?').get(id)) as
			| { ingredients: string | null }
			| undefined;
		if (!entry?.ingredients) return { success: true, added: 0 };

		const lines = entry.ingredients
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);

		const inventory = (await db.prepare('SELECT item FROM food_inventory').all()) as unknown as { item: string }[];
		const missing = lines.filter((line) => !inventory.some((i) => matchesInventory(line, i.item)));

		const insert = db.prepare('INSERT INTO shopping_items (name) VALUES (?)');
		for (const item of missing) {
			await insert.run(item);
		}

		return { success: true, added: missing.length };
	}
};

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { addDays, mondayOf, todayYmd } from '$lib/calendar-date';

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
	}
};

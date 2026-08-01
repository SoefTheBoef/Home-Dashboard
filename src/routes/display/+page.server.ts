import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { listPhotos } from '$lib/server/photos';
import { getWeather } from '$lib/server/weather';
import { listNotes } from '$lib/server/notes';
import { listEmergencyInfo } from '$lib/server/emergency-info';
import { getCollectionsOn } from '$lib/server/waste';
import { ensureRecurringBills } from '$lib/server/bills';
import { ensureRecurringEvents } from '$lib/server/event-series';
import { addDays, todayYmd } from '$lib/calendar-date';
import { logActivity } from '$lib/server/activity';

export const load: PageServerLoad = async () => {
	await ensureRecurringBills();
	await ensureRecurringEvents();

	const today = todayYmd();
	const tomorrow = addDays(today, 1);
	const soon = addDays(today, 7);

	const todaysEvents = (await db
		.prepare(
			`SELECT e.id, e.title, e.start_at, e.end_at, e.all_day, e.location, e.applies_to, e.event_type,
			        u.display_name as user_name, u.color as user_color
			 FROM events e
			 LEFT JOIN users u ON u.id = CAST(e.applies_to AS INTEGER) AND e.applies_to != 'both'
			 WHERE substr(e.start_at, 1, 10) = ?
			 ORDER BY e.all_day DESC, e.start_at ASC`
		)
		.all(today)) as unknown as {
		id: number;
		title: string;
		start_at: string;
		end_at: string | null;
		all_day: number;
		location: string | null;
		applies_to: string;
		event_type: string;
		user_name: string | null;
		user_color: string | null;
	}[];

	const unpaidBills = (await db
		.prepare(
			`SELECT id, name, amount, due_date
			 FROM bills
			 WHERE paid = 0 AND due_date <= ?
			 ORDER BY due_date ASC`
		)
		.all(soon)) as unknown as { id: number; name: string; amount: number; due_date: string }[];

	const openTodos = (await db
		.prepare(
			`SELECT t.id, t.title, t.due_date, u.display_name as assignee_name, u.color as assignee_color
			 FROM todos t
			 LEFT JOIN users u ON u.id = t.assignee_id
			 WHERE t.completed = 0
			 ORDER BY (t.due_date IS NULL), t.due_date ASC`
		)
		.all()) as unknown as {
		id: number;
		title: string;
		due_date: string | null;
		assignee_name: string | null;
		assignee_color: string | null;
	}[];

	const shoppingItems = (await db
		.prepare(
			`SELECT id, name, quantity, note FROM shopping_items WHERE purchased = 0 ORDER BY id DESC`
		)
		.all()) as unknown as { id: number; name: string; quantity: string | null; note: string | null }[];

	const todaysMeal = (await db
		.prepare('SELECT title, ingredients FROM meal_plan_entries WHERE date = ?')
		.get(today)) as { title: string; ingredients: string | null } | undefined;

	const nextTrip = (await db
		.prepare(
			`SELECT id, name, start_date, end_date
			 FROM trips
			 WHERE COALESCE(end_date, start_date) >= ?
			 ORDER BY start_date ASC
			 LIMIT 1`
		)
		.get(today)) as
		| { id: number; name: string; start_date: string; end_date: string | null }
		| undefined;

	const allEmergencyInfo = await listEmergencyInfo();

	return {
		todaysEvents,
		unpaidBills,
		openTodos,
		shoppingItems,
		todaysMeal: todaysMeal ?? null,
		nextTrip: nextTrip ?? null,
		photos: (await listPhotos()).slice(0, 20),
		weather: await getWeather(),
		notes: await listNotes(5),
		wifiInfo: allEmergencyInfo.filter((e) => e.category === 'wifi'),
		wasteToday: await getCollectionsOn(today),
		wasteTomorrow: await getCollectionsOn(tomorrow)
	};
};

export const actions: Actions = {
	toggleTodo: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const todo = (await db.prepare('SELECT title, completed FROM todos WHERE id = ?').get(id)) as
			| { title: string; completed: number }
			| undefined;
		if (!todo) return fail(404, { error: 'Todo not found.' });

		await db.prepare('UPDATE todos SET completed = ? WHERE id = ?').run(todo.completed ? 0 : 1, id);
		if (!todo.completed) await logActivity(locals.user!.id, `completed "${todo.title}"`);
		return { success: true };
	},

	toggleShopping: async ({ request }) => {
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

	addNote: async ({ request, locals }) => {
		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();
		if (!body) return fail(400, { error: 'Note can’t be empty.' });

		await db.prepare('INSERT INTO notes (body, author_id) VALUES (?, ?)').run(body, locals.user!.id);
		await logActivity(locals.user!.id, 'posted a note');
		return { success: true };
	}
};

import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { listPhotos } from '$lib/server/photos';
import { getWeather } from '$lib/server/weather';
import { getCollectionOn, getNextCollection, WASTE_TYPES } from '$lib/server/waste';
import { listNotes } from '$lib/server/notes';
import { ensureRecurringEvents } from '$lib/server/event-series';
import { getTodayPrayerTimes } from '$lib/server/prayer-times';
import { addDays, todayYmd } from '$lib/calendar-date';

function inNDaysYmd(n: number): string {
	return addDays(todayYmd(), n);
}

export const load: PageServerLoad = async () => {
	await ensureRecurringEvents();

	const today = todayYmd();
	const soon = inNDaysYmd(7);

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

	const unpaidBillsDueSoon = (await db
		.prepare(
			`SELECT id, name, amount, due_date, category
			 FROM bills
			 WHERE paid = 0 AND due_date <= ?
			 ORDER BY due_date ASC`
		)
		.all(soon)) as unknown as {
		id: number;
		name: string;
		amount: number;
		due_date: string;
		category: string | null;
	}[];

	const billsDueToday = unpaidBillsDueSoon.filter((b) => b.due_date === today);

	const openTodos = (await db
		.prepare(
			`SELECT t.id, t.title, t.due_date, u.display_name as assignee_name, u.color as assignee_color
			 FROM todos t
			 LEFT JOIN users u ON u.id = t.assignee_id
			 WHERE t.completed = 0
			 ORDER BY (t.due_date IS NULL), t.due_date ASC
			 LIMIT 8`
		)
		.all()) as unknown as {
		id: number;
		title: string;
		due_date: string | null;
		assignee_name: string | null;
		assignee_color: string | null;
	}[];

	const shoppingCount = (await db
		.prepare('SELECT COUNT(*) as count FROM shopping_items WHERE purchased = 0')
		.get()) as { count: number };

	const balanceRow = (await db
		.prepare(
			`SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
			 FROM transactions`
		)
		.get()) as { balance: number };

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

	const todaysMeal = (await db
		.prepare('SELECT title, ingredients FROM meal_plan_entries WHERE date = ?')
		.get(today)) as { title: string; ingredients: string | null } | undefined;

	const allNotes = await listNotes(5);
	const notesToday = allNotes.filter((n) => n.created_at.slice(0, 10) === today);

	return {
		todaysEvents,
		unpaidBillsDueSoon,
		billsDueToday,
		openTodos,
		shoppingCount: shoppingCount.count,
		balance: balanceRow.balance,
		nextTrip: nextTrip ?? null,
		photos: (await listPhotos()).slice(0, 20),
		weather: await getWeather(),
		todaysMeal: todaysMeal ?? null,
		wasteToday: await getCollectionOn(today),
		nextCollection: await getNextCollection(today),
		wasteTypes: WASTE_TYPES,
		notesToday,
		prayerTimes: getTodayPrayerTimes()
	};
};

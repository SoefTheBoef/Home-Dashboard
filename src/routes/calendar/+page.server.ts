import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getAllUsers } from '$lib/server/users';
import { getMonthGrid, todayYmd, ymd } from '$lib/calendar-date';
import { ensureRecurringEvents } from '$lib/server/event-series';
import { logActivity } from '$lib/server/activity';
import {
	deleteWasteCollection,
	getNextCollection,
	listWasteCollections,
	replaceYear,
	upsertWasteCollection,
	WASTE_TYPES
} from '$lib/server/waste';
import { getTodayPrayerTimes } from '$lib/server/prayer-times';
import { parseWasteCalendarText } from '$lib/server/ai';

export interface EventRow {
	id: number;
	title: string;
	start_at: string;
	end_at: string | null;
	all_day: number;
	location: string | null;
	notes: string | null;
	applies_to: string;
	event_type: string;
	series_id: number | null;
}

export interface EventSeriesRow {
	id: number;
	title: string;
	weekdays: string;
	start_time: string | null;
	end_time: string | null;
	location: string | null;
	notes: string | null;
	applies_to: string;
	event_type: string;
	series_start_date: string;
	series_end_date: string | null;
	active: number;
}

export interface TripRow {
	id: number;
	name: string;
	start_date: string;
	end_date: string | null;
	notes: string | null;
}

export const load: PageServerLoad = async ({ url }) => {
	await ensureRecurringEvents();

	const now = new Date();
	const year = Number(url.searchParams.get('year')) || now.getFullYear();
	const month = Number(url.searchParams.get('month')) ?? now.getMonth();
	const tab = url.searchParams.get('tab') ?? 'calendar';

	const grid = getMonthGrid(year, month);
	const rangeStart = ymd(grid[0]);
	const rangeEndExclusive = ymd(grid[grid.length - 1] as Date);

	const events = (await db
		.prepare(
			`SELECT id, title, start_at, end_at, all_day, location, notes, applies_to, event_type, series_id
			 FROM events
			 WHERE substr(start_at, 1, 10) BETWEEN ? AND ?
			 ORDER BY start_at ASC`
		)
		.all(rangeStart, rangeEndExclusive)) as unknown as EventRow[];

	const series = (await db
		.prepare(
			`SELECT id, title, weekdays, start_time, end_time, location, notes, applies_to, event_type,
			        series_start_date, series_end_date, active
			 FROM event_series
			 ORDER BY series_start_date ASC`
		)
		.all()) as unknown as EventSeriesRow[];

	const today = todayYmd();
	const wasteCollections = await listWasteCollections();
	const nextCollection = await getNextCollection(today);

	const trips = (await db
		.prepare('SELECT id, name, start_date, end_date, notes FROM trips ORDER BY start_date ASC')
		.all()) as unknown as TripRow[];

	const nextTrip =
		(trips.find((t) => (t.end_date ?? t.start_date) >= today) as TripRow | undefined) ?? null;

	return {
		tab,
		year,
		month,
		grid: grid.map((d) => d.toISOString()),
		events,
		series,
		users: await getAllUsers(),
		wasteCollections,
		nextCollection,
		wasteTypes: WASTE_TYPES,
		trips,
		nextTrip,
		prayerTimes: getTodayPrayerTimes()
	};
};

function parseAppliesTo(value: FormDataEntryValue | null): string {
	return value ? String(value) : 'both';
}

export const actions: Actions = {
	createEvent: async ({ request, locals }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const date = String(form.get('date') ?? '');
		const allDay = form.get('all_day') === 'on';
		const time = String(form.get('time') ?? '');
		const endTime = String(form.get('end_time') ?? '');
		const location = String(form.get('location') ?? '').trim() || null;
		const notes = String(form.get('notes') ?? '').trim() || null;
		const appliesTo = parseAppliesTo(form.get('applies_to'));
		const eventType = String(form.get('event_type') ?? 'event');

		if (!title || !date) {
			return fail(400, { error: 'Title and date are required.' });
		}

		const startAt = allDay || !time ? date : `${date}T${time}`;
		const endAt = allDay ? null : endTime ? `${date}T${endTime}` : null;

		await db
			.prepare(
				`INSERT INTO events (title, start_at, end_at, all_day, location, notes, applies_to, event_type)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(title, startAt, endAt, allDay ? 1 : 0, location, notes, appliesTo, eventType);

		await logActivity(locals.user!.id, `added "${title}" to the calendar (${date})`);

		return { success: true };
	},

	updateEvent: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const title = String(form.get('title') ?? '').trim();
		const date = String(form.get('date') ?? '');
		const allDay = form.get('all_day') === 'on';
		const time = String(form.get('time') ?? '');
		const endTime = String(form.get('end_time') ?? '');
		const location = String(form.get('location') ?? '').trim() || null;
		const notes = String(form.get('notes') ?? '').trim() || null;
		const appliesTo = parseAppliesTo(form.get('applies_to'));
		const eventType = String(form.get('event_type') ?? 'event');

		if (!id || !title || !date) {
			return fail(400, { error: 'Title and date are required.' });
		}

		const startAt = allDay || !time ? date : `${date}T${time}`;
		const endAt = allDay ? null : endTime ? `${date}T${endTime}` : null;

		await db
			.prepare(
				`UPDATE events SET title = ?, start_at = ?, end_at = ?, all_day = ?, location = ?, notes = ?, applies_to = ?, event_type = ?
				 WHERE id = ?`
			)
			.run(title, startAt, endAt, allDay ? 1 : 0, location, notes, appliesTo, eventType, id);

		return { success: true };
	},

	deleteEvent: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM events WHERE id = ?').run(id);
		}
		return { success: true };
	},

	createSeries: async ({ request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const weekdays = form.getAll('weekdays').map(String);
		const startTime = String(form.get('start_time') ?? '').trim() || null;
		const endTime = String(form.get('end_time') ?? '').trim() || null;
		const appliesTo = parseAppliesTo(form.get('applies_to'));
		const location = String(form.get('location') ?? '').trim() || null;
		const notes = String(form.get('notes') ?? '').trim() || null;
		const seriesStartDate = String(form.get('series_start_date') ?? '');
		const seriesEndDate = String(form.get('series_end_date') ?? '').trim() || null;

		if (!title || weekdays.length === 0 || !seriesStartDate) {
			return fail(400, {
				error: 'Title, at least one weekday, and a start date are required.'
			});
		}

		await db
			.prepare(
				`INSERT INTO event_series
				 (title, weekdays, start_time, end_time, location, notes, applies_to, event_type, series_start_date, series_end_date)
				 VALUES (?, ?, ?, ?, ?, ?, ?, 'work', ?, ?)`
			)
			.run(
				title,
				weekdays.join(','),
				startTime,
				endTime,
				location,
				notes,
				appliesTo,
				seriesStartDate,
				seriesEndDate
			);

		await ensureRecurringEvents();

		return { success: true };
	},

	updateSeries: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const title = String(form.get('title') ?? '').trim();
		const weekdays = form.getAll('weekdays').map(String);
		const startTime = String(form.get('start_time') ?? '').trim() || null;
		const endTime = String(form.get('end_time') ?? '').trim() || null;
		const appliesTo = parseAppliesTo(form.get('applies_to'));
		const location = String(form.get('location') ?? '').trim() || null;
		const notes = String(form.get('notes') ?? '').trim() || null;
		const seriesStartDate = String(form.get('series_start_date') ?? '');
		const seriesEndDate = String(form.get('series_end_date') ?? '').trim() || null;

		if (!id || !title || weekdays.length === 0 || !seriesStartDate) {
			return fail(400, {
				error: 'Title, at least one weekday, and a start date are required.'
			});
		}

		await db
			.prepare(
				`UPDATE event_series
				 SET title = ?, weekdays = ?, start_time = ?, end_time = ?, location = ?, notes = ?,
				     applies_to = ?, series_start_date = ?, series_end_date = ?
				 WHERE id = ?`
			)
			.run(
				title,
				weekdays.join(','),
				startTime,
				endTime,
				location,
				notes,
				appliesTo,
				seriesStartDate,
				seriesEndDate,
				id
			);

		await ensureRecurringEvents();

		return { success: true };
	},

	toggleSeriesActive: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const s = (await db.prepare('SELECT active FROM event_series WHERE id = ?').get(id)) as
			| { active: number }
			| undefined;
		if (!s) return fail(404, { error: 'Series not found.' });

		await db.prepare('UPDATE event_series SET active = ? WHERE id = ?').run(s.active ? 0 : 1, id);

		if (!s.active) await ensureRecurringEvents();

		return { success: true };
	},

	deleteSeries: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM event_series WHERE id = ?').run(id);
		}
		return { success: true };
	},

	upsertWaste: async ({ request }) => {
		const form = await request.formData();
		const date = String(form.get('date') ?? '');
		const types = form.getAll('types').map(String);

		if (!date || types.length === 0) {
			return fail(400, { error: 'A date and at least one collection type are required.' });
		}

		await upsertWasteCollection(date, types);

		return { success: true };
	},

	deleteWaste: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await deleteWasteCollection(id);
		}
		return { success: true };
	},

	importWastePdf: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('pdf');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { importError: 'Choose a PDF file first.' });
		}

		try {
			const { PDFParse } = await import('pdf-parse');
			const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
			const { text } = await parser.getText();
			await parser.destroy();

			const preview = await parseWasteCalendarText(text);
			return { importPreview: preview };
		} catch (err) {
			return fail(502, {
				importError: err instanceof Error ? err.message : 'Could not read that PDF — try again.'
			});
		}
	},

	confirmWasteImport: async ({ request }) => {
		const form = await request.formData();
		const payload = String(form.get('payload') ?? '');

		try {
			const { year, entries } = JSON.parse(payload) as {
				year: number;
				entries: { date: string; types: string[] }[];
			};
			await replaceYear(year, entries);
			return { success: true, importedYear: year };
		} catch {
			return fail(400, { importError: 'That preview data looked corrupted — try re-importing.' });
		}
	},

	createTrip: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const startDate = String(form.get('start_date') ?? '');
		const endDate = String(form.get('end_date') ?? '').trim() || null;
		const notes = String(form.get('notes') ?? '').trim() || null;

		if (!name || !startDate) {
			return fail(400, { error: 'Trip name and start date are required.' });
		}

		await db
			.prepare('INSERT INTO trips (name, start_date, end_date, notes) VALUES (?, ?, ?, ?)')
			.run(name, startDate, endDate, notes);

		return { success: true };
	},

	updateTrip: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const name = String(form.get('name') ?? '').trim();
		const startDate = String(form.get('start_date') ?? '');
		const endDate = String(form.get('end_date') ?? '').trim() || null;
		const notes = String(form.get('notes') ?? '').trim() || null;

		if (!id || !name || !startDate) {
			return fail(400, { error: 'Trip name and start date are required.' });
		}

		await db
			.prepare('UPDATE trips SET name = ?, start_date = ?, end_date = ?, notes = ? WHERE id = ?')
			.run(name, startDate, endDate, notes, id);

		return { success: true };
	},

	deleteTrip: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM trips WHERE id = ?').run(id);
		}
		return { success: true };
	}
};

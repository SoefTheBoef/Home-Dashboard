import { db } from './db';

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function ymd(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const GENERATE_DAYS_AHEAD = 90;

interface SeriesRow {
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
}

/**
 * For every active recurring event series, ensure event instances exist for each matching
 * weekday within the next GENERATE_DAYS_AHEAD days (capped at series_end_date). Safe to call on
 * every request — it's a no-op once that window has been generated.
 */
export async function ensureRecurringEvents(): Promise<void> {
	const series = (await db
		.prepare(
			`SELECT id, title, weekdays, start_time, end_time, location, notes, applies_to, event_type,
			        series_start_date, series_end_date
			 FROM event_series WHERE active = 1`
		)
		.all()) as unknown as SeriesRow[];

	if (series.length === 0) return;

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const horizon = new Date(today);
	horizon.setDate(horizon.getDate() + GENERATE_DAYS_AHEAD);

	const insertStmt = db.prepare(
		`INSERT INTO events (title, start_at, end_at, all_day, location, notes, applies_to, event_type, series_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const existsStmt = db.prepare(
		'SELECT id FROM events WHERE series_id = ? AND substr(start_at, 1, 10) = ?'
	);

	for (const s of series) {
		const weekdays = new Set(s.weekdays.split(',').map(Number));
		const seriesStart = new Date(`${s.series_start_date}T00:00:00`);
		const seriesEnd = s.series_end_date ? new Date(`${s.series_end_date}T00:00:00`) : null;

		const rangeStart = seriesStart > today ? seriesStart : today;
		const rangeEnd = seriesEnd && seriesEnd < horizon ? seriesEnd : horizon;

		for (const d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
			if (!weekdays.has(d.getDay())) continue;
			const dateStr = ymd(d);
			if (await existsStmt.get(s.id, dateStr)) continue;

			const allDay = !s.start_time;
			const startAt = allDay ? dateStr : `${dateStr}T${s.start_time}`;
			const endAt = !allDay && s.end_time ? `${dateStr}T${s.end_time}` : null;

			await insertStmt.run(
				s.title,
				startAt,
				endAt,
				allDay ? 1 : 0,
				s.location,
				s.notes,
				s.applies_to,
				s.event_type,
				s.id
			);
		}
	}
}

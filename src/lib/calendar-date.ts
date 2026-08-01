export function pad(n: number): string {
	return String(n).padStart(2, '0');
}

export function ymd(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateStr: string, n: number): string {
	const d = new Date(`${dateStr}T00:00:00`);
	d.setDate(d.getDate() + n);
	return ymd(d);
}

/** Returns the Monday (YYYY-MM-DD) of the week containing the given date. */
export function mondayOf(dateStr: string): string {
	const d = new Date(`${dateStr}T00:00:00`);
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return ymd(d);
}

export { todayYmdBrussels as todayYmd } from './format';

/** Returns a 6x7 grid of Date objects (Sunday-first) covering the given month. */
export function getMonthGrid(year: number, month: number): Date[] {
	const firstOfMonth = new Date(year, month, 1);
	const startOffset = firstOfMonth.getDay();
	const gridStart = new Date(year, month, 1 - startOffset);

	return Array.from({ length: 42 }, (_, i) => {
		const d = new Date(gridStart);
		d.setDate(gridStart.getDate() + i);
		return d;
	});
}

export const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

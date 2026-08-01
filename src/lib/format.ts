export const BRUSSELS_TZ = 'Europe/Brussels';

/** Belgian-style EUR formatting: "1.234,56 €" */
export function formatCurrency(amount: number): string {
	const formatted = Math.abs(amount).toLocaleString('de-DE', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
	return `${amount < 0 ? '-' : ''}${formatted} €`;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function formatDate(dateStr: string): string {
	const [y, m, d] = dateStr.split('-');
	return `${d}/${m}/${y}`;
}

/** Today's date as YYYY-MM-DD in Europe/Brussels, regardless of server/browser timezone. */
export function todayYmdBrussels(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: BRUSSELS_TZ }).format(new Date());
}

/** Current Brussels wall-clock time, 24h "HH:MM". */
export function nowTimeBrussels(): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone: BRUSSELS_TZ,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(new Date());
}

/** e.g. "Saturday, 1 August" in Europe/Brussels. */
export function formatLongDate(date: Date): string {
	return date.toLocaleDateString('en-GB', {
		timeZone: BRUSSELS_TZ,
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
}

/** Short weekday label (e.g. "Mon") for a 'YYYY-MM-DD' date, timezone-safe. */
export function formatWeekdayShort(dateStr: string): string {
	return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', {
		timeZone: BRUSSELS_TZ,
		weekday: 'short'
	});
}

import { db } from './db';

export interface WasteScheduleRow {
	id: number;
	label: string;
	weekday: number;
	cadence: 'weekly' | 'biweekly';
	anchor_date: string;
	color: string;
}

export async function listWasteSchedules(): Promise<WasteScheduleRow[]> {
	return (await db
		.prepare('SELECT id, label, weekday, cadence, anchor_date, color FROM waste_schedules ORDER BY weekday ASC')
		.all()) as unknown as WasteScheduleRow[];
}

export function isCollectionDate(schedule: WasteScheduleRow, dateStr: string): boolean {
	const d = new Date(`${dateStr}T00:00:00`);
	if (d.getDay() !== schedule.weekday) return false;
	if (schedule.cadence === 'weekly') return true;

	const anchor = new Date(`${schedule.anchor_date}T00:00:00`);
	const diffDays = Math.round((d.getTime() - anchor.getTime()) / 86_400_000);
	const diffWeeks = diffDays / 7;
	return Number.isInteger(diffWeeks) && Math.abs(Math.round(diffWeeks)) % 2 === 0;
}

export async function getCollectionsOn(dateStr: string): Promise<WasteScheduleRow[]> {
	const schedules = await listWasteSchedules();
	return schedules.filter((s) => isCollectionDate(s, dateStr));
}

/** Next occurrence of this schedule on or after fromDateStr, searching up to 14 days ahead. */
export function getNextCollectionDate(schedule: WasteScheduleRow, fromDateStr: string): string | null {
	const from = new Date(`${fromDateStr}T00:00:00`);
	for (let i = 0; i < 14; i++) {
		const d = new Date(from);
		d.setDate(d.getDate() + i);
		const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		if (isCollectionDate(schedule, dateStr)) return dateStr;
	}
	return null;
}

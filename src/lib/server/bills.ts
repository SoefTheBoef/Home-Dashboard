import { db } from './db';

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

interface BillTemplateRow {
	id: number;
	name: string;
	amount: number;
	category: string | null;
	due_day: number;
}

/**
 * For every active fixed-monthly bill template, ensure an unpaid bill instance exists for the
 * current calendar month. Safe to call on every request — it's a no-op once this month's
 * instances have been generated.
 */
export async function ensureRecurringBills(): Promise<void> {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth(); // 0-indexed
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const monthStart = `${year}-${pad(month + 1)}-01`;
	const nextMonthStart = `${month === 11 ? year + 1 : year}-${pad(((month + 1) % 12) + 1)}-01`;

	const templates = (await db
		.prepare('SELECT id, name, amount, category, due_day FROM bill_templates WHERE active = 1')
		.all()) as unknown as BillTemplateRow[];

	for (const t of templates) {
		const existing = await db
			.prepare('SELECT id FROM bills WHERE template_id = ? AND due_date >= ? AND due_date < ?')
			.get(t.id, monthStart, nextMonthStart);
		if (existing) continue;

		const dueDay = Math.min(t.due_day, daysInMonth);
		const dueDate = `${year}-${pad(month + 1)}-${pad(dueDay)}`;

		await db
			.prepare(
				'INSERT INTO bills (name, amount, due_date, category, template_id) VALUES (?, ?, ?, ?, ?)'
			)
			.run(t.name, t.amount, dueDate, t.category, t.id);
	}
}

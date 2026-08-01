import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getAllUsers } from '$lib/server/users';
import { ensureRecurringBills } from '$lib/server/bills';
import { logActivity } from '$lib/server/activity';
import { todayYmd } from '$lib/calendar-date';

export interface TransactionRow {
	id: number;
	type: 'income' | 'expense';
	amount: number;
	category: string;
	date: string;
	description: string | null;
	logged_by: number | null;
	logger_name: string | null;
	logger_color: string | null;
}

export interface BillRow {
	id: number;
	name: string;
	amount: number;
	due_date: string;
	category: string | null;
	paid: number;
	paid_date: string | null;
	template_id: number | null;
	transaction_id: number | null;
}

export interface BillTemplateRow {
	id: number;
	name: string;
	amount: number;
	category: string | null;
	due_day: number;
	active: number;
}

export interface SubscriptionRow {
	id: number;
	name: string;
	amount: number;
	billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
	next_charge_date: string;
	category: string | null;
	active: number;
}

function monthRange(now = new Date()): { start: string; end: string } {
	const y = now.getFullYear();
	const m = now.getMonth();
	const pad = (n: number) => String(n).padStart(2, '0');
	const start = `${y}-${pad(m + 1)}-01`;
	const nextMonth = new Date(y, m + 1, 1);
	const end = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`;
	return { start, end };
}

function advanceDate(dateStr: string, cycle: string): string {
	const d = new Date(`${dateStr}T00:00:00`);
	if (cycle === 'weekly') d.setDate(d.getDate() + 7);
	else if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
	else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
	else d.setFullYear(d.getFullYear() + 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const load: PageServerLoad = async ({ url }) => {
	await ensureRecurringBills();

	const dateFrom = url.searchParams.get('from') ?? '';
	const dateTo = url.searchParams.get('to') ?? '';
	const category = url.searchParams.get('category') ?? '';
	const type = url.searchParams.get('type') ?? '';
	const tab = url.searchParams.get('tab') ?? 'transactions';

	const clauses: string[] = [];
	const params: (string | number)[] = [];

	if (dateFrom) {
		clauses.push('t.date >= ?');
		params.push(dateFrom);
	}
	if (dateTo) {
		clauses.push('t.date <= ?');
		params.push(dateTo);
	}
	if (category) {
		clauses.push('t.category = ?');
		params.push(category);
	}
	if (type) {
		clauses.push('t.type = ?');
		params.push(type);
	}

	const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

	const transactions = (await db
		.prepare(
			`SELECT t.id, t.type, t.amount, t.category, t.date, t.description, t.logged_by,
			        u.display_name as logger_name, u.color as logger_color
			 FROM transactions t
			 LEFT JOIN users u ON u.id = t.logged_by
			 ${where}
			 ORDER BY t.date DESC, t.id DESC`
		)
		.all(...params)) as unknown as TransactionRow[];

	const balanceRow = (await db
		.prepare(
			`SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
			 FROM transactions`
		)
		.get()) as { balance: number };

	const { start, end } = monthRange();
	const monthSummary = (await db
		.prepare(
			`SELECT
				COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
				COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
			 FROM transactions
			 WHERE date >= ? AND date < ?`
		)
		.get(start, end)) as { income: number; expenses: number };

	const categoryBreakdown = (await db
		.prepare(
			`SELECT category, SUM(amount) as total
			 FROM transactions
			 WHERE type = 'expense' AND date >= ? AND date < ?
			 GROUP BY category
			 ORDER BY total DESC`
		)
		.all(start, end)) as unknown as { category: string; total: number }[];

	const categories = (await db
		.prepare('SELECT DISTINCT category FROM transactions ORDER BY category ASC')
		.all()) as unknown as { category: string }[];

	const bills = (await db
		.prepare(
			`SELECT id, name, amount, due_date, category, paid, paid_date, template_id, transaction_id
			 FROM bills
			 ORDER BY paid ASC, due_date ASC`
		)
		.all()) as unknown as BillRow[];

	const templates = (await db
		.prepare(
			`SELECT id, name, amount, category, due_day, active
			 FROM bill_templates
			 ORDER BY due_day ASC`
		)
		.all()) as unknown as BillTemplateRow[];

	const subscriptions = (await db
		.prepare(
			`SELECT id, name, amount, billing_cycle, next_charge_date, category, active
			 FROM subscriptions
			 ORDER BY active DESC, next_charge_date ASC`
		)
		.all()) as unknown as SubscriptionRow[];

	return {
		tab,
		transactions,
		balance: balanceRow.balance,
		monthIncome: monthSummary.income,
		monthExpenses: monthSummary.expenses,
		categoryBreakdown,
		categories: categories.map((c) => c.category),
		users: await getAllUsers(),
		filters: { dateFrom, dateTo, category, type },
		bills,
		templates,
		subscriptions
	};
};

export const actions: Actions = {
	createTransaction: async ({ request, locals }) => {
		const form = await request.formData();
		const type = String(form.get('type') ?? 'expense');
		const amount = Number(form.get('amount'));
		const category = String(form.get('category') ?? '').trim();
		const date = String(form.get('date') ?? '');
		const description = String(form.get('description') ?? '').trim() || null;

		if (!amount || amount <= 0 || !category || !date) {
			return fail(400, { error: 'Amount, category and date are required.' });
		}

		await db
			.prepare(
				`INSERT INTO transactions (type, amount, category, date, description, logged_by)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.run(type, amount, category, date, description, locals.user!.id);

		return { success: true };
	},

	deleteTransaction: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
		}
		return { success: true };
	},

	createBill: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const amount = Number(form.get('amount'));
		const dueDate = String(form.get('due_date') ?? '');
		const category = String(form.get('category') ?? '').trim() || null;

		if (!name || !amount || amount <= 0 || !dueDate) {
			return fail(400, { error: 'Name, amount and due date are required.' });
		}

		await db
			.prepare('INSERT INTO bills (name, amount, due_date, category) VALUES (?, ?, ?, ?)')
			.run(name, amount, dueDate, category);

		await logActivity(locals.user!.id, `added the bill "${name}"`);

		return { success: true };
	},

	togglePaidBill: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const bill = (await db
			.prepare('SELECT paid, name, amount, transaction_id FROM bills WHERE id = ?')
			.get(id)) as { paid: number; name: string; amount: number; transaction_id: number | null } | undefined;
		if (!bill) return fail(404, { error: 'Bill not found.' });

		if (bill.paid) {
			if (bill.transaction_id) {
				await db.prepare('DELETE FROM transactions WHERE id = ?').run(bill.transaction_id);
			}
			await db
				.prepare('UPDATE bills SET paid = 0, paid_date = NULL, transaction_id = NULL WHERE id = ?')
				.run(id);
			await logActivity(locals.user!.id, `marked "${bill.name}" as unpaid`);
		} else {
			const paidDate = todayYmd();
			const inserted = (await db
				.prepare(
					`INSERT INTO transactions (type, amount, category, date, description, logged_by)
					 VALUES ('expense', ?, 'Bills', ?, ?, ?) RETURNING id`
				)
				.get(bill.amount, paidDate, `Bill: ${bill.name}`, locals.user!.id)) as { id: number };

			await db
				.prepare('UPDATE bills SET paid = 1, paid_date = ?, transaction_id = ? WHERE id = ?')
				.run(paidDate, inserted.id, id);
			await logActivity(locals.user!.id, `marked "${bill.name}" as paid`);
		}

		return { success: true };
	},

	deleteBill: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			const bill = (await db.prepare('SELECT transaction_id FROM bills WHERE id = ?').get(id)) as
				| { transaction_id: number | null }
				| undefined;
			if (bill?.transaction_id) {
				await db.prepare('DELETE FROM transactions WHERE id = ?').run(bill.transaction_id);
			}
			await db.prepare('DELETE FROM bills WHERE id = ?').run(id);
		}
		return { success: true };
	},

	createBillTemplate: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const amount = Number(form.get('amount'));
		const dueDay = Number(form.get('due_day'));
		const category = String(form.get('category') ?? '').trim() || null;

		if (!name || !amount || amount <= 0 || !dueDay || dueDay < 1 || dueDay > 31) {
			return fail(400, { error: 'Name, amount and a due day (1–31) are required.' });
		}

		await db
			.prepare('INSERT INTO bill_templates (name, amount, category, due_day) VALUES (?, ?, ?, ?)')
			.run(name, amount, category, dueDay);

		await ensureRecurringBills();

		return { success: true };
	},

	updateBillTemplate: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const name = String(form.get('name') ?? '').trim();
		const amount = Number(form.get('amount'));
		const dueDay = Number(form.get('due_day'));
		const category = String(form.get('category') ?? '').trim() || null;

		if (!id || !name || !amount || amount <= 0 || !dueDay || dueDay < 1 || dueDay > 31) {
			return fail(400, { error: 'Name, amount and a due day (1–31) are required.' });
		}

		await db
			.prepare('UPDATE bill_templates SET name = ?, amount = ?, category = ?, due_day = ? WHERE id = ?')
			.run(name, amount, category, dueDay, id);

		return { success: true };
	},

	toggleBillTemplateActive: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const template = (await db.prepare('SELECT active FROM bill_templates WHERE id = ?').get(id)) as
			| { active: number }
			| undefined;
		if (!template) return fail(404, { error: 'Fixed bill not found.' });

		await db.prepare('UPDATE bill_templates SET active = ? WHERE id = ?').run(template.active ? 0 : 1, id);

		if (!template.active) await ensureRecurringBills();

		return { success: true };
	},

	deleteBillTemplate: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM bill_templates WHERE id = ?').run(id);
		}
		return { success: true };
	},

	createSubscription: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const amount = Number(form.get('amount'));
		const billingCycle = String(form.get('billing_cycle') ?? 'monthly');
		const nextChargeDate = String(form.get('next_charge_date') ?? '');
		const category = String(form.get('category') ?? '').trim() || null;

		if (!name || !amount || amount <= 0 || !nextChargeDate) {
			return fail(400, { error: 'Name, amount and next charge date are required.' });
		}

		await db
			.prepare(
				'INSERT INTO subscriptions (name, amount, billing_cycle, next_charge_date, category) VALUES (?, ?, ?, ?, ?)'
			)
			.run(name, amount, billingCycle, nextChargeDate, category);

		return { success: true };
	},

	updateSubscription: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const name = String(form.get('name') ?? '').trim();
		const amount = Number(form.get('amount'));
		const billingCycle = String(form.get('billing_cycle') ?? 'monthly');
		const nextChargeDate = String(form.get('next_charge_date') ?? '');
		const category = String(form.get('category') ?? '').trim() || null;

		if (!id || !name || !amount || amount <= 0 || !nextChargeDate) {
			return fail(400, { error: 'Name, amount and next charge date are required.' });
		}

		await db
			.prepare(
				'UPDATE subscriptions SET name = ?, amount = ?, billing_cycle = ?, next_charge_date = ?, category = ? WHERE id = ?'
			)
			.run(name, amount, billingCycle, nextChargeDate, category, id);

		return { success: true };
	},

	renewSubscription: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const sub = (await db
			.prepare('SELECT next_charge_date, billing_cycle FROM subscriptions WHERE id = ?')
			.get(id)) as { next_charge_date: string; billing_cycle: string } | undefined;
		if (!sub) return fail(404, { error: 'Subscription not found.' });

		await db
			.prepare('UPDATE subscriptions SET next_charge_date = ? WHERE id = ?')
			.run(advanceDate(sub.next_charge_date, sub.billing_cycle), id);

		return { success: true };
	},

	toggleSubscriptionActive: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const sub = (await db.prepare('SELECT active FROM subscriptions WHERE id = ?').get(id)) as
			| { active: number }
			| undefined;
		if (!sub) return fail(404, { error: 'Subscription not found.' });

		await db.prepare('UPDATE subscriptions SET active = ? WHERE id = ?').run(sub.active ? 0 : 1, id);

		return { success: true };
	},

	deleteSubscription: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
		}
		return { success: true };
	}
};

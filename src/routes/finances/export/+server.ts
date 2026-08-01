import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';

function csvEscape(value: string): string {
	if (/[",\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

export const GET: RequestHandler = async ({ url }) => {
	const dateFrom = url.searchParams.get('from') ?? '';
	const dateTo = url.searchParams.get('to') ?? '';
	const category = url.searchParams.get('category') ?? '';
	const type = url.searchParams.get('type') ?? '';

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
			`SELECT t.date, t.type, t.category, t.amount, t.description, u.display_name as logger_name
			 FROM transactions t
			 LEFT JOIN users u ON u.id = t.logged_by
			 ${where}
			 ORDER BY t.date ASC, t.id ASC`
		)
		.all(...params)) as unknown as {
		date: string;
		type: string;
		category: string;
		amount: number;
		description: string | null;
		logger_name: string | null;
	}[];

	const header = ['Date', 'Type', 'Category', 'Amount', 'Description', 'Logged by'];
	const rows = transactions.map((t) =>
		[t.date, t.type, t.category, t.amount.toFixed(2), t.description ?? '', t.logger_name ?? ''].map(
			(v) => csvEscape(String(v))
		)
	);

	const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`
		}
	});
};

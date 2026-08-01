import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getAllUsers } from '$lib/server/users';
import { logActivity } from '$lib/server/activity';

export interface TodoRow {
	id: number;
	title: string;
	notes: string | null;
	due_date: string | null;
	assignee_id: number | null;
	assignee_name: string | null;
	assignee_color: string | null;
	completed: number;
}

export const load: PageServerLoad = async () => {
	const todos = (await db
		.prepare(
			`SELECT t.id, t.title, t.notes, t.due_date, t.assignee_id, t.completed,
			        u.display_name as assignee_name, u.color as assignee_color
			 FROM todos t
			 LEFT JOIN users u ON u.id = t.assignee_id
			 ORDER BY t.completed ASC, (t.due_date IS NULL), t.due_date ASC, t.id DESC`
		)
		.all()) as unknown as TodoRow[];

	return { todos, users: await getAllUsers() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const notes = String(form.get('notes') ?? '').trim() || null;
		const dueDate = String(form.get('due_date') ?? '').trim() || null;
		const assigneeRaw = String(form.get('assignee_id') ?? '');
		const assigneeId = assigneeRaw ? Number(assigneeRaw) : null;

		if (!title) {
			return fail(400, { error: 'Title is required.' });
		}

		await db
			.prepare('INSERT INTO todos (title, notes, due_date, assignee_id) VALUES (?, ?, ?, ?)')
			.run(title, notes, dueDate, assigneeId);

		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const title = String(form.get('title') ?? '').trim();
		const notes = String(form.get('notes') ?? '').trim() || null;
		const dueDate = String(form.get('due_date') ?? '').trim() || null;
		const assigneeRaw = String(form.get('assignee_id') ?? '');
		const assigneeId = assigneeRaw ? Number(assigneeRaw) : null;

		if (!id || !title) {
			return fail(400, { error: 'Title is required.' });
		}

		await db
			.prepare('UPDATE todos SET title = ?, notes = ?, due_date = ?, assignee_id = ? WHERE id = ?')
			.run(title, notes, dueDate, assigneeId, id);

		return { success: true };
	},

	toggle: async ({ request, locals }) => {
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

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) {
			await db.prepare('DELETE FROM todos WHERE id = ?').run(id);
		}
		return { success: true };
	}
};

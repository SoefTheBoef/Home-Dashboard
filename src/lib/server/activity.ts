import { db } from './db';

export interface ActivityRow {
	id: number;
	summary: string;
	actor_id: number | null;
	actor_name: string | null;
	actor_color: string | null;
	created_at: string;
}

export async function logActivity(actorId: number | null, summary: string): Promise<void> {
	await db.prepare('INSERT INTO activity_log (actor_id, summary) VALUES (?, ?)').run(actorId, summary);
}

export async function getRecentActivity(limit = 15): Promise<ActivityRow[]> {
	return (await db
		.prepare(
			`SELECT a.id, a.summary, a.actor_id, a.created_at,
			        u.display_name as actor_name, u.color as actor_color
			 FROM activity_log a
			 LEFT JOIN users u ON u.id = a.actor_id
			 ORDER BY a.created_at DESC, a.id DESC
			 LIMIT ?`
		)
		.all(limit)) as unknown as ActivityRow[];
}

/** Unread count for a user: activity logged by someone else since they last checked the bell. */
export async function getUnreadCount(userId: number): Promise<number> {
	const user = (await db.prepare('SELECT last_seen_activity_at FROM users WHERE id = ?').get(userId)) as
		| { last_seen_activity_at: string | null }
		| undefined;

	const since = user?.last_seen_activity_at ?? '1970-01-01 00:00:00';

	const row = (await db
		.prepare(
			`SELECT COUNT(*) as count FROM activity_log
			 WHERE created_at > ? AND (actor_id IS NULL OR actor_id != ?)`
		)
		.get(since, userId)) as { count: number };

	return Number(row.count);
}

export async function markActivitySeen(userId: number): Promise<void> {
	await db
		.prepare(
			"UPDATE users SET last_seen_activity_at = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?"
		)
		.run(userId);
}

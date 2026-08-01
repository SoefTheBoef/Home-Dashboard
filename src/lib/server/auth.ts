import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { db } from './db';

export const SESSION_COOKIE = 'session';
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
	id: number;
	username: string;
	display_name: string;
	color: string;
}

export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
	return bcrypt.compareSync(password, hash);
}

export async function findUserByUsername(username: string) {
	const stmt = db.prepare(
		'SELECT id, username, password_hash, display_name, color FROM users WHERE username = ?'
	);
	return (await stmt.get(username)) as
		| { id: number; username: string; password_hash: string; display_name: string; color: string }
		| undefined;
}

export async function createSession(userId: number): Promise<{ id: string; expiresAt: number }> {
	const id = randomBytes(32).toString('hex');
	const expiresAt = Date.now() + SESSION_DURATION_MS;
	await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
		id,
		userId,
		expiresAt
	);
	return { id, expiresAt };
}

export async function validateSession(sessionId: string): Promise<SessionUser | null> {
	const row = (await db
		.prepare(
			`SELECT s.expires_at as expiresAt, u.id, u.username, u.display_name, u.color
			 FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.id = ?`
		)
		.get(sessionId)) as
		| { expiresAt: number; id: number; username: string; display_name: string; color: string }
		| undefined;

	if (!row) return null;

	if (Number(row.expiresAt) < Date.now()) {
		await db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
		return null;
	}

	// Sliding expiration: touching the session (e.g. a living-room display woken up daily) keeps
	// it alive indefinitely without ever requiring a fresh login.
	await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(
		Date.now() + SESSION_DURATION_MS,
		sessionId
	);

	return {
		id: row.id,
		username: row.username,
		display_name: row.display_name,
		color: row.color
	};
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

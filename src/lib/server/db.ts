import pg from 'pg';
import bcrypt from 'bcryptjs';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) {
	throw new Error(
		'DATABASE_URL is not set. Point it at a Postgres database — see .env.example ' +
			'(local dev) or your Render Blueprint (production, injected automatically).'
	);
}

const isLocalHost = /localhost|127\.0\.0\.1/.test(env.DATABASE_URL);

// pg returns BIGINT/COUNT(*) as strings by default (to avoid silently truncating values beyond
// Number.MAX_SAFE_INTEGER). None of this app's bigints — millisecond timestamps, row counts —
// come anywhere near that range, so parse them as plain numbers everywhere instead of having to
// remember to do it at every call site.
pg.types.setTypeParser(20, (val: string) => Number(val));

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL,
	// Hosted Postgres (e.g. Neon) requires SSL; a local Docker Postgres doesn't have it configured.
	ssl: isLocalHost ? false : { rejectUnauthorized: false }
});

/** Converts SQLite-style '?' positional placeholders to Postgres's '$1, $2, ...'. */
function toPgPlaceholders(sql: string): string {
	let i = 0;
	return sql.replace(/\?/g, () => `$${++i}`);
}

export interface PreparedStatement {
	get(...params: unknown[]): Promise<Record<string, unknown> | undefined>;
	all(...params: unknown[]): Promise<Record<string, unknown>[]>;
	run(...params: unknown[]): Promise<{ changes: number }>;
}

function prepare(sql: string): PreparedStatement {
	const pgSql = toPgPlaceholders(sql);
	return {
		async get(...params: unknown[]) {
			await getReady();
			const result = await pool.query(pgSql, params);
			return result.rows[0];
		},
		async all(...params: unknown[]) {
			await getReady();
			const result = await pool.query(pgSql, params);
			return result.rows;
		},
		async run(...params: unknown[]) {
			await getReady();
			const result = await pool.query(pgSql, params);
			return { changes: result.rowCount ?? 0 };
		}
	};
}

export const db = {
	prepare,
	async exec(sql: string): Promise<void> {
		await getReady();
		await pool.query(sql);
	}
};

// Lazy: only connects and runs schema setup on the first actual query, not at module import
// time. Building the app (or SSR analysis during `vite build`) imports this module without
// ever calling into it, and that must not require a live database connection.
let readyPromise: Promise<void> | undefined;
function getReady(): Promise<void> {
	if (!readyPromise) readyPromise = setup();
	return readyPromise;
}

async function setup(): Promise<void> {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS users (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  username TEXT UNIQUE NOT NULL,
		  password_hash TEXT NOT NULL,
		  display_name TEXT NOT NULL,
		  color TEXT NOT NULL DEFAULT '#6366f1',
		  last_seen_activity_at TEXT,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS sessions (
		  id TEXT PRIMARY KEY,
		  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		  expires_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS transactions (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  type TEXT NOT NULL CHECK (type IN ('income','expense')),
		  amount REAL NOT NULL,
		  category TEXT NOT NULL,
		  date TEXT NOT NULL,
		  description TEXT,
		  logged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS todos (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  title TEXT NOT NULL,
		  notes TEXT,
		  due_date TEXT,
		  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		  completed INTEGER NOT NULL DEFAULT 0,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS bill_templates (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  name TEXT NOT NULL,
		  amount REAL NOT NULL,
		  category TEXT,
		  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
		  active INTEGER NOT NULL DEFAULT 1,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS bills (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  name TEXT NOT NULL,
		  amount REAL NOT NULL,
		  due_date TEXT NOT NULL,
		  category TEXT,
		  paid INTEGER NOT NULL DEFAULT 0,
		  paid_date TEXT,
		  template_id INTEGER REFERENCES bill_templates(id) ON DELETE SET NULL,
		  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS photos (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  filename TEXT NOT NULL,
		  original_name TEXT,
		  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS trips (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  name TEXT NOT NULL,
		  start_date TEXT NOT NULL,
		  end_date TEXT,
		  notes TEXT,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS shopping_items (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  name TEXT NOT NULL,
		  quantity TEXT,
		  note TEXT,
		  purchased INTEGER NOT NULL DEFAULT 0,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS event_series (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  title TEXT NOT NULL,
		  weekdays TEXT NOT NULL,
		  start_time TEXT,
		  end_time TEXT,
		  location TEXT,
		  notes TEXT,
		  applies_to TEXT NOT NULL DEFAULT 'both',
		  event_type TEXT NOT NULL DEFAULT 'work',
		  series_start_date TEXT NOT NULL,
		  series_end_date TEXT,
		  active INTEGER NOT NULL DEFAULT 1,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS events (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  title TEXT NOT NULL,
		  start_at TEXT NOT NULL,
		  end_at TEXT,
		  all_day INTEGER NOT NULL DEFAULT 0,
		  location TEXT,
		  notes TEXT,
		  applies_to TEXT NOT NULL DEFAULT 'both',
		  event_type TEXT NOT NULL DEFAULT 'event',
		  series_id INTEGER REFERENCES event_series(id) ON DELETE SET NULL,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS meal_plan_entries (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  date TEXT NOT NULL UNIQUE,
		  title TEXT NOT NULL,
		  ingredients TEXT,
		  notes TEXT,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS waste_schedules (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  label TEXT NOT NULL,
		  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
		  cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly','biweekly')),
		  anchor_date TEXT NOT NULL,
		  color TEXT NOT NULL DEFAULT '#6b7280',
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS subscriptions (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  name TEXT NOT NULL,
		  amount REAL NOT NULL,
		  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('weekly','monthly','quarterly','yearly')),
		  next_charge_date TEXT NOT NULL,
		  category TEXT,
		  active INTEGER NOT NULL DEFAULT 1,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS notes (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  body TEXT NOT NULL,
		  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
		  updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS emergency_info (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('doctor','insurance','wifi','other')),
		  label TEXT NOT NULL,
		  value TEXT NOT NULL,
		  notes TEXT,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS activity_log (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		  summary TEXT NOT NULL,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS spotify_connection (
		  id INTEGER PRIMARY KEY CHECK (id = 1),
		  access_token TEXT,
		  refresh_token TEXT,
		  expires_at BIGINT,
		  connected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		  playlist_id TEXT,
		  playlist_name TEXT,
		  playlist_image TEXT,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);
	`);

	await seedInitialUsers();
}

/**
 * Creates the two household accounts from env vars on first boot only (no-op if the users table
 * already has anyone in it) — so a fresh deploy is loggable-into with zero manual setup.
 */
async function seedInitialUsers(): Promise<void> {
	const { rows } = await pool.query('SELECT COUNT(*) AS count FROM users');
	if (Number(rows[0].count) > 0) return;

	const candidates = [
		{
			username: env.SEED_USER1_USERNAME,
			password: env.SEED_USER1_PASSWORD,
			displayName: env.SEED_USER1_DISPLAY_NAME || env.SEED_USER1_USERNAME,
			color: env.SEED_USER1_COLOR || '#6366f1'
		},
		{
			username: env.SEED_USER2_USERNAME,
			password: env.SEED_USER2_PASSWORD,
			displayName: env.SEED_USER2_DISPLAY_NAME || env.SEED_USER2_USERNAME,
			color: env.SEED_USER2_COLOR || '#ec4899'
		}
	];

	for (const u of candidates) {
		if (!u.username || !u.password) continue;
		const passwordHash = bcrypt.hashSync(u.password, 12);
		await pool.query(
			'INSERT INTO users (username, password_hash, display_name, color) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
			[u.username, passwordHash, u.displayName, u.color]
		);
	}
}

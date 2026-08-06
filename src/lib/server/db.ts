import pg from 'pg';
import bcrypt from 'bcryptjs';
import { env } from '$env/dynamic/private';
import { seedWasteCollectionsIfEmpty } from './waste';
import { seedFoodInventoryIfEmpty, seedShoppingListIfEmpty } from './food';
import { withTimeout } from './timeout';

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

const MAX_POOL_SIZE = 10;
const CONNECTION_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 10_000;
// Generous: setup() makes several sequential round trips (schema DDL, user seed, three batched
// data seeds), so this needs headroom beyond a single query's timeout — but it must still be
// bounded, since every request shares this one promise until it settles.
const SETUP_TIMEOUT_MS = 45_000;

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL,
	// Hosted Postgres (e.g. Neon) requires SSL; a local Docker Postgres doesn't have it configured.
	ssl: isLocalHost ? false : { rejectUnauthorized: false },
	max: MAX_POOL_SIZE,
	// Covers BOTH steps of acquiring a client: waiting for a free slot in an already-full pool, and
	// the physical TCP/TLS connect once a slot is available — so "every connection is stuck and
	// nothing is coming free" fails with a clear error instead of queueing forever.
	connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
	// Server-side backstop (SET statement_timeout at session start) — belt-and-suspenders alongside
	// the driver-side query_timeout below and our own withTimeout() wrapper around every query.
	statement_timeout: QUERY_TIMEOUT_MS
});

// node-postgres never issues named server-side PREPARE statements for pool.query(text, values) —
// every call sends a fresh unnamed Parse/Bind/Execute, which is exactly what PgBouncer's
// transaction-pooling mode requires. So there's no "disable prepared statements" flag needed (or
// available) here; that's a real gotcha for ORMs that cache named statements (Prisma, postgres.js),
// not for this driver.
//
// What Neon's serverless Postgres *can* do is close an idle connection out from under the pool at
// any time. Without this handler that surfaces as an unhandled 'error' event, which crashes the
// whole Node process — turning a routine idle disconnect into a full outage with nothing logged.
pool.on('error', (err) => {
	console.error('Unexpected error on idle Postgres client:', err);
});

function poolState(): string {
	return `total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`;
}

/**
 * Every query goes through here — never through pool.query() directly — so we control the whole
 * lifecycle of the client we check out: acquire (bounded by connectionTimeoutMillis, which covers
 * waiting for a free pool slot as well as the physical connect), run the query under our own
 * timeout, and *always* hand the client back. On success it's released healthy for reuse; on any
 * error or timeout it's released with an error, which tells pg to destroy that physical connection
 * instead of returning it to the pool — we can't be sure it's still in a clean protocol state if
 * our own timeout fired while a query was still in flight on it, and reusing a client that's
 * secretly still busy is exactly how a pool silently exhausts itself with requests that then hang
 * forever waiting for a slot that's never coming free.
 */
async function execute(sql: string, params: unknown[]): Promise<pg.QueryResult> {
	const label = sql.trim().slice(0, 80);

	// Logged independent of whatever withTimeout()/Promise.race ends up reporting, so we can tell
	// whether pool.connect() or the raw query itself actually settles quickly in the background
	// even when the caller sees a timeout — if so, the bug is in the race wiring, not the network.
	const connectStart = Date.now();
	console.log(`[db] pool.connect() starting (pool ${poolState()}) for: ${label}`);
	const clientPromise = pool.connect();
	clientPromise.then(
		() => console.log(`[db] pool.connect() RESOLVED after ${Date.now() - connectStart}ms (pool ${poolState()})`),
		(err) => console.log(`[db] pool.connect() REJECTED after ${Date.now() - connectStart}ms: ${err.message}`)
	);

	// Defense in depth: pg's own connectionTimeoutMillis is supposed to bound this already, but we
	// don't fully trust that given what we're debugging — so enforce our own hard cap too. If
	// pool.connect() *does* eventually resolve after we've given up on it, immediately release the
	// orphaned client with an error instead of leaving it permanently checked out with nothing ever
	// calling .release() on it — that's a silent, permanent pool-capacity leak of exactly the kind
	// we're chasing.
	let client: pg.PoolClient;
	try {
		client = await withTimeout(clientPromise, CONNECTION_TIMEOUT_MS, 'Pool connect');
	} catch (err) {
		clientPromise
			.then((orphan) => orphan.release(new Error('Discarding a connect() that resolved after our own timeout')))
			.catch(() => {
				/* the connect itself failed too — nothing to release */
			});
		throw err;
	}

	try {
		const queryStart = Date.now();
		const queryPromise = client.query(sql, params);
		queryPromise.then(
			(res) =>
				console.log(
					`[db] RAW query RESOLVED after ${Date.now() - queryStart}ms (${res.rowCount ?? 0} rows) for: ${label}`
				),
			(err) => console.log(`[db] RAW query REJECTED after ${Date.now() - queryStart}ms: ${err.message} for: ${label}`)
		);

		const result = await withTimeout(queryPromise, QUERY_TIMEOUT_MS, 'Query');
		client.release();
		return result;
	} catch (err) {
		client.release(err instanceof Error ? err : new Error(String(err)));
		throw err;
	}
}

/** Converts SQLite-style '?' positional placeholders to Postgres's '$1, $2, ...'. */
function toPgPlaceholders(sql: string): string {
	let i = 0;
	return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Builds the `VALUES (?, ?), (?, ?), ...` fragment and flattened params for a multi-row INSERT —
 * used by one-time seed imports so they cost one round trip instead of one per row (meaningful
 * against a hosted/pooled Postgres like Neon, where every round trip pays real network latency).
 */
export function buildValuesList(rows: unknown[][]): { placeholders: string; params: unknown[] } {
	const placeholders = rows.map((row) => `(${row.map(() => '?').join(', ')})`).join(', ');
	return { placeholders, params: rows.flat() };
}

export interface PreparedStatement {
	get(...params: unknown[]): Promise<Record<string, unknown> | undefined>;
	all(...params: unknown[]): Promise<Record<string, unknown>[]>;
	run(...params: unknown[]): Promise<{ changes: number }>;
}

/** Builds get/all/run around execute() with no readiness check — see prepare() vs. prepareRaw(). */
function prepareRaw(sql: string): PreparedStatement {
	const pgSql = toPgPlaceholders(sql);
	return {
		async get(...params: unknown[]) {
			const result = await execute(pgSql, params);
			return result.rows[0];
		},
		async all(...params: unknown[]) {
			const result = await execute(pgSql, params);
			return result.rows;
		},
		async run(...params: unknown[]) {
			const result = await execute(pgSql, params);
			return { changes: result.rowCount ?? 0 };
		}
	};
}

function prepare(sql: string): PreparedStatement {
	const raw = prepareRaw(sql);
	return {
		async get(...params: unknown[]) {
			await getReady();
			return raw.get(...params);
		},
		async all(...params: unknown[]) {
			await getReady();
			return raw.all(...params);
		},
		async run(...params: unknown[]) {
			await getReady();
			return raw.run(...params);
		}
	};
}

export const db = {
	prepare,
	async exec(sql: string): Promise<void> {
		await getReady();
		await execute(sql, []);
	}
};

/**
 * Same shape as `db`, but skips the getReady() check — for use ONLY by code that runs from
 * *within* setup()'s own call graph (the one-time seed functions in waste.ts/food.ts). Those run
 * as part of setup() itself, so if they called the regular `db` (which awaits getReady() first),
 * they'd deadlock: getReady() returns the very in-progress setup() promise they're being called
 * from, which can only resolve once they return — a promise waiting on itself, forever. Regular
 * app code (routes, everything outside this file) must always use `db`, never this.
 */
export const dbDuringSetup = { prepare: prepareRaw };

// Lazy: only connects and runs schema setup on the first actual query, not at module import
// time. Building the app (or SSR analysis during `vite build`) imports this module without
// ever calling into it, and that must not require a live database connection.
let readyPromise: Promise<void> | undefined;
function getReady(): Promise<void> {
	if (!readyPromise) {
		// Every query awaits this same shared promise, so if setup() itself never settles — not just
		// "rejects", but genuinely never resolves *or* rejects, which is possible if something inside
		// it hangs in a way that doesn't hit our own per-query timeouts — every request in the process
		// would wait on it forever with no way to recover. Bounding it here guarantees it always
		// settles one way or another.
		readyPromise = withTimeout(setup(), SETUP_TIMEOUT_MS, 'Database setup').catch((err) => {
			// Forget the promise so the *next* call gets a fresh attempt instead of every future
			// request immediately re-rejecting with the same stale error for the rest of the
			// process's life (or, before this fix, all sharing one promise that never even rejected).
			readyPromise = undefined;
			throw err;
		});
	}
	return readyPromise;
}

/**
 * Kicks off schema setup/seeding as soon as the server process actually starts, instead of
 * leaving it to block whichever user request happens to run the first query (previously that was
 * almost always the first login attempt after a deploy). Safe to call at module scope — unlike
 * `getReady`, this is fire-and-forget so a slow or failed warmup doesn't crash the process; the
 * next real query still awaits `getReady()` and will surface any error properly.
 */
export function warmup(): void {
	getReady().catch((err) => console.error('Database warmup failed:', err));
}

async function setup(): Promise<void> {
	await execute(
		`
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

		DROP TABLE IF EXISTS waste_schedules;

		CREATE TABLE IF NOT EXISTS waste_collections (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  date TEXT NOT NULL UNIQUE,
		  types TEXT NOT NULL,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
		);

		CREATE TABLE IF NOT EXISTS food_inventory (
		  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		  category TEXT NOT NULL,
		  item TEXT NOT NULL,
		  quantity REAL NOT NULL DEFAULT 0,
		  low_stock INTEGER NOT NULL DEFAULT 0,
		  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
		  updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
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
	`,
		[]
	);

	await seedInitialUsers();
	await seedWasteCollectionsIfEmpty();
	await seedFoodInventoryIfEmpty();
	await seedShoppingListIfEmpty();
}

/**
 * Creates the two household accounts from env vars on first boot only (no-op if the users table
 * already has anyone in it) — so a fresh deploy is loggable-into with zero manual setup.
 */
async function seedInitialUsers(): Promise<void> {
	const { rows } = await execute('SELECT COUNT(*) AS count FROM users', []);
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
		await execute(
			'INSERT INTO users (username, password_hash, display_name, color) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
			[u.username, passwordHash, u.displayName, u.color]
		);
	}
}

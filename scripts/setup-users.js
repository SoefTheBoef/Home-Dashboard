import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set. Point it at your Postgres database (see .env.example).');
}

const isLocalHost = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: isLocalHost ? false : { rejectUnauthorized: false }
});

const rl = createInterface({ input: process.stdin, output: process.stdout });

const DEFAULT_COLORS = ['#6366f1', '#ec4899'];

async function promptUser(index) {
	console.log(`\n--- Account ${index + 1} ---`);
	const username = (await rl.question('Username: ')).trim();
	const displayName = (await rl.question('Display name: ')).trim() || username;
	const color =
		(await rl.question(`Color (hex, default ${DEFAULT_COLORS[index]}): `)).trim() ||
		DEFAULT_COLORS[index];
	const password = await rl.question('Password: ');

	if (!username || !password) {
		throw new Error('Username and password are required.');
	}

	return { username, displayName, color, password };
}

async function upsertUser({ username, displayName, color, password }) {
	const passwordHash = bcrypt.hashSync(password, 12);
	const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);

	if (rows[0]) {
		await pool.query(
			'UPDATE users SET password_hash = $1, display_name = $2, color = $3 WHERE username = $4',
			[passwordHash, displayName, color, username]
		);
		console.log(`Updated existing user "${username}".`);
	} else {
		await pool.query(
			'INSERT INTO users (username, password_hash, display_name, color) VALUES ($1, $2, $3, $4)',
			[username, passwordHash, displayName, color]
		);
		console.log(`Created user "${username}".`);
	}
}

try {
	console.log('Set up the two Home Dashboard accounts. Existing usernames will be updated.');
	const userOne = await promptUser(0);
	const userTwo = await promptUser(1);

	await upsertUser(userOne);
	await upsertUser(userTwo);

	console.log('\nDone! You can now sign in with both accounts.');
} finally {
	rl.close();
	await pool.end();
}

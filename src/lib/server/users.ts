import { db } from './db';

export interface AppUser {
	id: number;
	username: string;
	display_name: string;
	color: string;
}

export async function getAllUsers(): Promise<AppUser[]> {
	return (await db
		.prepare('SELECT id, username, display_name, color FROM users ORDER BY id ASC')
		.all()) as unknown as AppUser[];
}

import { db } from './db';

export interface NoteRow {
	id: number;
	body: string;
	author_id: number | null;
	author_name: string | null;
	author_color: string | null;
	created_at: string;
	updated_at: string;
}

export async function listNotes(limit?: number): Promise<NoteRow[]> {
	const stmt = db.prepare(
		`SELECT n.id, n.body, n.author_id, n.created_at, n.updated_at,
		        u.display_name as author_name, u.color as author_color
		 FROM notes n
		 LEFT JOIN users u ON u.id = n.author_id
		 ORDER BY n.created_at DESC
		 ${limit ? 'LIMIT ?' : ''}`
	);
	return (limit ? await stmt.all(limit) : await stmt.all()) as unknown as NoteRow[];
}

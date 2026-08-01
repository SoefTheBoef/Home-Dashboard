import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { PHOTOS_DIR, MIME_BY_EXT } from '$lib/server/photos';

export const GET: RequestHandler = async ({ params }) => {
	const row = (await db.prepare('SELECT filename FROM photos WHERE filename = ?').get(params.filename)) as
		| { filename: string }
		| undefined;
	if (!row) error(404, 'Photo not found');

	const ext = path.extname(row.filename).toLowerCase();
	const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream';

	try {
		const data = await readFile(path.join(PHOTOS_DIR, row.filename));
		return new Response(data, {
			headers: {
				'content-type': contentType,
				'cache-control': 'private, max-age=31536000, immutable'
			}
		});
	} catch {
		error(404, 'Photo not found');
	}
};

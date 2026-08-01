import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { db } from './db';

// In production this points at a Render Persistent Disk mount (see render.yaml) so uploads
// survive deploys; locally it defaults to a folder inside the project.
export const PHOTOS_DIR = path.resolve(env.PHOTOS_DIR || './data/uploads/photos');

/**
 * Creates PHOTOS_DIR on first use rather than at module load — module load happens during
 * build-time SSR analysis too, before a mounted disk (e.g. Render's) is necessarily available,
 * and a failed mkdir there would crash the build itself rather than just the upload.
 */
async function ensurePhotosDir(): Promise<void> {
	try {
		await mkdir(PHOTOS_DIR, { recursive: true });
	} catch (err) {
		console.warn(`Could not create photos directory at ${PHOTOS_DIR}:`, err);
	}
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

const EXT_BY_MIME: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'image/avif': '.avif'
};

export const MIME_BY_EXT: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif'
};

export interface PhotoRow {
	id: number;
	filename: string;
	original_name: string | null;
	created_at: string;
}

export async function listPhotos(): Promise<PhotoRow[]> {
	return (await db
		.prepare('SELECT id, filename, original_name, created_at FROM photos ORDER BY created_at DESC')
		.all()) as unknown as PhotoRow[];
}

export type SavePhotoResult = { ok: true } | { ok: false; error: string };

export async function savePhoto(file: File, uploadedBy: number): Promise<SavePhotoResult> {
	if (file.size === 0) return { ok: false, error: 'Choose an image file.' };
	if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: 'Image must be 8MB or smaller.' };

	const ext = EXT_BY_MIME[file.type];
	if (!ext) return { ok: false, error: 'Only JPEG, PNG, GIF, WebP or AVIF images are supported.' };

	const filename = `${randomUUID()}${ext}`;
	const buffer = Buffer.from(await file.arrayBuffer());
	await ensurePhotosDir();
	await writeFile(path.join(PHOTOS_DIR, filename), buffer);

	await db
		.prepare('INSERT INTO photos (filename, original_name, uploaded_by) VALUES (?, ?, ?)')
		.run(filename, file.name || null, uploadedBy);

	return { ok: true };
}

export async function deletePhoto(id: number): Promise<void> {
	const row = (await db.prepare('SELECT filename FROM photos WHERE id = ?').get(id)) as
		| { filename: string }
		| undefined;
	if (!row) return;

	await db.prepare('DELETE FROM photos WHERE id = ?').run(id);

	try {
		await unlink(path.join(PHOTOS_DIR, row.filename));
	} catch {
		// file already gone — nothing left to clean up
	}
}

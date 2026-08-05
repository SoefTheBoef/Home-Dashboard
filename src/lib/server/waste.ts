import { buildValuesList, db } from './db';
import { WASTE_COLLECTIONS_2026 } from './seed-data/waste-collections-2026';

export interface WasteTypeInfo {
	code: string;
	label: string;
	color: string;
}

/** IGEAN legend — see the calendar PDF's LEGENDE strip. */
export const WASTE_TYPES: WasteTypeInfo[] = [
	{ code: 'hv', label: 'Huisvuil (general waste)', color: '#6b7280' },
	{ code: 'gft', label: 'GFT (green/organic waste)', color: '#65a30d' },
	{ code: 'pmd', label: 'PMD (plastic/metal/cartons)', color: '#2563eb' },
	{ code: 'pk', label: 'Papier & karton (paper/cardboard)', color: '#ea580c' },
	{ code: 'sh', label: 'Snoeihout (pruning wood)', color: '#92400e' },
	{ code: 'gv', label: 'Grofvuil (bulk waste)', color: '#374151' },
	{ code: 'tex', label: 'Textiel (textile)', color: '#db2777' },
	{ code: 'kerstboom', label: 'Kerstboom (Christmas tree)', color: '#16a34a' }
];

const TYPE_INFO_BY_CODE = new Map(WASTE_TYPES.map((t) => [t.code, t]));

export function wasteTypeInfo(code: string): WasteTypeInfo {
	return TYPE_INFO_BY_CODE.get(code) ?? { code, label: code, color: '#6b7280' };
}

export interface WasteCollectionRow {
	id: number;
	date: string;
	types: string[];
}

interface WasteCollectionDbRow {
	id: number;
	date: string;
	types: string;
}

function fromDbRow(row: WasteCollectionDbRow): WasteCollectionRow {
	return { id: row.id, date: row.date, types: row.types.split(',').filter(Boolean) };
}

export async function listWasteCollections(): Promise<WasteCollectionRow[]> {
	const rows = (await db
		.prepare('SELECT id, date, types FROM waste_collections ORDER BY date ASC')
		.all()) as unknown as WasteCollectionDbRow[];
	return rows.map(fromDbRow);
}

export async function getCollectionOn(dateStr: string): Promise<WasteCollectionRow | null> {
	const row = (await db.prepare('SELECT id, date, types FROM waste_collections WHERE date = ?').get(dateStr)) as
		| WasteCollectionDbRow
		| undefined;
	return row ? fromDbRow(row) : null;
}

export async function getNextCollection(fromDateStr: string): Promise<WasteCollectionRow | null> {
	const row = (await db
		.prepare('SELECT id, date, types FROM waste_collections WHERE date >= ? ORDER BY date ASC LIMIT 1')
		.get(fromDateStr)) as WasteCollectionDbRow | undefined;
	return row ? fromDbRow(row) : null;
}

export async function upsertWasteCollection(date: string, types: string[]): Promise<void> {
	await db
		.prepare(
			`INSERT INTO waste_collections (date, types) VALUES (?, ?)
			 ON CONFLICT (date) DO UPDATE SET types = excluded.types`
		)
		.run(date, types.join(','));
}

export async function deleteWasteCollection(id: number): Promise<void> {
	await db.prepare('DELETE FROM waste_collections WHERE id = ?').run(id);
}

/** Replaces every collection date that falls within `year` — used after a fresh PDF import. */
export async function replaceYear(year: number, entries: { date: string; types: string[] }[]): Promise<void> {
	await db.prepare('DELETE FROM waste_collections WHERE date LIKE ?').run(`${year}-%`);
	for (const entry of entries) {
		await upsertWasteCollection(entry.date, entry.types);
	}
}

export async function seedWasteCollectionsIfEmpty(): Promise<void> {
	const { count } = (await db.prepare('SELECT COUNT(*) as count FROM waste_collections').get()) as {
		count: number;
	};
	if (count > 0 || WASTE_COLLECTIONS_2026.length === 0) return;

	const { placeholders, params } = buildValuesList(
		WASTE_COLLECTIONS_2026.map((e) => [e.date, e.types.join(',')])
	);
	await db.prepare(`INSERT INTO waste_collections (date, types) VALUES ${placeholders}`).run(...params);
}

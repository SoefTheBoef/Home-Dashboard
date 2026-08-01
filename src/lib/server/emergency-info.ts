import { db } from './db';

export interface EmergencyInfoRow {
	id: number;
	category: 'doctor' | 'insurance' | 'wifi' | 'other';
	label: string;
	value: string;
	notes: string | null;
}

export async function listEmergencyInfo(): Promise<EmergencyInfoRow[]> {
	return (await db
		.prepare('SELECT id, category, label, value, notes FROM emergency_info ORDER BY category ASC, label ASC')
		.all()) as unknown as EmergencyInfoRow[];
}

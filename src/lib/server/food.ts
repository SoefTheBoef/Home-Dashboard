import { db } from './db';
import { FOOD_INVENTORY_SEED, SHOPPING_LIST_SEED } from './seed-data/food-inventory';

export interface FoodInventoryRow {
	id: number;
	category: string;
	item: string;
	quantity: number;
	low_stock: number;
}

export async function listFoodInventory(): Promise<FoodInventoryRow[]> {
	return (await db
		.prepare('SELECT id, category, item, quantity, low_stock FROM food_inventory ORDER BY category ASC, item ASC')
		.all()) as unknown as FoodInventoryRow[];
}

export async function seedFoodInventoryIfEmpty(): Promise<void> {
	const { count } = (await db.prepare('SELECT COUNT(*) as count FROM food_inventory').get()) as {
		count: number;
	};
	if (count > 0) return;

	const insert = db.prepare(
		'INSERT INTO food_inventory (category, item, quantity, low_stock) VALUES (?, ?, ?, ?)'
	);
	for (const row of FOOD_INVENTORY_SEED) {
		await insert.run(row.category, row.item, row.quantity, row.lowStock ? 1 : 0);
	}
}

export async function seedShoppingListIfEmpty(): Promise<void> {
	const { count } = (await db.prepare('SELECT COUNT(*) as count FROM shopping_items').get()) as {
		count: number;
	};
	if (count > 0) return;

	const insert = db.prepare('INSERT INTO shopping_items (name, note, purchased) VALUES (?, ?, ?)');
	for (const row of SHOPPING_LIST_SEED) {
		await insert.run(row.name, row.note, row.purchased ? 1 : 0);
	}
}

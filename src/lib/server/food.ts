import { buildValuesList, db } from './db';
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
	if (count > 0 || FOOD_INVENTORY_SEED.length === 0) return;

	const { placeholders, params } = buildValuesList(
		FOOD_INVENTORY_SEED.map((row) => [row.category, row.item, row.quantity, row.lowStock ? 1 : 0])
	);
	await db
		.prepare(`INSERT INTO food_inventory (category, item, quantity, low_stock) VALUES ${placeholders}`)
		.run(...params);
}

export async function seedShoppingListIfEmpty(): Promise<void> {
	const { count } = (await db.prepare('SELECT COUNT(*) as count FROM shopping_items').get()) as {
		count: number;
	};
	if (count > 0 || SHOPPING_LIST_SEED.length === 0) return;

	const { placeholders, params } = buildValuesList(
		SHOPPING_LIST_SEED.map((row) => [row.name, row.note, row.purchased ? 1 : 0])
	);
	await db.prepare(`INSERT INTO shopping_items (name, note, purchased) VALUES ${placeholders}`).run(...params);
}

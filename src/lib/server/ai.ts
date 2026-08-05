import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { listFoodInventory } from './food';
import { WASTE_TYPES } from './waste';
import { addDays, todayYmd } from '$lib/calendar-date';

const MODEL = 'claude-sonnet-5';

export function isAiConfigured(): boolean {
	return Boolean(env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
	return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

export interface HouseholdContextSection {
	label: string;
	content: string;
}

/**
 * Read-only snapshot of household data handed to the assistant as system-prompt context — the
 * single source of "what the assistant can see" for both the chat UI's transparency panel and
 * the actual prompt sent to Claude, so the two can never drift apart.
 */
export async function gatherHouseholdContext(): Promise<{
	sections: HouseholdContextSection[];
	asPromptText: string;
}> {
	const today = todayYmd();
	const soon = addDays(today, 14);

	const inventory = await listFoodInventory();
	const inventoryText =
		inventory
			.map((i) => `- ${i.item} (${i.category}): qty ${i.quantity}${i.low_stock ? ' — LOW STOCK' : ''}`)
			.join('\n') || '(empty)';

	const shopping = (await db
		.prepare('SELECT name, quantity, note FROM shopping_items WHERE purchased = 0 ORDER BY id DESC')
		.all()) as unknown as { name: string; quantity: string | null; note: string | null }[];
	const shoppingText =
		shopping.map((s) => `- ${s.name}${s.quantity ? ` (${s.quantity})` : ''}${s.note ? ` — ${s.note}` : ''}`).join('\n') ||
		'(empty)';

	const events = (await db
		.prepare(
			`SELECT title, start_at, all_day, location FROM events
			 WHERE substr(start_at, 1, 10) BETWEEN ? AND ? ORDER BY start_at ASC`
		)
		.all(today, soon)) as unknown as { title: string; start_at: string; all_day: number; location: string | null }[];
	const eventsText =
		events
			.map((e) => `- ${e.start_at}${e.all_day ? ' (all day)' : ''}: ${e.title}${e.location ? ` @ ${e.location}` : ''}`)
			.join('\n') || '(nothing scheduled in the next 14 days)';

	const bills = (await db
		.prepare('SELECT name, amount, due_date FROM bills WHERE paid = 0 ORDER BY due_date ASC')
		.all()) as unknown as { name: string; amount: number; due_date: string }[];
	const billsText = bills.map((b) => `- ${b.name}: €${b.amount.toFixed(2)}, due ${b.due_date}`).join('\n') || '(none unpaid)';

	const todos = (await db
		.prepare('SELECT title, due_date FROM todos WHERE completed = 0 ORDER BY (due_date IS NULL), due_date ASC')
		.all()) as unknown as { title: string; due_date: string | null }[];
	const todosText = todos.map((t) => `- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n') || '(none open)';

	const sections: HouseholdContextSection[] = [
		{ label: 'Food inventory', content: inventoryText },
		{ label: 'Shopping list (not yet bought)', content: shoppingText },
		{ label: `Calendar (${today} through ${soon})`, content: eventsText },
		{ label: 'Unpaid bills', content: billsText },
		{ label: 'Open to-dos', content: todosText }
	];

	const asPromptText = sections.map((s) => `## ${s.label}\n${s.content}`).join('\n\n');
	return { sections, asPromptText };
}

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

/** Shared entry point for both the chat UI and the "what can we cook" dish-suggestion feature. */
export async function askAssistant(messages: ChatMessage[]): Promise<string> {
	if (!isAiConfigured()) throw new Error('AI assistant is not configured (ANTHROPIC_API_KEY missing).');

	const { asPromptText } = await gatherHouseholdContext();
	const today = todayYmd();

	const response = await client().messages.create({
		model: MODEL,
		max_tokens: 1024,
		system:
			`You are a helpful household assistant for a two-person home dashboard app. ` +
			`Today's date is ${today}. Answer conversationally and concisely, grounded in the ` +
			`household data below when it's relevant — don't make up data that isn't there, and say ` +
			`so if something isn't covered by it.\n\n${asPromptText}`,
		messages: messages.map((m) => ({ role: m.role, content: m.content }))
	});

	const textBlock = response.content.find((b) => b.type === 'text');
	return textBlock?.type === 'text' ? textBlock.text : '';
}

/** "What can we cook" — same shared service, framed as a one-shot dish-suggestion request. */
export async function suggestDishes(): Promise<string> {
	return askAssistant([
		{
			role: 'user',
			content:
				'Based on our current food inventory, suggest 3-5 realistic dishes we could cook. ' +
				'Prioritize using up items marked LOW STOCK first (they need using before we run out), ' +
				'then fresh/perishable items likely to spoil soon. For each dish, name the inventory ' +
				'items it uses and list any extra ingredients we would need to buy that are not in stock. ' +
				'Keep it concise — a short list, not an essay.'
		}
	]);
}

export interface ParsedWasteCalendar {
	year: number;
	entries: { date: string; types: string[] }[];
}

/** Structured extraction used by the recycling calendar's PDF re-import feature. */
export async function parseWasteCalendarText(rawText: string): Promise<ParsedWasteCalendar> {
	if (!isAiConfigured()) throw new Error('AI assistant is not configured (ANTHROPIC_API_KEY missing).');

	const validCodes = WASTE_TYPES.map((t) => t.code).join(', ');

	const response = await client().messages.create({
		model: MODEL,
		max_tokens: 8192,
		system:
			'You extract structured household waste-collection-calendar data from raw text extracted ' +
			'from a Dutch-language Belgian (IGEAN) waste collection calendar PDF. The source is a ' +
			'grid calendar: each day of the year may have zero, one, or several collection-type ' +
			'abbreviations. Some entries are holiday/closure notices for the recyclagepark (drop-off ' +
			'center), phrased like "RP gesloten" — these are NOT curbside collection days and must be ' +
			'excluded from your output entirely. A "kerstboom" (Christmas tree) special collection day ' +
			'should be included with type "kerstboom". Reply with ONLY a single JSON object, no markdown ' +
			`fences, no commentary: {"year": <number>, "entries": [{"date": "YYYY-MM-DD", "types": ` +
			`["hv"|"gft"|"pmd"|"pk"|"sh"|"gv"|"tex"|"kerstboom", ...]}]}. Valid type codes: ${validCodes}.`,
		messages: [{ role: 'user', content: rawText }]
	});

	const textBlock = response.content.find((b) => b.type === 'text');
	const raw = textBlock?.type === 'text' ? textBlock.text : '{}';
	const jsonMatch = raw.match(/\{[\s\S]*\}/);
	const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as ParsedWasteCalendar;

	if (!parsed.year || !Array.isArray(parsed.entries)) {
		throw new Error('The assistant returned an unexpected format — try again or enter dates manually.');
	}
	return parsed;
}

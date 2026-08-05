import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { askAssistant, isAiConfigured, type ChatMessage } from '$lib/server/ai';

export const POST: RequestHandler = async ({ request }) => {
	if (!isAiConfigured()) error(400, 'AI assistant is not configured.');

	const body = (await request.json()) as { messages?: ChatMessage[] };
	const messages = Array.isArray(body.messages) ? body.messages : [];
	if (messages.length === 0) error(400, 'No message provided.');

	try {
		const reply = await askAssistant(messages);
		return json({ reply });
	} catch (err) {
		error(502, err instanceof Error ? err.message : 'The assistant request failed.');
	}
};

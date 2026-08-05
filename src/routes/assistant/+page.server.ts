import type { PageServerLoad } from './$types';
import { gatherHouseholdContext, isAiConfigured } from '$lib/server/ai';

export const load: PageServerLoad = async () => {
	const configured = isAiConfigured();
	const sections = configured ? (await gatherHouseholdContext()).sections.map((s) => s.label) : [];

	return { configured, sections };
};

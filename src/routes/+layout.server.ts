import type { LayoutServerLoad } from './$types';
import { ensureRecurringBills } from '$lib/server/bills';
import { getRecentActivity, getUnreadCount } from '$lib/server/activity';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null };

	await ensureRecurringBills();

	return {
		user: locals.user,
		recentActivity: await getRecentActivity(15),
		unreadActivityCount: await getUnreadCount(locals.user.id)
	};
};

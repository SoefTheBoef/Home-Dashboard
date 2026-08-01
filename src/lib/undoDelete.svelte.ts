import { toasts } from './toastStore.svelte';

/**
 * Shared pattern for every "delete" button in the app: hide the row immediately, offer a few
 * seconds to undo via a toast, and only fire the real server request once the toast expires.
 */
export function createUndoDelete(actionUrl: string, fieldName = 'id') {
	let pending = $state(new Set<number>());

	function isPending(id: number): boolean {
		return pending.has(id);
	}

	function requestDelete(id: number, label: string) {
		pending.add(id);
		pending = new Set(pending);

		toasts.showUndo({
			message: `${label} deleted`,
			onUndo: () => {
				pending.delete(id);
				pending = new Set(pending);
			},
			onCommit: async () => {
				const fd = new FormData();
				fd.set(fieldName, String(id));
				try {
					const res = await fetch(actionUrl, { method: 'POST', body: fd });
					if (!res.ok) throw new Error('request failed');
				} catch {
					pending.delete(id);
					pending = new Set(pending);
					toasts.info(`Couldn't delete ${label.toLowerCase()} — try again`);
				}
			}
		});
	}

	return {
		isPending,
		requestDelete
	};
}

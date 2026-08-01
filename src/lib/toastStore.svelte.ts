export interface ToastItem {
	id: number;
	message: string;
	durationMs: number;
	showUndo: boolean;
	onUndo?: () => void;
	onCommit?: () => void | Promise<void>;
	timer?: ReturnType<typeof setTimeout>;
}

class ToastStore {
	items = $state<ToastItem[]>([]);
	private nextId = 1;

	/** Shows a toast with an Undo action; onCommit fires automatically once the toast expires. */
	showUndo(opts: {
		message: string;
		onUndo?: () => void;
		onCommit?: () => void | Promise<void>;
		durationMs?: number;
	}) {
		const id = this.nextId++;
		const durationMs = opts.durationMs ?? 5000;
		const timer = setTimeout(() => this.expire(id), durationMs);
		this.items.push({
			id,
			message: opts.message,
			durationMs,
			showUndo: true,
			onUndo: opts.onUndo,
			onCommit: opts.onCommit,
			timer
		});
	}

	/** Simple, short-lived confirmation message with no undo action. */
	info(message: string, durationMs = 3000) {
		const id = this.nextId++;
		const timer = setTimeout(() => this.expire(id), durationMs);
		this.items.push({ id, message, durationMs, showUndo: false, timer });
	}

	undo(id: number) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;
		clearTimeout(item.timer);
		item.onUndo?.();
		this.items = this.items.filter((i) => i.id !== id);
	}

	private expire(id: number) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;
		void item.onCommit?.();
		this.items = this.items.filter((i) => i.id !== id);
	}
}

export const toasts = new ToastStore();

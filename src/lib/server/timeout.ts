/**
 * Races a promise against a timer so a stuck operation (a hung DB query, a stuck socket) rejects
 * with a clear error instead of leaving the caller waiting forever. Doesn't cancel the underlying
 * work — it just stops making the caller wait for it.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timedOut = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
	});

	try {
		return await Promise.race([promise, timedOut]);
	} finally {
		clearTimeout(timer!);
	}
}

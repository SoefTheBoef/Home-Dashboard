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

/**
 * Logs when a promise actually settles, independent of whatever a race/timeout wrapped around it
 * ends up reporting to the caller. Returns the same promise unchanged (a non-consuming `.then` on
 * a promise doesn't affect other subscribers, including a later `Promise.race`), so this can wrap
 * the same promise that also gets passed into withTimeout() — letting us tell "the real operation
 * finished fast but the wrapper still reported a timeout" (a bug in the race) apart from "the real
 * operation genuinely never came back" (not a bug — the timeout did its job).
 */
export function logWhenSettled<T>(promise: Promise<T>, label: string): Promise<T> {
	const start = Date.now();
	promise.then(
		() => console.log(`[timing] ${label} RESOLVED after ${Date.now() - start}ms`),
		(err) => console.log(`[timing] ${label} REJECTED after ${Date.now() - start}ms: ${err?.message ?? err}`)
	);
	return promise;
}

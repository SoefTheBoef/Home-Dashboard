<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface Message {
		role: 'user' | 'assistant';
		content: string;
	}

	let messages = $state<Message[]>([]);
	let input = $state('');
	let sending = $state(false);
	let errorMessage = $state<string | null>(null);
	let scrollEl: HTMLDivElement | undefined = $state();

	async function send() {
		const text = input.trim();
		if (!text || sending) return;

		errorMessage = null;
		messages = [...messages, { role: 'user', content: text }];
		input = '';
		sending = true;
		queueScroll();

		try {
			const res = await fetch('/assistant/ask', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ messages })
			});
			if (!res.ok) throw new Error(await res.text());
			const data = (await res.json()) as { reply: string };
			messages = [...messages, { role: 'assistant', content: data.reply }];
		} catch {
			errorMessage = "Couldn't reach the assistant — try again in a moment.";
		} finally {
			sending = false;
			queueScroll();
		}
	}

	function queueScroll() {
		requestAnimationFrame(() => scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }));
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<svelte:head>
	<title>Assistant — Home Dashboard</title>
</svelte:head>

<h1 class="mb-4 text-xl font-semibold text-gray-900">Assistant</h1>

{#if !data.configured}
	<p class="empty-state">
		The AI assistant isn't set up yet — add an <code>ANTHROPIC_API_KEY</code> to enable it (see the
		README's deployment checklist).
	</p>
{:else}
	<div class="mb-3 rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-500 dark:border-gray-700">
		<span class="font-semibold text-gray-600 dark:text-gray-300">Can see:</span>
		{data.sections.join(' · ')}
	</div>

	<div bind:this={scrollEl} class="card mb-3 flex h-[28rem] flex-col gap-3 overflow-y-auto">
		{#if messages.length === 0}
			<p class="text-sm text-gray-400">
				Ask about what's in the fridge, what's on the calendar, bills due soon, or anything else on
				the dashboard.
			</p>
		{/if}
		{#each messages as m, i (i)}
			<div class="flex {m.role === 'user' ? 'justify-end' : 'justify-start'}">
				<p
					class="max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm {m.role === 'user'
						? 'bg-wood-600 text-white'
						: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'}"
				>
					{m.content}
				</p>
			</div>
		{/each}
		{#if sending}
			<div class="flex justify-start">
				<p class="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400 dark:bg-gray-800">Thinking…</p>
			</div>
		{/if}
	</div>

	{#if errorMessage}
		<p class="mb-2 text-xs text-red-600">{errorMessage}</p>
	{/if}

	<form
		class="flex gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			send();
		}}
	>
		<textarea
			bind:value={input}
			onkeydown={onKeydown}
			placeholder="Ask something…"
			rows="1"
			class="input flex-1 resize-none"
		></textarea>
		<button type="submit" class="btn-primary px-4" disabled={sending || !input.trim()}>Send</button>
	</form>
{/if}

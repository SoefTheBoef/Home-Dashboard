<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
	let timedOut = $state(false);

	function timeout(ms: number): Promise<'timeout'> {
		return new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
	}
</script>

<svelte:head>
	<title>Sign in — Home Dashboard</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-100 px-4">
	<div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
		<h1 class="mb-1 text-xl font-semibold text-gray-900">Home Dashboard</h1>
		<p class="mb-6 text-sm text-gray-500">Sign in to continue</p>

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				timedOut = false;
				return async ({ update }) => {
					// The server enforces its own query/connection timeouts, but this is a safety net —
					// if something upstream (proxy, network) still hangs, don't spin forever.
					const result = await Promise.race([update().then(() => 'done' as const), timeout(15_000)]);
					if (result === 'timeout') timedOut = true;
					loading = false;
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="username" class="mb-1 block text-sm font-medium text-gray-700">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					value={form?.username ?? ''}
					required
					class="input"
				/>
			</div>
			<div>
				<label for="password" class="mb-1 block text-sm font-medium text-gray-700">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="input"
				/>
			</div>

			{#if timedOut}
				<p class="text-sm font-medium text-gray-800">
					That's taking longer than expected — please try again.
				</p>
			{:else if form?.error}
				<p class="text-sm font-medium text-gray-800">{form.error}</p>
			{/if}

			<button type="submit" disabled={loading} class="btn-primary w-full py-2 text-sm">
				{loading ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	</div>
</div>
